import { execFileSync } from "node:child_process"
import { access, mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const label = "com.cunyli.shopping-watch"
const service = `gui/${process.getuid()}/${label}`
const directory = resolve(homedir(), "Library/LaunchAgents")
const plist = resolve(directory, `${label}.plist`)
const logs = resolve(root, "logs/shopping-watch")
const node = process.env.SHOPPING_NODE_PATH || process.execPath
await access(node)
await access(resolve(root, ".env"))
await mkdir(directory, { recursive: true })
await mkdir(logs, { recursive: true, mode: 0o700 })
const xml = text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
await writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(resolve(root, "scripts/shopping-watch/scheduled-run.mjs"))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>StartInterval</key><integer>600</integer>
<key>RunAtLoad</key><true/>
<key>ProcessType</key><string>Background</string>
<key>LowPriorityIO</key><true/>
<key>StandardOutPath</key><string>${xml(resolve(logs, "scheduler.stdout.log"))}</string>
<key>StandardErrorPath</key><string>${xml(resolve(logs, "scheduler.stderr.log"))}</string>
<key>Umask</key><integer>63</integer>
</dict></plist>\n`, { mode: 0o600 })
execFileSync("/usr/bin/plutil", ["-lint", plist], { stdio: "inherit" })
let registered = true
try { execFileSync("/bin/launchctl", ["print", service], { stdio: "ignore" }) }
catch (error) { if (error.status !== 113) throw error; registered = false }
if (registered) execFileSync("/bin/launchctl", ["bootout", service])
execFileSync("/bin/launchctl", ["bootstrap", `gui/${process.getuid()}`, plist])
console.log(JSON.stringify({ installed: true, label, intervalSeconds: 600, plist, node }))
