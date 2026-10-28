"use client"

import { useEffect, useRef, useState } from "react"
import type { CSSProperties, MutableRefObject } from "react"
import { dreamscapeWind } from "@/lib/dreamscape-wind"

export type DreamscapeInput = {
  position: number
  impulse: number
  progress?: number
  reducedMotion?: boolean
  pointerX?: number
  pointerY?: number
  requestRender?: () => void
  onFrame?: (cpuMs: number) => void
}

const cloudPlate = "/dreamcore-viewfinder-clouds.webp"
const cloudFilm = "/dreamcore-rolling-clouds-light.mp4"
const layerStyle: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "46% 50%", pointerEvents: "none" }
const vertexSource = `attribute vec2 aPosition; varying vec2 vUv; void main(){ vUv=aPosition*.5+.5; gl_Position=vec4(aPosition,0.,1.); }`
const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uClouds, uCloudsNext, uMeadow, uSky, uBoy, uType, uFlightA, uFlightB;
uniform vec4 uCover, uTypeRect;
uniform vec2 uPointer;
uniform float uCloudMix, uTime, uWind, uGust, uProgress, uReduce, uFlightReady, uFlutter;
float phase(float a,float b,float p){return smoothstep(a,b,p);}
float inside(vec2 p){return step(0.,p.x)*step(p.x,1.)*step(0.,p.y)*step(p.y,1.);}
float region(vec2 p,vec2 c,vec2 r){return 1.-smoothstep(.58,1.,length((p-c)/r));}
vec4 cutout(sampler2D tex,vec2 uv,float blur){
  vec2 p=vec2(uv.x,1.-uv.y);
  if(blur<.0001) return texture2D(tex,p)*inside(uv);
  vec4 c=texture2D(tex,p)*.5;
  c+=texture2D(tex,p+vec2(blur,blur*.65))*.25;
  c+=texture2D(tex,p-vec2(blur,blur*.65))*.25;
  return c*inside(uv);
}
// The meadow fills the lower frame. Keep its opaque edges extended during
// parallax instead of exposing a hard UV boundary beside the photographer.
vec4 meadowAt(vec2 uv,float blur){
  vec2 p=clamp(vec2(uv.x,1.-uv.y),vec2(.0006),vec2(.9994));
  if(blur<.0001) return texture2D(uMeadow,p);
  vec4 c=texture2D(uMeadow,p)*.5;
  c+=texture2D(uMeadow,clamp(p+vec2(blur,blur*.65),vec2(.0006),vec2(.9994)))*.25;
  c+=texture2D(uMeadow,clamp(p-vec2(blur,blur*.65),vec2(.0006),vec2(.9994)))*.25;
  return c;
}
vec3 cloudsAt(vec2 uv){
  vec2 p=vec2(uv.x,1.-uv.y);
  if(uCloudMix<.001) return texture2D(uClouds,p).rgb;
  if(uCloudMix>.999) return texture2D(uCloudsNext,p).rgb;
  return mix(texture2D(uClouds,p).rgb,texture2D(uCloudsNext,p).rgb,uCloudMix);
}
// Sixty-four cloud-only frames from the reference, packed in two bounded atlases.
// Two samples interpolate the scroll position; no video seek or frame decode on scroll.
vec3 flightFrame(float frame,vec2 uv){
  float local=mod(frame,32.);
  vec2 cell=vec2(mod(local,4.),floor(local/4.));
  uv=clamp(uv,vec2(.5/448.,.5/252.),vec2(1.-.5/448.,1.-.5/252.));
  vec2 atlas=(cell+uv)/vec2(4.,8.);
  atlas.y=1.-atlas.y;
  if(frame<32.) return texture2D(uFlightA,atlas).rgb;
  return texture2D(uFlightB,atlas).rgb;
}
vec3 flightAt(float progress,vec2 uv){
  float frame=phase(.49,.735,progress)*63.;
  float a=floor(frame),b=min(a+1.,63.);
  return mix(flightFrame(a,uv),flightFrame(b,uv),fract(frame));
}
vec3 flightGrade(vec3 cloud,float progress){
  vec3 tint=mix(vec3(.90,.84,.97),vec3(.97,.96,.93),phase(.40,.68,progress));
  cloud=clamp((cloud-.72)*1.35+.72,0.,1.);
  return mix(cloud,tint,.10);
}
float flightAlpha(vec3 cloud,vec2 screen,float progress){
  float luminance=dot(cloud,vec3(.2126,.7152,.0722));
  float field=(1.-luminance)*.58+screen.y*.42;
  float edge=mix(.98,-.14,phase(.55,.735,progress));
  return 1.-smoothstep(edge-.12,edge+.12,field);
}
void main(){
  vec2 screen=vec2(vUv.x,1.-vUv.y);
  vec2 uv=screen*uCover.xy+uCover.zw;
  float p=uProgress;
  if(p>=.735){gl_FragColor=vec4(0.);return;}
  float push=phase(.07,.65,p)*(1.-uReduce);
  float t=mod(uTime,32.);
  float windPhase=t*.19634954;
  float gust=(uGust+min(uWind,.6)*.12)*(1.-uReduce);
  vec3 flight=vec3(0.);
  bool flying=uFlightReady>.5 && p>.32 && uReduce<.5;
  if(flying){
    vec2 flightUv=(uv-.5)/(1.+phase(.32,.53,p)*.10)+.5;
    flight=flightAt(p,flightUv);
    if(p>=.53){
      float alpha=flightAlpha(flight,screen,p);
      gl_FragColor=vec4(flightGrade(flight,p)*alpha,alpha);
      return;
    }
  }

  vec2 skyUv=(uv-.5)/(1.+push*.035)+.5+uPointer*.10;
  vec3 sky=texture2D(uSky,vec2(skyUv.x,1.-skyUv.y)).rgb;
  vec2 cloudUv=(uv-.5)/(1.+push*.16)+.5;
  cloudUv+=vec2(sin(windPhase)*.004+push*.025,cos(windPhase*2.+uv.x*5.)*.002-push*.025)+uPointer*.35;
  vec3 sea=cloudsAt(cloudUv*.94+.03);
  vec3 color=mix(sky,sea,smoothstep(.12,.48,uv.y));

  // Separate word planes share one static atlas. The surname can sit higher
  // without moving the main title or splitting a glyph across reveal timings.
  if(p>.025 && p<.54){
    vec2 typeBase=(screen-uTypeRect.xy-vec2(push*.018,-push*.035)-uPointer*.55)/uTypeRect.zw;
    float leave=phase(.37,.54,p);
    float enter=phase(.035,.22,p);
    vec2 namePoint=typeBase;
    namePoint.x+=((1.-enter)*.14+leave*.12)*(1.-uReduce);
    float nameEdge=namePoint.x+namePoint.y*.08;
    float nameReveal=(1.-smoothstep(enter*1.25-.08,enter*1.25+.02,nameEdge))*(1.-leave);
    vec4 name=texture2D(uType,vec2(namePoint.x,1.-namePoint.y))*inside(namePoint)*
      (1.-step(.58,namePoint.y))*nameReveal;
    color=name.rgb+color*(1.-name.a);

    vec2 surnamePoint=typeBase+vec2(0.,.21);
    float surnameEnter=phase(.08,.265,p);
    surnamePoint.x-=((1.-surnameEnter)*.14+leave*.12)*(1.-uReduce);
    float surnameEdge=1.-surnamePoint.x+surnamePoint.y*.08;
    float surnameReveal=(1.-smoothstep(surnameEnter*1.25-.08,surnameEnter*1.25+.02,surnameEdge))*(1.-leave);
    vec4 surname=texture2D(uType,vec2(surnamePoint.x,1.-surnamePoint.y))*inside(surnamePoint)*
      step(.58,surnamePoint.y)*surnameReveal;
    color=surname.rgb+color*(1.-surname.a);
  }

  vec2 anchor=vec2(.49,.65);
  float boyScale=1.+push*.65;
  vec2 boyUv=(uv-anchor-vec2(-push*.55*uCover.x/.89,-push*.04)-uPointer*1.6)/boyScale+anchor;
  vec2 boyAsset=(boyUv-vec2(.136,.153))/.711;
  vec4 boy=vec4(0.);
  float boyFade=1.-phase(.59,.79,p);
  // The gust bends loose hair and the shirt hem; face and camera stay still.
  if(boyFade>.001 && boyAsset.x>.33 && boyAsset.x<.66 && boyAsset.y>.32 && boyAsset.y<.99){
    float faceLock=1.-smoothstep(.82,1.,length((boyUv-vec2(.502,.546))/vec2(.041,.062)));
    float hair=region(boyUv,vec2(.466,.48),vec2(.051,.075))*(1.-smoothstep(.486,.548,boyUv.y))*(1.-faceLock);
    float hairWave=.8+.2*sin(windPhase*8.-boyUv.y*36.);
    boyUv.x-=.0048*hair*gust*hairWave;
    boyUv.y+=sin(windPhase*8.-boyUv.x*23.)*.0009*hair*gust;
    float cloth=region(boyUv,vec2(.434,.708),vec2(.082,.09))*(1.-faceLock);
    boyUv.x-=.0042*cloth*gust*(.75+.25*sin(windPhase*8.-boyUv.y*38.));
    boyUv.y+=sin(windPhase*8.-boyUv.y*31.)*.0007*cloth*gust;
    boyAsset=(boyUv-vec2(.136,.153))/.711;
    boy=cutout(uBoy,boyAsset,phase(.35,.71,p)*.0025)*boyFade;
  }

  vec2 meadowAnchor=vec2(.5,1.);
  vec2 meadowUv=(uv-meadowAnchor-vec2(-push*.035,push*.52)-uPointer*2.4)/(1.035+push*.70)+meadowAnchor;
  float depth=smoothstep(.58,1.,meadowUv.y);
  if(meadowUv.y>.58){
    float root=.22+.78*(1.-smoothstep(.93,1.,meadowUv.y));
    float wave=.75+.25*sin(windPhase*8.-meadowUv.x*16.+meadowUv.y*7.);
    meadowUv.x-=.009*depth*root*gust*wave;
    meadowUv.y+=sin(windPhase*8.-meadowUv.x*21.)*.0016*depth*root*gust;
  }
  vec4 meadow=vec4(0.);
  if(meadowUv.y>.50) meadow=meadowAt(meadowUv,phase(.18,.68,p)*.006);
  meadow*=1.-phase(.52,.80,p);

  // The bank belongs to the landscape, not the moving character cutout.
  vec2 bankUv=(uv-meadowAnchor-vec2(-push*.022,push*.08)-uPointer*.65)/(1.035+push*.12)+meadowAnchor;
  vec4 farMeadow=vec4(0.);
  if(bankUv.y>.50){
    float bankDepth=smoothstep(.52,.94,bankUv.y);
    bankUv.x-=.003*gust*bankDepth*(.8+.2*sin(windPhase*8.-bankUv.x*16.+bankUv.y*7.));
    bankUv.y+=sin(windPhase*8.-bankUv.x*21.)*.0005*gust*bankDepth;
    farMeadow=meadowAt(bankUv,0.);
  }
  farMeadow*=1.-phase(.52,.80,p);
  color=farMeadow.rgb+color*(1.-farMeadow.a);
  color=boy.rgb+color*(1.-boy.a);
  vec4 nearFlowers=meadow*smoothstep(.79,.87,meadowUv.y);
  color=nearFlowers.rgb+color*(1.-nearFlowers.a);

  if(flying){
    float amount=phase(.32,.53,p);
    float density=dot(flight,vec3(.2126,.7152,.0722));
    float edge=mix(1.15,.25,amount);
    float cover=amount*(.25+.75*smoothstep(edge-.12,edge+.12,density));
    color=mix(color,flightGrade(flight,p),cover);
    gl_FragColor=vec4(color,1.);
    return;
  }

  // Lightweight fallback if the optional flight sheets are unavailable.
  float fogAmount=phase(.35,.63,p)*(1.-phase(.71,.91,p))*(1.-uReduce);
  vec2 fogUv=vec2(screen.x*.91+.04+push*.015,.48+screen.y*.42-push*.08);
  fogUv.x+=sin(screen.y*7.+windPhase*2.)*.014;
  vec3 fog=vec3(.86,.83,.94);
  if(fogAmount>.001) fog=cloudsAt(fogUv);
  float density=dot(fog,vec3(.2126,.7152,.0722));
  float edge=mix(1.4,-.35,phase(.35,.78,p));
  float fogMask=smoothstep(edge-.22,edge+.22,screen.y+sin(screen.x*8.+windPhase)*.045);
  float fogAlpha=fogAmount*fogMask*(.35+.65*smoothstep(.30,.72,density));
  color=mix(color,mix(fog*1.05,vec3(.86,.83,.94),.16),fogAlpha);

  float vignette=smoothstep(.22,.78,length((screen-.5)*vec2(1.,.82)))*(.06+push*.05);
  color*=1.-vignette-uFlutter;
  // The cloud bank thins upward onto the live gallery. No lids or blackout.
  float reveal=phase(.53,.735,p);
  float cloudEdge=mix(1.2,-.25,reveal);
  float field=screen.y+sin(screen.x*5.+windPhase)*.035;
  float alpha=1.-smoothstep(cloudEdge-.16,cloudEdge+.16,field);
  alpha=mix(alpha,1.-phase(.58,.735,p),uReduce);
  gl_FragColor=vec4(color*alpha,alpha);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error("Could not allocate scene shader")
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Depth shader failed: ${message}`)
  }
  return shader
}

export function PortfolioDreamscape({ isPlaying, className, input }: {
  isPlaying: boolean
  className: string
  input?: MutableRefObject<DreamscapeInput>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videos = useRef<(HTMLVideoElement | null)[]>([null, null])
  const loop = useRef({ primary: 0, blending: false })
  const playing = useRef(isPlaying)
  const startRef = useRef<(() => void) | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    playing.current = isPlaying
    const clips = videos.current.slice()
    clips.forEach((video, index) => {
      if (!video) return
      if (isPlaying && !document.hidden && (index === loop.current.primary || loop.current.blending)) video.play().catch(error => { if (!(error instanceof DOMException && error.name === "AbortError")) console.warn("Cloud playback unavailable", error) })
      else video.pause()
    })
    startRef.current?.()
    return () => clips.forEach(video => video?.pause())
  }, [isPlaying])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "high-performance" })
    if (!gl) return
    let disposed = false, frame = 0, elapsed = 0, lastTime = 0, loaded = 0
    let flightLoaded = 0, flightUpload = 0
    let cloudMix = 0, wind = 0, pointerX = 0, pointerY = 0
    let lastProgress = "", lastGust = "", resolution = 1, qualityTime = 0, qualityFrames = 0, slowFrames = 0, goodWindows = 0
    const images: HTMLImageElement[] = []
    const dirty = [true, true], fallbackFrames = [-1, -1], videoCallbacks = [0, 0]
    const videoSizes = [[0, 0], [0, 0]]
    const textures: WebGLTexture[] = []
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
    const program = gl.createProgram()
    if (!program) throw new Error("Could not allocate depth program")
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(String(gl.getProgramInfoLog(program)))
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, "aPosition")
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const uniforms = Object.fromEntries(["uTime","uWind","uGust","uProgress","uCloudMix","uCover","uTypeRect","uPointer","uReduce","uFlightReady","uFlutter"].map(name => [name, gl.getUniformLocation(program, name)]))
    ;["uClouds","uCloudsNext","uMeadow","uSky","uBoy","uType","uFlightA","uFlightB"].forEach((name, index) => {
      const texture = gl.createTexture()
      if (!texture) throw new Error("Could not allocate depth texture")
      textures.push(texture)
      gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0]))
      gl.uniform1i(gl.getUniformLocation(program, name), index)
    })
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    const typeCanvas = document.createElement("canvas")
    typeCanvas.width = 1536; typeCanvas.height = 768
    const typeContext = typeCanvas.getContext("2d")
    // Generate once per font load, never on scroll. Motion is entirely in the shader.
    const paintType = () => {
      if (!typeContext || disposed) return
      typeContext.clearRect(0, 0, 1536, 768)
      typeContext.fillStyle = "#f2f3ef"
      typeContext.font = '900 520px "Portfolio Hanken", sans-serif'
      let x = 42
      for (const letter of "LIJIE") {
        typeContext.fillText(letter, x, 422)
        x += typeContext.measureText(letter).width - 24
      }
      typeContext.font = '800 400px "Portfolio Hanken", sans-serif'
      typeContext.strokeStyle = "#f2f3ef"
      typeContext.lineWidth = 4
      typeContext.strokeText("LI", 1120, 746)
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, textures[5])
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, typeCanvas)
    }
    paintType()
    document.fonts.load('900 520px "Portfolio Hanken"').then(() => { if (!disposed) { paintType(); start() } })

    const watchVideoFrame = (index: number) => {
      const video = videos.current[index]
      if (!video || typeof video.requestVideoFrameCallback !== "function") return
      videoCallbacks[index] = video.requestVideoFrameCallback(() => {
        if (disposed) return
        dirty[index] = true
        watchVideoFrame(index)
      })
    }
    videos.current.forEach((_, index) => watchVideoFrame(index))

    const updateClouds = () => {
      const current = loop.current
      const primary = videos.current[current.primary], next = videos.current[1 - current.primary]
      if (!primary || !next || primary.readyState < 2) return
      if (!current.blending && playing.current && next.readyState >= 2 && Number.isFinite(primary.duration) && primary.duration - primary.currentTime <= 1.2) {
        next.currentTime = 0
        next.play().catch(() => { current.blending = false })
        current.blending = true
      }
      if (current.blending) {
        const amount = Math.min(1, next.currentTime / 1.2)
        const mix = amount * amount * (3 - 2 * amount)
        cloudMix = current.primary === 0 ? mix : 1 - mix
        if (amount >= 1) { primary.pause(); primary.currentTime = 0; current.primary = 1 - current.primary; current.blending = false }
      } else cloudMix = current.primary
      videos.current.forEach((video, index) => {
        if (!video || video.readyState < 2 || (index !== current.primary && !current.blending)) return
        if (typeof video.requestVideoFrameCallback !== "function") {
          const decoded = Math.floor(video.currentTime * 24)
          if (fallbackFrames[index] !== decoded) { dirty[index] = true; fallbackFrames[index] = decoded }
        }
        if (!dirty[index]) return
        gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, textures[index])
        if (videoSizes[index][0] !== video.videoWidth || videoSizes[index][1] !== video.videoHeight) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
          videoSizes[index] = [video.videoWidth, video.videoHeight]
        } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video)
        dirty[index] = false
      })
    }
    const paint = () => {
      if (loaded !== 5 || disposed) return
      const measure = input?.current.onFrame
      const started = measure ? performance.now() : 0
      const p = input?.current.progress || 0
      updateClouds()
      const gust = input?.current.reducedMotion ? 0 : dreamscapeWind(elapsed)
      gl.uniform1f(uniforms.uTime, elapsed)
      gl.uniform1f(uniforms.uGust, gust)
      gl.uniform1f(uniforms.uFlutter, Math.pow(.5 + .5 * Math.sin((elapsed % 32) * .19634954 * 5), 20) * .008)
      gl.uniform1f(uniforms.uWind, wind); gl.uniform1f(uniforms.uProgress, p)
      gl.uniform1f(uniforms.uReduce, input?.current.reducedMotion ? 1 : 0)
      gl.uniform1f(uniforms.uCloudMix, cloudMix)
      gl.uniform1f(uniforms.uFlightReady, flightLoaded === 2 ? 1 : 0)
      gl.uniform2f(uniforms.uPointer, pointerX, pointerY)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      const progressText = p.toFixed(3)
      if (progressText !== lastProgress) { canvas.dataset.depthProgress = progressText; lastProgress = progressText }
      const gustText = gust.toFixed(1)
      if (gustText !== lastGust) { canvas.dataset.windStrength = gustText; lastGust = gustText }
      measure?.(performance.now() - started)
    }
    const resize = () => {
      const width = canvas.clientWidth, height = canvas.clientHeight
      const ratio = resolution * Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(1_000_000 / Math.max(1, width * height)), 1920 / Math.max(width, 1))
      const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio))
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      canvas.dataset.quality = resolution.toFixed(2)
      gl.viewport(0, 0, canvas.width, canvas.height)
      const cover = (w: number, h: number, x: number) => {
        const scale = Math.max(width / w, height / h)
        const vx = width / (w * scale), vy = height / (h * scale)
        return [vx, vy, (1 - vx) * x, (1 - vy) * .5] as const
      }
      gl.uniform4f(uniforms.uCover, ...cover(1672, 941, .46))
      const typeWidth = Math.min(width * 1.02, 1700)
      gl.uniform4f(uniforms.uTypeRect, (width - typeWidth) / 2 / width, width <= 640 ? .19 : .07, typeWidth / width, typeWidth / 2 / height)
      paint()
    }
    const draw = (now: number) => {
      frame = 0
      if (disposed || loaded !== 5) return
      const delta = lastTime ? Math.min((now - lastTime) / 1000, .08) : 1 / 60
      if (playing.current) elapsed += delta
      wind += ((input?.current.impulse || 0) - wind) * (1 - Math.exp(-delta * 12))
      const pointerBlend = 1 - Math.exp(-delta * 5)
      pointerX += ((input?.current.pointerX || 0) - pointerX) * pointerBlend
      pointerY += ((input?.current.pointerY || 0) - pointerY) * pointerBlend
      lastTime = now
      // Follow the display clock (60/120Hz). Under sustained load, reduce pixels,
      // not animation cadence; recover detail only after several stable windows.
      if (playing.current && lastTime) {
        qualityTime += delta; qualityFrames++
        if (delta > .022) slowFrames++
        if (qualityTime >= 1.5) {
          const slow = slowFrames / Math.max(1, qualityFrames)
          let next = resolution
          if (slow > .12) { next = Math.max(.72, resolution * .86); goodWindows = 0 }
          else if (slow < .02 && ++goodWindows >= 6) { next = Math.min(1, resolution / .86); goodWindows = 0 }
          if (Math.abs(next - resolution) > .01) { resolution = next; resize() }
          qualityTime = 0; qualityFrames = 0; slowFrames = 0
        }
      }
      paint()
      if (playing.current && !document.hidden) frame = requestAnimationFrame(draw)
    }
    function start() { if (!frame && loaded === 5 && !disposed && !document.hidden) frame = requestAnimationFrame(draw) }
    startRef.current = start
    if (input) input.current.requestRender = start
    const sources = [
      { index: 0, src: cloudPlate }, { index: 1, src: cloudPlate },
      { index: 2, src: "/dreamcore-meadow-isolated-v2.png" }, { index: 3, src: cloudPlate },
      { index: 4, src: "/dreamcore-photographer-isolated-v2.png" },
    ]
    sources.forEach(({ index, src }) => {
      const image = new Image()
      images.push(image)
      image.onload = () => {
        if (disposed) return
        gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, textures[index])
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
        loaded++
        if (loaded === 5) { resize(); setReady(true); start() }
      }
      image.onerror = () => {
        console.error(`Depth layer could not load: ${src}`)
      }
      image.src = src
    })
    // These are optional: the hero never waits for their download or decoding.
    const loadFlight = (index: number) => {
      const image = new Image()
      image.decoding = "async"
      images.push(image)
      image.onload = () => {
        if (disposed) return
        // Upload one sheet per frame; each stays within 2048px on either axis.
        flightUpload = requestAnimationFrame(() => {
          if (disposed) return
          gl.activeTexture(gl.TEXTURE0 + 6 + index); gl.bindTexture(gl.TEXTURE_2D, textures[6 + index])
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
          flightLoaded++
          if (index === 0) loadFlight(1)
          else { canvas.dataset.cloudFlightReady = "true"; start() }
        })
      }
      image.onerror = () => { canvas.dataset.cloudFlightReady = "fallback"; console.warn("Cloud flight sheet unavailable; retaining the lightweight cloud transition") }
      image.src = index === 0 ? "/dreamcore-cloud-flight-01.webp" : "/dreamcore-cloud-flight-02.webp"
    }
    if (gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 2016 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canvas.dataset.cloudFlightReady = "loading"
      loadFlight(0)
    } else canvas.dataset.cloudFlightReady = "fallback"
    const visibility = () => {
      videos.current.forEach((video, index) => {
        if (!video) return
        if (!document.hidden && playing.current && (index === loop.current.primary || loop.current.blending)) video.play().catch(error => { if (!(error instanceof DOMException && error.name === "AbortError")) console.warn("Cloud playback unavailable", error) })
        else video.pause()
      })
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastTime = 0 }
      else start()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(flightUpload); observer.disconnect()
      startRef.current = null
      if (input?.current.requestRender === start) delete input.current.requestRender
      document.removeEventListener("visibilitychange", visibility)
      videos.current.forEach((video, index) => { if (videoCallbacks[index] && typeof video?.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(videoCallbacks[index]) })
      images.forEach(image => { image.onload = null; image.onerror = null })
      textures.forEach(texture => gl.deleteTexture(texture))
      gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment)
    }
  }, [input])

  return <div className={className} aria-hidden="true" data-scene-layers="sky,cloud-sea,type,photographer,meadow,near-cloud,scroll-cloud-flight,live-gallery">
    {[0, 1].map(index => <video key={index} ref={video => { videos.current[index] = video }} src={cloudFilm}
      muted playsInline loop autoPlay={isPlaying && index === loop.current.primary} preload="auto" disablePictureInPicture style={{ ...layerStyle, opacity: 0 }}
      onLoadedData={() => {
        const video = videos.current[index]
        if (video && playing.current && !document.hidden && (index === loop.current.primary || loop.current.blending)) video.play().catch(error => { if (!(error instanceof DOMException && error.name === "AbortError")) console.warn("Cloud playback unavailable", error) })
        else video?.pause()
        startRef.current?.()
      }} />)}
    <img src="/dreamcore-cloud-photographer.webp" alt="" decoding="async" style={{ ...layerStyle, opacity: "var(--scene-presence,1)" }} />
    <canvas ref={canvasRef} data-ready={ready} style={{ ...layerStyle, opacity: ready ? 1 : 0, transition: "opacity 400ms ease" }} />
  </div>
}
