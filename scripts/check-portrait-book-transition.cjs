const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require(path.join(process.cwd(), "node_modules/typescript"))

// Exercise the real hook's asynchronous state changes without a GPU. Browser
// screenshots separately verify the sheet's visual composition.
const sourcePath = process.env.PORTRAIT_BOOK_SOURCE || path.join(process.cwd(), "components/use-soft-portrait-book.ts")
const source = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
}).outputText

function mountBook() {
  const frames = new Map(), events = new Map(), storage = new Map(), timers = new Map()
  const cleanup = [], paints = [], deferred = []
  let frameId = 0, timerId = 0, now = 0, spread = 0, busy = false
  const pages = Array.from({length: 4}, () => ({
    dataset: {}, tabIndex: -1,
    setAttribute() {}, querySelectorAll() {return []},
  }))
  const visible = () => pages.flatMap((page, index) => page.dataset.pageVisible === "true" ? [index] : [])
  const listen = (type, callback) => events.set(type, callback)
  const raf = callback => {frames.set(++frameId, callback); return frameId}
  const cancelRaf = id => frames.delete(id)
  const motion = {matches: false, addEventListener() {}, removeEventListener() {}}
  const book = {
    dataset: {}, clientWidth: 1000, clientHeight: 500,
    querySelectorAll: () => pages,
    getBoundingClientRect: () => ({top: 100, bottom: 600, width: 1000, height: 500}),
    closest: () => null,
    addEventListener: listen, removeEventListener() {},
    hasPointerCapture: () => false,
  }
  const renderer = {
    warm(index) {paints.push({kind: "warm", index}); return Promise.resolve()},
    showSpread(index) {paints.push({kind: "rest", index, links: visible()}); return Promise.resolve(true)},
    prepare(front, back) {return new Promise(resolve => deferred.push({front, back, resolve}))},
    draw(progress) {paints.push({kind: "turn", progress, links: visible()})},
    dispose() {}, resize() {},
  }
  const observer = class {observe() {} disconnect() {}}
  const windowMock = {
    requestAnimationFrame: raf, cancelAnimationFrame: cancelRaf,
    setTimeout(callback) {timers.set(++timerId, callback); return timerId},
    clearTimeout(id) {timers.delete(id)},
    matchMedia: () => motion, innerHeight: 900, devicePixelRatio: 1,
    sessionStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
    addEventListener: listen, removeEventListener() {},
    location: {search: ""},
  }
  const moduleMock = {exports: {}}
  vm.runInNewContext(source, {
    module: moduleMock, exports: moduleMock.exports,
    require(name) {
      if (name === "react") return {
        useRef: current => ({current}),
        useLayoutEffect: run => run(),
        useEffect: run => cleanup.push(run()),
      }
      if (name === "@/lib/soft-page-renderer") return {createSoftPageRenderer: () => renderer}
      throw new Error(`Unexpected dependency: ${name}`)
    },
    window: windowMock,
    document: {hidden: false, addEventListener() {}, removeEventListener() {}},
    performance: {now: () => now},
    requestAnimationFrame: raf, cancelAnimationFrame: cancelRaf,
    IntersectionObserver: observer, ResizeObserver: observer, MutationObserver: observer,
    URLSearchParams, process: {env: {NODE_ENV: "test"}},
  }, {filename: sourcePath})
  const advance = moduleMock.exports.useSoftPortraitBook({
    book, canvas: {style: {}}, spread: 0, count: 2, paused: false,
    onSpread: value => {spread = value}, onBusy: value => {busy = value},
  })
  async function microtasks() {for (let i = 0; i < 8; i++) await Promise.resolve()}
  async function settle() {
    for (let tick = 0; tick < 1200 && frames.size; tick++) {
      const pending = [...frames.values()]; frames.clear(); now += 1000 / 120
      pending.forEach(callback => callback(now)); await microtasks()
      if (book.dataset.turning === "true") {
        assert.deepEqual(visible(), spread === 0 ? [0, 1] : [2, 3], "HTML photographs changed before the turn committed")
      }
    }
    assert.equal(busy, false, "turn did not settle")
  }
  return {advance, book, visible, paints, deferred, microtasks, settle,
    get spread() {return spread}, get busy() {return busy},
    blur: () => events.get("blur")(),
    scroll: () => events.get("scroll")(),
    get pendingTimers() {return timers.size},
    async flushTimers() {const pending = [...timers.values()]; timers.clear(); pending.forEach(run => run()); await microtasks()},
    dispose: () => cleanup.forEach(run => run?.()),
  }
}

function checkGeometryEndpoints() {
  const geometryPath = process.env.PORTRAIT_GEOMETRY_SOURCE || path.join(process.cwd(), "lib/soft-page-geometry.ts")
  const compiled = ts.transpileModule(fs.readFileSync(geometryPath, "utf8"), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
  }).outputText
  const geometryModule = {exports: {}}
  vm.runInNewContext(compiled, {module: geometryModule, exports: geometryModule.exports})
  const {writePaperMesh} = geometryModule.exports
  for (const direction of [-1, 1]) {
    for (const endpoint of [0, 1]) {
      const resting = new Float32Array(41 * 11 * 5)
      const overshoot = new Float32Array(resting.length)
      writePaperMesh(resting, 40, 10, 555, 540, endpoint, 0, .75, direction)
      writePaperMesh(overshoot, 40, 10, 555, 540, endpoint === 0 ? -.035 : 1.035, .4, .75, direction)
      assert.ok(overshoot.every((value, index) => Math.abs(value - resting[index]) < .0001), "spring overshoot or residual bend moved the sheet through its resting layer")
    }
  }
}

async function main() {
  checkGeometryEndpoints()
  const quiet = mountBook()
  await quiet.settle()
  assert.equal(quiet.paints.filter(paint => paint.kind === "warm").length, 0, "texture work ran during the scroll frame")
  quiet.scroll(); quiet.scroll()
  assert.equal(quiet.pendingTimers, 1, "scrolling must replace the quiet-window timer")
  await quiet.flushTimers()
  assert.equal(quiet.paints.filter(paint => paint.kind === "warm").length, 1, "the quiet window should warm just the resting spread")
  quiet.dispose()
  assert.equal(quiet.pendingTimers, 0, "unmount retained pending texture work")
  const test = mountBook()
  assert.deepEqual(test.visible(), [0, 1])
  test.advance.current(1)
  assert.equal(test.busy, true)
  assert.deepEqual([test.deferred[0].front, test.deferred[0].back], [1, 2])
  test.deferred[0].resolve(true); await test.microtasks()
  assert.deepEqual(test.visible(), [0, 1], "forward preparation exposed the incoming HTML page")
  await test.settle()
  assert.equal(test.spread, 1); assert.deepEqual(test.visible(), [2, 3])
  assert.ok(test.paints.some(paint => paint.kind === "turn" && paint.progress === 1), "missing exact final pose")

  test.advance.current(-1)
  assert.deepEqual([test.deferred[1].front, test.deferred[1].back], [2, 1])
  test.deferred[1].resolve(true); await test.microtasks()
  assert.deepEqual(test.visible(), [2, 3], "reverse preparation exposed the incoming HTML page")
  await test.settle()
  assert.equal(test.spread, 0); assert.deepEqual(test.visible(), [0, 1])

  test.advance.current(1)
  test.blur()
  test.deferred[2].resolve(true); await test.microtasks()
  assert.equal(test.busy, false); assert.equal(test.spread, 0)
  assert.deepEqual(test.visible(), [0, 1], "stale asynchronous preparation changed a cancelled spread")
  test.dispose()
  console.log("PASS: spring endpoints cannot cross resting layers; forward/reverse retain outgoing photos until commit; cancellation cannot replace the spread; texture warming waits for quiet scrolling and is cancelled on unmount.")
}

main().catch(error => {console.error(error); process.exitCode = 1})
