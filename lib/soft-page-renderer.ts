import { paperIndices, writePaperMesh } from "./soft-page-geometry"
import { createFrameTaskQueue } from "./frame-task-queue"

export interface SoftPageRenderer {
  warm(): Promise<void>
  prepare(front: number, back: number): Promise<boolean>
  draw(turn: number, bend: number, grip: number, direction: number): void
  showSpread(index: number): Promise<boolean>
  resize(): void
  dispose(): void
}

type PageTexture = {texture: WebGLTexture; key: string}
type PageGeometry = {buffer: WebGLBuffer; indices: WebGLBuffer; count: number}

const vertexSource = `
attribute vec3 aPosition;
attribute vec2 aUV;
uniform vec2 uViewport;
uniform float uPerspective;
varying vec2 vUV;
void main() {
  float w = 1.0 - aPosition.z / uPerspective;
  gl_Position = vec4(2.0 * aPosition.x / uViewport.x,
    -2.0 * aPosition.y / uViewport.y, -aPosition.z / uPerspective, w);
  vUV = aUV;
}`
const fragmentSource = `
precision highp float;
uniform sampler2D uFront;
uniform sampler2D uBack;
varying vec2 vUV;
void main() {
  gl_FragColor = gl_FrontFacing ? texture2D(uFront, vUV)
    : texture2D(uBack, vec2(1.0 - vUV.x, vUV.y));
}`

export function createSoftPageRenderer(book: HTMLElement, canvas: HTMLCanvasElement): SoftPageRenderer | null {
  const setupStarted = performance.now()
  const gl = canvas.getContext("webgl", {alpha: true, antialias: true, depth: true, preserveDrawingBuffer: true})
  if (!gl) return null
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source); gl.compileShader(shader)
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
    gl.deleteShader(shader)
    return null
  }
  const vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex)
    if (fragment) gl.deleteShader(fragment)
    if (program) gl.deleteProgram(program)
    return null
  }
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
  gl.deleteShader(vertex); gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null }
  gl.useProgram(program)
  const position = gl.getAttribLocation(program, "aPosition"), uv = gl.getAttribLocation(program, "aUV")
  const viewport = gl.getUniformLocation(program, "uViewport"), camera = gl.getUniformLocation(program, "uPerspective")
  gl.uniform1i(gl.getUniformLocation(program, "uFront"), 0)
  gl.uniform1i(gl.getUniformLocation(program, "uBack"), 1)
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL)
  gl.disable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 0)

  const pages = [...book.querySelectorAll<HTMLElement>("[data-book-leaf]")]
  const textures = new Map<number, PageTexture>()
  const pending = new Map<string, Promise<PageTexture | null>>()
  const columns = 40, rows = 10
  const movingVertices = new Float32Array((columns + 1) * (rows + 1) * 5)
  const planeVertices = new Float32Array(20)
  const geometry = (indices: Uint16Array): PageGeometry => {
    const buffer = gl.createBuffer()!, element = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, element); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
    return {buffer, indices: element, count: indices.length}
  }
  const leftPlane = geometry(paperIndices(1, 1)), rightPlane = geometry(paperIndices(1, 1))
  const movingPage = geometry(paperIndices(columns, rows))
  let width = 0, height = 0, viewportWidth = 0, viewportHeight = 0, ratio = 1, perspective = 2200
  let generation = 0, request = 0, disposed = false, lost = false
  let frontTexture: PageTexture | null = null, backTexture: PageTexture | null = null
  let underLeft: PageTexture | null = null, underRight: PageTexture | null = null

  const hide = () => {canvas.style.opacity = "0"; book.dataset.paperReady = "false"}
  const uploads = createFrameTaskQueue()
  const releaseTextures = () => {
    uploads.clear()
    textures.forEach(item => gl.deleteTexture(item.texture)); textures.clear(); pending.clear()
  }
  const drawPage = (shape: PageGeometry, front: PageTexture, back: PageTexture, direction: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer)
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0)
    gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shape.indices)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, front.texture)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, back.texture)
    gl.frontFace(direction > 0 ? gl.CW : gl.CCW)
    gl.drawElements(gl.TRIANGLES, shape.count, gl.UNSIGNED_SHORT, 0)
  }
  const begin = () => {
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(program); gl.uniform2f(viewport, viewportWidth, viewportHeight); gl.uniform1f(camera, perspective)
  }
  const reveal = () => {canvas.style.opacity = "1"; book.dataset.paperReady = "true"; book.dataset.paperRenderer = "webgl-mesh"}
  const resize = () => {
    if (disposed || lost) return
    generation++; request++; releaseTextures(); hide()
    frontTexture = null; backTexture = null; underLeft = null; underRight = null
    width = parseFloat(getComputedStyle(pages[0]).width); height = parseFloat(getComputedStyle(book).height)
    perspective = parseFloat(getComputedStyle(book).perspective) || 2200
    const rect = book.getBoundingClientRect(), scrollRoot = book.closest<HTMLElement>("[data-portfolio-scroll-root]")
    const bounds = scrollRoot?.getBoundingClientRect()
    const available = Math.min(rect.left - (bounds?.left || 0), (bounds?.left || 0) + (scrollRoot?.clientWidth || window.innerWidth) - rect.right)
    const overscanX = Math.max(0, Math.min(Math.ceil(width * .24), available - 1))
    const overscanY = Math.ceil(width * .24)
    viewportWidth = width * 2 + overscanX * 2; viewportHeight = height + overscanY * 2
    // Bound the complete offscreen surface, including the curling-page overscan.
    // Small screens retain their pixel density; large Retina books avoid a
    // multi-million-pixel multisampled buffer for every display frame.
    ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2_000_000 / Math.max(1,viewportWidth*viewportHeight)))
    canvas.width = Math.round(viewportWidth * ratio); canvas.height = Math.round(viewportHeight * ratio)
    book.dataset.paperCanvasPixels=String(canvas.width*canvas.height)
    book.dataset.paperPixelRatio=ratio.toFixed(2)
    Object.assign(canvas.style, {left: `${-overscanX}px`, top: `${-overscanY}px`, width: `${viewportWidth}px`, height: `${viewportHeight}px`})
    for (const [plane, direction] of [[leftPlane, -1], [rightPlane, 1]] as const) {
      writePaperMesh(planeVertices, 1, 1, width, height, 0, 0, .75, direction)
      gl.bindBuffer(gl.ARRAY_BUFFER, plane.buffer); gl.bufferData(gl.ARRAY_BUFFER, planeVertices, gl.STATIC_DRAW)
    }
    begin()
  }
  const pageKey = (index: number) => {
    const page = pages[index]
    return [width, height, ratio, ...[...page.querySelectorAll<HTMLElement>("[data-book-photo]")].map(frame => {
      const image = frame.querySelector("img")!
      return [image.src, image.srcset, image.currentSrc, image.naturalWidth, image.naturalHeight,
        frame.offsetLeft, frame.offsetTop, getComputedStyle(frame).width, getComputedStyle(frame).height].join(":")
    })].join("|")
  }
  const textureFor = (index: number): Promise<PageTexture | null> => {
    if (disposed || lost) return Promise.resolve(null)
    const key = pageKey(index), cached = textures.get(index)
    if (cached?.key === key) return Promise.resolve(cached)
    const pendingKey = `${generation}:${index}:${key}`
    const loading = pending.get(pendingKey)
    if (loading) return loading
    const version = generation
    const promise = (async () => {
      const frames = [...pages[index].querySelectorAll<HTMLElement>("[data-book-photo]")]
      const images = frames.map(frame => frame.querySelector("img")!)
      images.forEach(image => {image.loading = "eager"})
      const decoded = await Promise.allSettled(images.map(image => image.decode()))
      if (disposed || lost || version !== generation || decoded.some(result => result.status === "rejected")) return null
      // Decode can complete in a batch. Raster and upload one page per frame;
      // the same textures still draw the resting spread and its moving leaf.
      return uploads.run(() => {
        if (disposed || lost || version !== generation) return null
        const buildStarted=performance.now()
        const actualKey = pageKey(index), existing = textures.get(index)
        if (existing?.key === actualKey) return existing
        const sheet = document.createElement("canvas")
        sheet.width = Math.round(width * ratio); sheet.height = Math.round(height * ratio)
        const paint = sheet.getContext("2d")!
        paint.scale(sheet.width / width, sheet.height / height)
        paint.fillStyle = "#fff"; paint.fillRect(0, 0, width, height)
        frames.forEach((frame, i) => {
          const image = images[i], style = getComputedStyle(frame)
          const fw = parseFloat(style.width), fh = parseFloat(style.height)
          const scale = Math.min(fw / image.naturalWidth, fh / image.naturalHeight)
          const w = image.naturalWidth * scale, h = image.naturalHeight * scale
          let x = (fw - w) / 2, y = (fh - h) / 2
          for (let node: HTMLElement | null = frame; node && node !== pages[index]; node = node.offsetParent as HTMLElement | null) {
            x += node.offsetLeft; y += node.offsetTop
          }
          paint.drawImage(image, x, y, w, h)
        })
        const texture = gl.createTexture()
        if (!texture) return null
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet)
        } catch(error) {
          gl.deleteTexture(texture)
          if(error instanceof DOMException && error.name === "SecurityError") {book.dataset.paperTextureError="cross-origin";return null}
          throw error
        } finally {sheet.width = 1; sheet.height = 1}
        if (existing) gl.deleteTexture(existing.texture)
        const result = {texture, key: actualKey}
        textures.set(index, result)
        book.dataset.paperBuildMaxMs=Math.max(Number(book.dataset.paperBuildMaxMs||0),performance.now()-buildStarted).toFixed(2)
        return result
      })
    })()
    pending.set(pendingKey, promise)
    void promise.then(() => pending.delete(pendingKey), () => pending.delete(pendingKey))
    return promise
  }
  const contextLost = (event: Event) => {
    event.preventDefault(); lost = true; hide(); book.dataset.paperRenderer = "fade"
    book.dispatchEvent(new Event("portrait-renderer-lost"))
  }
  canvas.addEventListener("webglcontextlost", contextLost)
  resize()
  book.dataset.paperSetupMs=(performance.now()-setupStarted).toFixed(2)
  return {
    async warm() {await Promise.all(pages.map((_, index) => textureFor(index)))},
    async showSpread(index) {
      const sequence = ++request, version = generation
      const pair = await Promise.all([textureFor(index * 2), textureFor(index * 2 + 1)])
      if (disposed || lost || sequence !== request || version !== generation || !pair[0] || !pair[1]) return false
      begin(); drawPage(leftPlane, pair[0], pair[0], -1); drawPage(rightPlane, pair[1], pair[1], 1)
      book.dataset.paperVisibleSpread = String(index + 1)
      reveal()
      return true
    },
    async prepare(front, back) {
      const sequence = ++request, version = generation, forward = front % 2 === 1
      const from = Math.floor(front / 2), to = Math.floor(back / 2)
      const left = forward ? from * 2 : to * 2, right = forward ? to * 2 + 1 : from * 2 + 1
      const parts = await Promise.all([front, back, left, right].map(textureFor))
      if (disposed || lost || sequence !== request || version !== generation || parts.some(part => !part)) return false
      ;[frontTexture, backTexture, underLeft, underRight] = parts as PageTexture[]
      book.dataset.paperFrontLeaf = String(front); book.dataset.paperBackLeaf = String(back)
      return true
    },
    draw(turn, bend, grip, direction) {
      if (disposed || lost || !frontTexture || !backTexture || !underLeft || !underRight) return
      begin(); drawPage(leftPlane, underLeft, underLeft, -1); drawPage(rightPlane, underRight, underRight, 1)
      // The turning leaf is above both resting pages. Give it its own depth
      // pass: retain self-occlusion within the curved mesh, but never let the
      // old resting sheet cover it as the spring approaches its end pose.
      gl.clear(gl.DEPTH_BUFFER_BIT)
      writePaperMesh(movingVertices, columns, rows, width, height, turn, bend, grip, direction)
      gl.bindBuffer(gl.ARRAY_BUFFER, movingPage.buffer); gl.bufferData(gl.ARRAY_BUFFER, movingVertices, gl.DYNAMIC_DRAW)
      drawPage(movingPage, frontTexture, backTexture, direction)
      reveal()
    },
    resize,
    dispose() {
      if (disposed) return
      disposed = true; generation++; request++
      canvas.removeEventListener("webglcontextlost", contextLost)
      hide(); releaseTextures()
      for (const shape of [leftPlane, rightPlane, movingPage]) {gl.deleteBuffer(shape.buffer); gl.deleteBuffer(shape.indices)}
      gl.deleteProgram(program); canvas.width = 1; canvas.height = 1
    },
  }
}
