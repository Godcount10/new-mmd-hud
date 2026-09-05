import { createApp, type App } from 'vue'
import type { HudFeatureContext } from '../features/types'
import type { HudRenderer } from './types'
import SpineStageApp from './spine/SpineStageApp.vue'
import { spineStageStyles } from './spineStageStyles'

/** Renderer used by the current MMD stage: one full-screen Spine character only. */
export function createSpineStageRenderer(): HudRenderer {
  return {
    id: 'nikke-spine-stage',
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
          style.dataset.hudStyle = 'nikke-spine-stage'
          style.textContent = spineStageStyles
          context.document.head.appendChild(style)
        }

        mountPoint = context.document.createElement('div')
        mountPoint.dataset.hudMount = 'nikke-spine-stage'
        stage.appendChild(mountPoint)
        app = createApp(SpineStageApp, { context })
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

