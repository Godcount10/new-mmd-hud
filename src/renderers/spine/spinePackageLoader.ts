import type { SpineAssetConfig } from './spineTypes'

/** Use script-src + img-src, not cross-origin fetch, in the official stage. */
export async function resolveSpineAssetConfig(config: SpineAssetConfig, document: Document,
  fallbackWindow: Window, signal?: AbortSignal): Promise<SpineAssetConfig> {
  if (signal?.aborted) throw new DOMException('Loading cancelled', 'AbortError')
  if (!config.externalScript) return config
  const hostWindow = document.defaultView ?? fallbackWindow
  const key = config.externalPackage ?? config.id
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    let timer: ReturnType<typeof setTimeout>
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      script.onload = script.onerror = null
      script.remove()
    }
    const abort = () => { cleanup(); reject(new DOMException('Loading cancelled', 'AbortError')) }
    script.onload = () => { cleanup(); resolve() }
    script.onerror = () => { cleanup(); reject(new Error('模型包加载失败，请检查资源是否已发布或稍后重试。')) }
    script.src = config.externalScript!
    script.async = true
    script.dataset.mmdSpinePackage = key
    timer = setTimeout(() => { cleanup(); reject(new Error('模型包加载超时，请检查网络后重试。')) }, 45000)
    signal?.addEventListener('abort', abort, { once: true })
    ;(document.head ?? document.documentElement).appendChild(script)
  })
  if (signal?.aborted) throw new DOMException('Loading cancelled', 'AbortError')
  const data = hostWindow.__MMD_SPINE_PACKAGES__?.[key]
  if (!data?.skeleton || !data.atlas) throw new Error(`模型包没有注册有效数据：${key}`)
  // Keep binary strings only for the current player. HTTP cache handles revisits.
  delete hostWindow.__MMD_SPINE_PACKAGES__![key]
  return { ...config, inline: { ...config.inline, skeleton: data.skeleton, atlas: data.atlas } }
}
