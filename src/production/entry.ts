import { HudRuntime } from '../hud/runtime'
import { createMmdPlatformAdapter } from '../platform/contracts'
import type { MmdSdk } from '../platform/sdk'
import { createSpineStageRenderer } from '../renderers/spineStageRenderer'
import { remoteNikkeCatalog, remoteNikkeSpineConfig } from '../renderers/spine/nikkeAssets'

type ProductionHudHandle = {
  runtime: HudRuntime
  destroy(): void
}

declare global {
  interface Window {
  sdk?: MmdSdk
  __MMD_HUD__?: ProductionHudHandle
  __MMD_DEFAULT_SPINE_ASSET__?: typeof remoteNikkeSpineConfig
  }
}

declare const sdk: MmdSdk | undefined

function mountProductionHud(): ProductionHudHandle | null {
  const globalSdk = window.sdk ?? (typeof sdk !== 'undefined' ? sdk : undefined)
  if (!globalSdk) {
    console.error('[MMD HUD] window.sdk is unavailable; bundle was not mounted')
    return null
  }

  window.__MMD_HUD__?.destroy()
  globalSdk.stage.open('full')
  window.__MMD_DEFAULT_SPINE_ASSET__ = remoteNikkeSpineConfig
  window.__MMD_SPINE_CATALOG__ = window.__MMD_SPINE_CATALOG_OVERRIDE__ ?? remoteNikkeCatalog
  const runtime = new HudRuntime({ platform: createMmdPlatformAdapter(window, globalSdk) })
  runtime.registerRenderer(createSpineStageRenderer())
  runtime.mount()

  const handle: ProductionHudHandle = {
    runtime,
    destroy: () => {
      runtime.dispose()
      if (window.__MMD_HUD__?.runtime === runtime) delete window.__MMD_HUD__
    },
  }
  window.__MMD_HUD__ = handle
  runtime.events.on('dispose', () => handle.destroy())
  globalSdk.debug.log('[MMD HUD] production bundle mounted', globalSdk.version)
  return handle
}

mountProductionHud()
