import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(
  process.env.AI_INTEL_FEED_SOURCE || `${process.env.HOME}/Projects/ai-intel-feed/feed-input.json`,
)
const target = resolve(repoRoot, "data/ai-intel-feed/feed-input.json")
const stateSource = resolve(
  process.env.AI_INTEL_FEED_STATE_SOURCE || `${process.env.HOME}/Projects/ai-intel-feed/shared-state.json`,
)
const stateTarget = resolve(repoRoot, "data/ai-intel-feed/shared-state.json")

const sourceStat = statSync(source)
if (!sourceStat.isFile()) {
  throw new Error(`AI feed source is not a file: ${source}`)
}

mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
if (existsSync(stateSource)) {
  const stateStat = statSync(stateSource)
  if (!stateStat.isFile()) {
    throw new Error(`AI feed state source is not a file: ${stateSource}`)
  }
  copyFileSync(stateSource, stateTarget)
  console.log(`Synced AI feed shared state to ${stateTarget}`)
}

console.log(`Synced AI feed JSON to ${target}`)
