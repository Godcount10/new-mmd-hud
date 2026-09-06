import { Application, ShaderSystem, Texture, Renderer, settings as pixiSettings } from 'pixi.js'
import { install } from '@pixi/unsafe-eval'
import { ensureCubismCore } from './core'
import { assetUrl, loadLive2DPacket } from './packageLoader'
import type { Live2DAssets, Live2DCatalogEntry, Live2DPacket, Live2DPlayer } from './types'

const memory = new Map<string, Live2DPacket['files'][string]>()
let loaderInstalled = false
let sequence = 0
install({ ShaderSystem })

function imageResource(url: string, document: Document, signal: AbortSignal): Promise<HTMLImageElement> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const image = document.createElement('img')
    let timer: ReturnType<typeof setTimeout>
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); image.onload = image.onerror = null }
    const abort = () => { cleanup(); image.removeAttribute('src'); reject(new DOMException('Loading cancelled', 'AbortError')) }
    image.crossOrigin = 'anonymous'
    image.onload = () => { cleanup(); resolve(image) }
    image.onerror = () => { cleanup(); reject(new Error(`贴图下载失败：${url.split('/').pop()}`)) }
    timer = setTimeout(() => { cleanup(); image.removeAttribute('src'); reject(new Error('贴图下载超时，请重试。')) }, 60000)
    signal.addEventListener('abort', abort, { once:true })
    image.src = url
  })
}

export async function createLive2DPlayer(canvas: HTMLCanvasElement, assets: Live2DAssets,
  entry: Live2DCatalogEntry, signal: AbortSignal, onProgress: (label: string) => void): Promise<Live2DPlayer> {
  signal.throwIfAborted()
  onProgress('下载模型数据')
  const packet = await loadLive2DPacket(assets, entry, canvas.ownerDocument, signal)
  ensureCubismCore()
  // Cubism's module reads Core during initialization; keep this import after Core installation.
  const { Live2DModel, Live2DLoader, Live2DFactory, MotionPriority, MotionPreloadStrategy } = await import('pixi-live2d-display/cubism4')
  signal.throwIfAborted()
  if (!loaderInstalled) {
    Live2DLoader.middlewares.unshift(async (context, next) => {
      const url = context.settings?.resolveURL(context.url) ?? context.url
      if (!url.startsWith('https://mmd-live2d.invalid/')) return next()
      const file = memory.get(url)
      if (!file) throw new Error(`模型包缺少数据：${url}`)
      context.result = file.encoding === 'json' ? structuredClone(file.data)
        : Uint8Array.from(atob(file.data), char => char.charCodeAt(0)).buffer
    })
    loaderInstalled = true
  }
  // No fetch, blob XHR or service worker: Cubism dependencies are served from this in-memory package.
  const virtualBase = `https://mmd-live2d.invalid/${++sequence}/`
  const keys = Object.keys(packet.files).map(path => {
    const key = new URL(path, virtualBase).href
    memory.set(key, packet.files[path])
    return key
  })
  const source = structuredClone(packet.settings)
  source.url = `${virtualBase}model.model3.json`
  source.FileReferences.Textures = source.FileReferences.Textures.map(path => new URL(assetUrl(assets.baseUrl, path), canvas.ownerDocument.baseURI).href)
  pixiSettings.CREATE_IMAGE_BITMAP = false
  let app: Application | undefined
  const model = new Live2DModel({ autoUpdate: false, autoInteract: false })
  let disposed = false, paused = false, zoom = 1, panX = 0, panY = 0
  let width = 1, height = 1
  let drag: { id: number; x: number; y: number } | null = null
  const doc = canvas.ownerDocument
  const win = doc.defaultView!
  const cleanups: Array<() => void> = []
  const textureController = new AbortController()
  const textures: Texture[] = []
  const dispose = () => {
    if (disposed) return
    disposed = true
    textureController.abort()
    for (const cleanup of cleanups) cleanup()
    signal.removeEventListener('abort', dispose)
    if (model.internalModel) model.destroy({ texture: false })
    for (const texture of textures) texture.destroy(true)
    app?.destroy(false, { children: false, texture: true, baseTexture: true })
    for (const key of keys) memory.delete(key)
  }
  signal.addEventListener('abort', dispose, { once: true })
  try {
    onProgress('加载贴图与物理数据')
    app = new Application({ view: canvas, width: 1, height: 1,
      resolution: Math.min(win.devicePixelRatio || 1, 2), autoDensity: true,
      backgroundAlpha: 0, antialias: true, autoStart: false, sharedTicker: false, preserveDrawingBuffer: true })
    const gl = (app.renderer as Renderer).gl
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    // Load through image-src with real cancellation; downscale only beyond the device's GPU limit.
    source.FileReferences.Textures = await Promise.all(source.FileReferences.Textures.map(async (url, index) => {
      const image = await imageResource(url, doc, textureController.signal)
      textureController.signal.throwIfAborted()
      let resource: HTMLImageElement | HTMLCanvasElement = image
      if (Math.max(image.naturalWidth, image.naturalHeight) > maxTexture) {
        const scale = maxTexture / Math.max(image.naturalWidth, image.naturalHeight)
        const reduced = doc.createElement('canvas')
        reduced.width = Math.max(1, Math.floor(image.naturalWidth * scale))
        reduced.height = Math.max(1, Math.floor(image.naturalHeight * scale))
        reduced.getContext('2d')!.drawImage(image, 0, 0, reduced.width, reduced.height)
        resource = reduced
      }
      const key = `${virtualBase}texture/${index}`
      const texture = Texture.from(resource)
      Texture.addToCache(texture, key)
      textures.push(texture)
      return key
    }))
    const refs = source.FileReferences as typeof source.FileReferences & { Motions?: Record<string, unknown[]> }
    const groups = Object.keys(refs.Motions ?? {})
    const idleGroup = groups.find(group => group.toLowerCase() === 'idle') ?? groups[0]
    await Live2DFactory.setupLive2DModel(model, source, {
      autoUpdate: false, autoInteract: false, motionPreload: MotionPreloadStrategy.ALL,
      idleMotionGroup: idleGroup, crossOrigin: 'anonymous',
    })
    signal.throwIfAborted()
    if (disposed) throw new DOMException('Loading cancelled', 'AbortError')
    app.stage.addChild(model)
    model.anchor.set(0.5, 0.5)
    const naturalWidth = model.internalModel.width
    const naturalHeight = model.internalModel.height
    if (!(naturalWidth > 0 && naturalHeight > 0)) throw new Error('模型尺寸无效。')
    const camera = () => {
      if (disposed || !app) return
      model.scale.set(Math.min(width / naturalWidth, height / naturalHeight) * 0.95 * zoom)
      model.position.set(width / 2 + panX, height / 2 + panY)
      app.renderer.render(app.stage)
    }
    const resize = () => {
      if (disposed || !app) return
      const rect = canvas.parentElement!.getBoundingClientRect()
      width = Math.max(1, rect.width); height = Math.max(1, rect.height)
      app.renderer.resize(width, height)
      camera()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas.parentElement!)
    cleanups.push(() => observer.disconnect())
    const visibility = () => { if (paused || doc.hidden) app?.stop(); else app?.start() }
    doc.addEventListener('visibilitychange', visibility)
    cleanups.push(() => doc.removeEventListener('visibilitychange', visibility))
    app.ticker.maxFPS = 60
    app.ticker.add(() => { if (!disposed) model.update(Math.min(app!.ticker.deltaMS, 50)) })
    resize()
    if (idleGroup) await model.motion(idleGroup, 0, MotionPriority.FORCE)
    signal.throwIfAborted()
    visibility()
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
    }
    const pointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      panX += event.clientX - drag.x; panY += event.clientY - drag.y
      drag.x = event.clientX; drag.y = event.clientY
      camera()
    }
    const pointerEnd = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      drag = null
    }
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerEnd)
    canvas.addEventListener('pointercancel', pointerEnd)
    cleanups.push(() => {
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerEnd)
      canvas.removeEventListener('pointercancel', pointerEnd)
    })
    const expressions = model.internalModel.motionManager.expressionManager?.definitions ?? []
    return {
      motions: groups.flatMap(group => (refs.Motions![group] ?? []).map((_, index) => ({ group, index,
        label: refs.Motions![group].length > 1 ? `${group} ${index + 1}` : group }))),
      expressions: expressions.map((row: { Name?: string; name?: string }, index: number) => row.Name ?? row.name ?? String(index)),
      play: (group, index) => disposed ? Promise.resolve(false) : model.motion(group, index, MotionPriority.FORCE),
      expression: name => disposed ? Promise.resolve(false) : model.expression(name),
      setPaused(value) { paused = value; visibility() },
      setZoom(value) { zoom = Math.max(0.25, Math.min(3, value)); camera() },
      resetCamera() { zoom = 1; panX = 0; panY = 0; camera() },
      dispose,
    }
  } catch (error) { dispose(); throw error }
}
