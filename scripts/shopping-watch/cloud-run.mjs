import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
// Public workflow logs contain counts only. Never forward child stdout/stderr,
// upload the decrypted catalog, or expose per-item IDs and personal memos.
try {
  await promisify(execFile)(process.execPath, [resolve(root, "scripts/shopping-watch/update.mjs"), "--cloud"], {
    cwd: root, timeout: 240000, killSignal: "SIGTERM", maxBuffer: 2 * 1024 * 1024,
  })
  const catalog = JSON.parse(await readFile(resolve(root, "outputs/shopping-watch/latest-catalog.json"), "utf8"))
  console.log(JSON.stringify({ status: "ok", at: catalog.updatedAt, cloudReadbackVerified: true,
    attempted: catalog.run.attempted, succeeded: catalog.run.succeeded, failed: catalog.run.failed,
    changedCount: catalog.run.changed.length, campaignChangeCount: catalog.run.campaignChanges.length,
    discovery: catalog.run.discovery,
    scriptedSources: catalog.items.filter(item => item.monitor?.kind && item.monitor.kind !== "manual").length }))
} catch {
  console.error(JSON.stringify({ status: "error", error: "Collection or cloud readback failed; private diagnostic output withheld." }))
  process.exitCode = 1
}
