const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
const collections = read('data/portfolio-editorial-collections.json').collections
const photographs = read('data/portfolio-editorial-photos.json').photographs
const manifest = read('docs/portfolio-editorial-coverage.json')
assert.equal(manifest.acceptedCollections, 36)
assert.equal(manifest.acceptedPhotographs, 420)
assert.deepEqual(Object.keys(collections).map(Number).sort((a, b) => a - b), [...manifest.sourceCollections].sort((a, b) => a - b))
assert.deepEqual(Object.keys(photographs).sort(), Object.keys(manifest.sourcePhotographs).sort())
const titles = new Set()
for (const [kind, index] of [['collection', collections], ['photo', photographs]]) {
  for (const [id, entry] of Object.entries(index)) {
    assert.deepEqual(Object.keys(entry).sort(), ['en', 'zh'])
    if (kind === 'photo') assert.ok(collections[manifest.sourcePhotographs[id]], `Missing parent for ${id}`)
    for (const locale of ['en', 'zh']) {
      const copy = entry[locale]
      assert.deepEqual(Object.keys(copy).sort(), ['description', 'subtitle', 'title'])
      for (const [field, value] of Object.entries(copy)) {
        assert.equal(typeof value, 'string', `${kind} ${id} ${locale}.${field}`)
        assert.equal(value, value.trim(), `Untrimmed ${kind} ${id}`)
        assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), `Control character ${id}`)
        assert.ok(!/<\/?(?:script|iframe|style)\b/i.test(value), `Markup in copy ${id}`)
        if (locale === 'en') assert.ok(!/[\u3400-\u9fff]/.test(value), `Untranslated English ${id}`)
      }
      assert.ok(copy.title.length > 0 && copy.description.length > 0, `Empty ${kind} ${id}`)
      if (kind === 'photo') assert.equal(copy.subtitle, '', `Repeated photo subtitle ${id}`)
      const group = kind === 'collection' ? 'collections' : manifest.sourcePhotographs[id]
      const key = `${kind}:${group}:${locale}:${copy.title.normalize('NFKC').toLowerCase()}`
      assert.ok(!titles.has(key), `Duplicate title in series: ${key}`)
      titles.add(key)
    }
  }
}

// Execute the actual selectors: verify lazy loading, both languages and the
// intentional blank subtitle, rather than a second implementation of them.
const requested = []
const modules = new Map()
function load(relative) {
  const filename = path.join(root, relative)
  if (modules.has(filename)) return modules.get(filename).exports
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  modules.set(filename, module)
  const requireLocal = name => {
    if (name.startsWith('@/data/')) {
      requested.push(name)
      return read(name.slice(2))
    }
    if (name === './portfolio-editorial') return load('lib/portfolio-editorial.ts')
    throw new Error(`Unexpected runtime dependency: ${name}`)
  }
  vm.runInNewContext(`(function(require,module,exports){${output}\n})`, {}, { filename })(requireLocal, module, module.exports)
  return module.exports
}
async function main() {
  const helper = load('lib/portfolio-editorial.ts')
  assert.ok(!requested.some(name => name.includes('photos.json')), 'Photo bank eagerly loaded')
  assert.equal(helper.collectionEditorial(999999), undefined)
  assert.equal(helper.collectionEditorial('71').zh.title, collections['71'].zh.title)
  assert.ok(helper.matchingEditorialCollections(['四欧一张']).includes(71))
  assert.ok(helper.matchingEditorialCollections(['FOUR EUROS']).includes(71))
  assert.equal(helper.matchingEditorialCollections([' ', '']).length, 0)
  assert.equal(helper.editorialMatches({ 9: { en: { title: 'Flower' }, zh: { title: '花' } } }, ['ＦＬＯＷＥＲ'])[0], 9)
  const firstLoad = helper.loadPhotoEditorial()
  assert.equal(firstLoad, helper.loadPhotoEditorial(), 'Concurrent searches do not share the load')
  const bank = await firstLoad
  assert.equal(Object.keys(bank).length, 420)
  assert.equal(bank['2386'].en.title, 'Floodlight Tower')
  assert.equal(bank['2386'].en.subtitle, '')
  assert.ok(helper.editorialMatches(bank, ['灯架']).includes(2386))
  assert.ok(helper.editorialMatches(bank, ['FLOODLIGHT']).includes(2386))
  const server = load('lib/portfolio-photo-editorial.server.ts')
  assert.equal(server.photoEditorial(999999), undefined)
  assert.equal(server.photoEditorial('2386').en.title, bank['2386'].en.title)
  console.log(JSON.stringify({ collections: Object.keys(collections).length, photographs: Object.keys(bank).length, locales: ['zh', 'en'], duplicateTitlesInSeries: 0, lazyPhotoLoading: 'passed', bilingualSearch: 'passed', unknownIdFallback: 'passed', blankSubtitle: 'passed' }, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
