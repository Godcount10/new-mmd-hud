import type { Live2DAssets, Live2DCatalogEntry, Live2DPacket } from './types'

export function assetUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}/${path}`
}

export async function loadLive2DPacket(assets: Live2DAssets, entry: Live2DCatalogEntry,
  document: Document, signal: AbortSignal): Promise<Live2DPacket> {
  signal.throwIfAborted()
  const hostWindow = document.defaultView!
  try {
  for (const path of entry.packagePaths) {
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    let timer: ReturnType<typeof setTimeout>
    const cleanup = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      script.onload = script.onerror = null
      script.remove()
    }
    const abort = () => { cleanup(); reject(new DOMException('Loading cancelled', 'AbortError')) }
    script.src = assetUrl(assets.baseUrl, path)
    script.async = true
    script.dataset.live2dPackage = entry.id
    script.onload = () => { cleanup(); resolve() }
    script.onerror = () => { cleanup(); reject(new Error('模型包下载失败，请检查网络后重试。')) }
    timer = setTimeout(() => { cleanup(); reject(new Error('模型包下载超时，请稍后重试。')) }, 60000)
    signal.addEventListener('abort', abort, { once: true })
    document.head.appendChild(script)
  })
  }
  signal.throwIfAborted()
  const parts = hostWindow.__MMD_LIVE2D_PARTS__?.[entry.id]
  if (!parts || parts.length !== entry.packagePaths.length || parts.some(part => typeof part !== 'string')) throw new Error('模型包分片不完整。')
  const packet = JSON.parse(parts.join('')) as Live2DPacket
  if (packet?.id !== entry.id || packet.version !== 1 || !packet.settings || !packet.files) throw new Error('模型包格式不正确。')
  return packet
  } finally { delete hostWindow.__MMD_LIVE2D_PARTS__?.[entry.id] }
}
