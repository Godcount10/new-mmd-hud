import { createApp, type App } from 'vue'
import type { HudFeatureContext } from '../features/types'
import type { HudRenderer } from './types'
import OrangeHudApp from './orangeHud/OrangeHudApp.vue'
import { orangeHudStyles } from './orangeHudStyles'

/** Vue-backed HUD renderer. Domain state remains framework-neutral. */
export function createOrangeHudRenderer(): HudRenderer {
  return {
    id: 'orange-command-hud',
    mount(context) {
      let mountPoint: HTMLElement | null = null
      let app: App<Element> | null = null
      let style: HTMLStyleElement | null = null

      const mount = (): void => {
        if (mountPoint?.isConnected) return
        if (mountPoint && !mountPoint.isConnected) {
          app?.unmount()
          mountPoint = null
          app = null
        }
        const stage = context.platform.sdk.stage.el()
        if (!stage) return

        if (!style?.isConnected) {
          style?.remove()
          style = context.document.createElement('style')
          style.dataset.hudStyle = 'orange-command-hud'
          style.textContent = orangeHudStyles
          context.document.head.appendChild(style)
        }

        mountPoint = context.document.createElement('div')
        mountPoint.dataset.hudMount = 'orange-command-hud'
        stage.appendChild(mountPoint)
        app = createApp(OrangeHudApp, { context })
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
