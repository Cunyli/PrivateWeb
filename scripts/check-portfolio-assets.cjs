const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const git = process.env.GIT_BIN || 'git'
const tracked = new Set(execFileSync(git, ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0'))
const sourcePaths = [
  'lib/session-image-variants.ts',
  'lib/photo-session-selection.ts',
  'lib/portrait-book-content.ts',
  'components/helsinki-photo-session.tsx',
  'components/portfolio-dreamscape.tsx',
  'components/portfolio-entry.module.css',
  'app/globals.css',
]
const sources = sourcePaths.map(file => fs.readFileSync(path.join(root, file), 'utf8'))
const localAssets = new Set(sources.flatMap(source => [...source.matchAll(/\/(?:photo-session|portrait-book|fonts)\/[^\s"'`,)]+\.(?:webp|jpg|png|woff2)|\/dreamcore-[^\s"'`,)]+\.(?:webp|png|mp4)/g)].map(match => match[0])))
for (const asset of localAssets) {
  assert(tracked.has('public' + asset), `Asset excluded from deployment or wrong filename case: ${asset}`)
  assert(fs.existsSync(path.join(root, 'public', asset)), `Missing asset: ${asset}`)
}

const moduleSource = ts.transpileModule(sources[0], { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const mod = { exports: {} }
vm.runInNewContext(`(function(module,exports){${moduleSource}\n})`, {})(mod, mod.exports)
const privateSources = new Set([...sources[3].matchAll(/src:\s*["'](\/private\/[^"']+)["']/g)].map(match => match[1]))
assert(privateSources.size > 0, 'No private-origin regression fixtures found')
for (const source of privateSources) {
  const display = mod.exports.sessionViewerSource(source)
  assert(!display.startsWith('/private/'), `Viewer still depends on excluded original: ${source}`)
  assert(tracked.has('public' + display), `Viewer copy not included in deployment: ${display}`)
}
const remote = 'https://example.test/portrait.webp?version=2'
assert.equal(mod.exports.sessionViewerSource(remote), remote)
assert.equal(mod.exports.sessionViewerSource('/photo-session/cover-florence.jpg'), '/photo-session/cover-florence.jpg')
console.log(JSON.stringify({ deployableLocalAssets: localAssets.size, privateOriginalViewerFallbacks: privateSources.size, remoteAndPublishedSourcesPreserved: true }, null, 2))
