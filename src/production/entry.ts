import { HudRuntime } from '../hud/runtime'
import { createMmdPlatformAdapter } from '../platform/contracts'
import type { MmdSdk } from '../platform/sdk'
import { instance } from '@hud-instance'

type ProductionHudHandle = {
  runtime: HudRuntime
  destroy(): void
}

declare global {
  interface Window {
  sdk?: MmdSdk
  __MMD_HUD__?: ProductionHudHandle
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
  const runtime = new HudRuntime({ platform: createMmdPlatformAdapter(window, globalSdk) })
  const modules = instance.createModules(window)
  for (const feature of modules.features ?? []) runtime.registerFeature(feature)
  for (const renderer of modules.renderers ?? []) runtime.registerRenderer(renderer)
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
  globalSdk.debug.log('[MMD HUD] production bundle mounted', instance.id, globalSdk.version)
  return handle
}

mountProductionHud()
