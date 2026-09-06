import { createApp, type App } from 'vue'
import type { HudFeatureContext } from '../features/types'
import type { HudRenderer } from './types'
import DragonRajaHudApp from './dragon-raja/DragonRajaHudApp.vue'
import dragonRajaStyles from '../hud/themes/dragon-raja/dragon-raja.css?inline'
import { dragonRajaMediaCss } from '../hud/themes/dragon-raja/media'
import { createDragonRajaContext } from './dragon-raja/dragonRajaContext'

/** Mounts the migrated Dragon Raja theme into the stage supplied by the new SDK. */
export function createDragonRajaStageRenderer(): HudRenderer {
  return {
    id: 'dragon-raja-hud',
    mount(context: HudFeatureContext) {
      let mountPoint: HTMLElement | null = null
      let app: App<Element> | null = null
      let style: HTMLStyleElement | null = null
      const dragonContext = createDragonRajaContext(context)

      const mount = (): void => {
        if (mountPoint?.isConnected) return
        const stage = context.platform.sdk.stage.el()
        if (!stage) return

        if (!style?.isConnected) {
          style?.remove()
          style = context.document.createElement('style')
          style.dataset.hudStyle = 'dragon-raja'
          style.textContent = `${dragonRajaStyles}\n${dragonRajaMediaCss()}`
          context.document.head.appendChild(style)
        }

        mountPoint = context.document.createElement('div')
        mountPoint.dataset.hudMount = 'dragon-raja'
        // The official stage owns the viewport, while this wrapper must provide
        // an explicit containing block for the theme's height:100% root.
        mountPoint.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:hidden'
        stage.appendChild(mountPoint)
        app = createApp(DragonRajaHudApp, { hudContext: dragonContext })
        app.mount(mountPoint)
      }

      const readyCleanup = context.events.on('ready', mount)
      mount()

      return () => {
        readyCleanup()
        app?.unmount()
        mountPoint?.remove()
        style?.remove()
        app = null
        mountPoint = null
        style = null
      }
    },
  }
}
