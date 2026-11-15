import { execFile } from "node:child_process"
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const output = resolve(root, "outputs/shopping-watch")
const logs = resolve(root, "logs/shopping-watch")
const startedAt = new Date().toISOString()
await mkdir(output, { recursive: true, mode: 0o700 })
await mkdir(logs, { recursive: true, mode: 0o700 })
// Bound launchd's stdout/stderr files and retain 30 days of daily summaries.
for (const name of ["scheduler.stdout.log", "scheduler.stderr.log"]) {
  const path = resolve(logs, name)
  const info = await stat(path).catch(error => { if (error.code !== "ENOENT") throw error; return null })
  if (info?.size > 2 * 1024 * 1024) await rename(path, `${path}.previous`)
}
for (const name of await readdir(logs)) {
  if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) && Date.now() - Date.parse(name.slice(0, 10)) > 30 * 86400000) await unlink(resolve(logs, name))
}
let status
try {
  await promisify(execFile)(process.execPath, [resolve(root, "scripts/shopping-watch/update.mjs")], {
    cwd: root, timeout: 240000, killSignal: "SIGTERM", maxBuffer: 2 * 1024 * 1024,
  })
  const catalog = JSON.parse(await readFile(resolve(output, "latest-catalog.json"), "utf8"))
  status = { status: "ok", startedAt, finishedAt: new Date().toISOString(),
    persistedUpdatedAt: catalog.updatedAt, run: catalog.run,
    scriptedSources: catalog.items.filter(item => item.monitor?.kind && item.monitor.kind !== "manual").length,
    manualSources: catalog.items.filter(item => !item.monitor?.kind || item.monitor.kind === "manual").length }
} catch (error) {
  status = { status: "error", startedAt, finishedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message.slice(0, 500) : String(error) }
  process.exitCode = 1
}
const statusPath = resolve(output, "scheduler-status.json")
await writeFile(`${statusPath}.tmp`, JSON.stringify(status, null, 2) + "\n", { mode: 0o600 })
await rename(`${statusPath}.tmp`, statusPath)
console.log(JSON.stringify(status))
