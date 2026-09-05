import * as spine40 from '@esotericsoftware/spine-webgl'
import * as spine41 from 'spine-webgl-41'
import { animationBounds, cameraFit, textureSize, type Bounds } from './spineGeometry'
import type { SpineAssetConfig, SpineLoadStatus, SpinePlayer } from './spineTypes'

export type SpineRendererCallbacks = {
  onStatus?: (status: SpineLoadStatus) => void
  onFrame?: (gl: WebGLRenderingContext, fit: ReturnType<typeof cameraFit>) => void
}

export function mountSpineRenderer(canvas: HTMLCanvasElement, config: SpineAssetConfig,
  callbacks: SpineRendererCallbacks = {}): SpinePlayer {
  const version = config.runtimeVersion ?? '4.0'
  // A narrow compatibility boundary; no skeleton, texture or renderer crosses versions.
  const spine = (version === '4.1' ? spine41 : spine40) as unknown as typeof spine40
  const document = canvas.ownerDocument
  const host = document.defaultView!
  const controller = new AbortController()
  let renderer: spine40.SceneRenderer | null = null
  let gl: WebGLRenderingContext | null = null
  const textures: spine40.GLTexture[] = []
  let skeleton: spine40.Skeleton | null = null
  let state: spine40.AnimationState | null = null
  let disposed = false, failed = false, paused = false, zoom = 1, frame = 0, last = 0
  let animation = config.animation, skin = config.skin
  let bounds: Bounds = { x: -50, y: -50, width: 100, height: 100 }
  const fits = new Map<string, Bounds>()
  const setStatus = (status: SpineLoadStatus) => { if (!disposed) callbacks.onStatus?.(status) }
  const abortError = () => new DOMException('Loading cancelled', 'AbortError')
  const check = () => { if (controller.signal.aborted || disposed) throw abortError() }
  const base = new URL(config.basePath ?? './', document.baseURI).href
  const url = (path: string) => new URL(path, base).href

  function inlineBytes(uri: string): Uint8Array {
    const comma = uri.indexOf(',')
    if (comma < 0 || !uri.slice(0, comma).endsWith(';base64')) throw new Error('Unsupported inline encoding')
    return Uint8Array.from(host.atob(uri.slice(comma + 1)), char => char.charCodeAt(0))
  }
  async function data(path: string, inline?: string): Promise<Uint8Array> {
    if (inline) return inlineBytes(inline)
    const response = await host.fetch(url(path), { signal: controller.signal })
    if (!response.ok) throw new Error(`资源请求失败：${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  }
  function loadImage(path: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = document.createElement('img')
      const cleanup = () => { image.onload = image.onerror = null; controller.signal.removeEventListener('abort', abort) }
      const abort = () => { cleanup(); image.removeAttribute('src'); reject(abortError()) }
      image.crossOrigin = 'anonymous'
      image.onload = () => { cleanup(); resolve(image) }
      image.onerror = () => { cleanup(); reject(new Error('纹理加载失败，请检查图片外链与 CORS 设置。')) }
      controller.signal.addEventListener('abort', abort, { once: true })
      image.src = path
      if (controller.signal.aborted) abort()
    })
  }
  function refit(): void {
    if (!skeleton) return
    const key = `${skin ?? ''}\0${animation ?? ''}`
    if (!fits.has(key)) fits.set(key, animationBounds(spine, skeleton.data, version, skin, animation))
    bounds = fits.get(key)!
    resize()
  }
  function resize(): void {
    if (!renderer || !gl || disposed) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(2, Math.max(1, host.devicePixelRatio || 1))
    const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    gl.viewport(0, 0, width, height)
    const fit = cameraFit(bounds, width, height, zoom)
    renderer.camera.setViewport(width, height)
    renderer.camera.position.x = fit.x
    renderer.camera.position.y = fit.y
    renderer.camera.zoom = fit.zoom
  }
  function render(time: number): void {
    if (disposed || failed || !renderer || !gl || !skeleton || !state) return
    try {
      const delta = last ? Math.min((time - last) / 1000, 0.05) : 0
      last = time
      if (!paused && !document.hidden) state.update(delta)
      state.apply(skeleton)
      skeleton.updateWorldTransform()
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      renderer.begin()
      renderer.drawSkeleton(skeleton, config.premultipliedAlpha ?? false)
      renderer.end()
      callbacks.onFrame?.(gl, { x: renderer.camera.position.x, y: renderer.camera.position.y, zoom: renderer.camera.zoom })
      frame = host.requestAnimationFrame(render)
    } catch (error) { fail(error) }
  }
  function release(): void {
    host.cancelAnimationFrame(frame)
    textures.splice(0).forEach(texture => texture.dispose())
    renderer?.dispose()
    renderer = null
    skeleton = null
    state = null
    fits.clear()
  }
  function fail(error: unknown): void {
    if (disposed || failed) return
    failed = true
    controller.abort()
    release()
    setStatus({ state: 'error', label: config.label, message: error instanceof Error ? error.message : String(error) })
  }
  function contextLost(event: Event): void {
    event.preventDefault()
    fail(new Error('图形上下文已丢失，请重新加载模型。'))
  }
  canvas.addEventListener('webglcontextlost', contextLost)
  const ready = (async () => {
    setStatus({ state: 'loading', label: config.label })
    const timeout = setTimeout(() => controller.abort(), 90000)
    try {
      const binary = await data(config.skeleton, config.inline?.skeleton)
      const atlasBytes = await data(config.atlas, config.inline?.atlas)
      check()
      if ((config.skeletonType ?? 'json') === 'binary') {
        const input = new spine.BinaryInput(binary)
        input.readInt32(); input.readInt32()
        const actualVersion = input.readString()
        if (!actualVersion?.startsWith(`${version}.`)) throw new Error(`骨骼 ${actualVersion} 与运行时 ${version} 不匹配`)
      }
      const context = new spine.ManagedWebGLRenderingContext(canvas, {
        alpha: true, premultipliedAlpha: false, antialias: true, preserveDrawingBuffer: false,
      })
      gl = context.gl
      renderer = new spine.SceneRenderer(canvas, context, true)
      const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
      const atlas = new spine.TextureAtlas(new TextDecoder().decode(atlasBytes))
      // Sequential texture loading bounds peak memory on mobile multi-page models.
      for (const page of atlas.pages) {
        const imagePath = config.textureAliases?.[page.name]
          ?? new URL(page.name, url(config.atlas)).href
        const image = await loadImage(config.inline?.textures?.[page.name] ?? url(imagePath))
        check()
        const width = page.width || image.naturalWidth, height = page.height || image.naturalHeight
        const size = textureSize(image.naturalWidth, image.naturalHeight, maxSize)
        let source: HTMLImageElement | HTMLCanvasElement = image
        if (size.width !== image.naturalWidth || size.height !== image.naturalHeight) {
          const scaled = document.createElement('canvas')
          scaled.width = size.width; scaled.height = size.height
          const ctx = scaled.getContext('2d')
          if (!ctx) throw new Error('无法缩放纹理')
          ctx.drawImage(image, 0, 0, size.width, size.height)
          source = scaled
        }
        // texImage2D supports canvas sources; the 4.0 declaration predates them.
        const texture = new spine.GLTexture(context, source as HTMLImageElement)
        textures.push(texture)
        // Atlas coordinates use logical export dimensions. GPU images can have been
        // resized by the source or this device; mesh UVs must use the same units.
        texture.getImage = () => ({ width, height } as HTMLImageElement)
        page.setTexture(texture)
        // NPOT pages must not use mipmaps/repeat in WebGL1.
        texture.setFilters(spine.TextureFilter.Linear, spine.TextureFilter.Linear)
        texture.setWraps(spine.TextureWrap.ClampToEdge, spine.TextureWrap.ClampToEdge)
      }
      check()
      const loader = new spine.AtlasAttachmentLoader(atlas)
      const parser = config.skeletonType === 'binary' ? new spine.SkeletonBinary(loader) : new spine.SkeletonJson(loader)
      parser.scale = config.scale ?? 1
      const skeletonData = config.skeletonType === 'binary'
        ? (parser as spine40.SkeletonBinary).readSkeletonData(binary)
        : (parser as spine40.SkeletonJson).readSkeletonData(new TextDecoder().decode(binary))
      skeleton = new spine.Skeleton(skeletonData)
      const skins = skeletonData.skins.map(row => row.name)
      if (skin && !skeletonData.findSkin(skin)) throw new Error(`缺少皮肤：${skin}`)
      skin ??= skins.includes('default') ? 'default' : skins[0]
      if (skin) skeleton.setSkinByName(skin)
      skeleton.setToSetupPose()
      state = new spine.AnimationState(new spine.AnimationStateData(skeletonData))
      const animations = skeletonData.animations.map(row => row.name)
      animation = animations.includes(animation ?? '') ? animation : animations[0]
      if (animation) state.setAnimation(0, animation, config.loop ?? true)
      state.apply(skeleton)
      skeleton.updateWorldTransform()
      refit()
      check()
      setStatus({ state: 'ready', label: config.label, animations, skins })
      frame = host.requestAnimationFrame(render)
      return animations
    } catch (error) { fail(error); throw error }
    finally { clearTimeout(timeout) }
  })()
  return { ready, resize,
    play(name = config.animation, loop = true) {
      if (!name || !state || !skeleton?.data.findAnimation(name)) return false
      animation = name
      skeleton.setToSetupPose()
      state.clearTracks()
      state.setAnimation(0, name, loop)
      refit()
      return true
    },
    setSkin(name) {
      if (!skeleton?.data.findSkin(name)) return false
      skin = name
      skeleton.setSkinByName(name)
      skeleton.setSlotsToSetupPose()
      refit()
      return true
    },
    setPaused(value) { paused = value },
    setZoom(value) { zoom = Math.max(0.5, Math.min(2, value)); resize() },
    dispose() {
      if (disposed) return
      disposed = true
      controller.abort()
      canvas.removeEventListener('webglcontextlost', contextLost)
      release()
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
      gl = null
    },
  }
}
