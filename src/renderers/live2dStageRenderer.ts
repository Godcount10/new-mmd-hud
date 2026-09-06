import { createApp, type App } from 'vue'
import type { HudRenderer } from './types'
import type { Live2DAssets } from './live2d/types'
import Live2DStageApp from './live2d/Live2DStageApp.vue'
import styles from './live2d/styles.css?inline'

export function createLive2DStageRenderer(assets: Live2DAssets): HudRenderer {
  return {
    id: 'azur-lane-live2d',
    mount(context) {
      let mountPoint: HTMLElement | null = null
      let app: App | null = null
      let style: HTMLStyleElement | null = null
      const mount = () => {
        const stage = context.platform.sdk.stage.el()
        if (!stage || mountPoint?.isConnected) return
        app?.unmount()
        mountPoint?.remove()
        if (!style?.isConnected) {
          style = context.document.createElement('style')
          style.dataset.hudStyle = 'azur-lane-live2d'
          style.textContent = styles
          context.document.head.appendChild(style)
        }
        mountPoint = context.document.createElement('div')
        mountPoint.dataset.hudMount = 'azur-lane-live2d'
        stage.appendChild(mountPoint)
        app = createApp(Live2DStageApp, { context, assets })
        app.mount(mountPoint)
      }
      const off = context.events.on('ready', mount)
      mount()
      return () => { off(); app?.unmount(); mountPoint?.remove(); style?.remove() }
    },
  }
}
