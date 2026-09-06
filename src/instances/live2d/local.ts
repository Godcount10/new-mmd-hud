import type { HudInstance } from '../types'
import type { Live2DAssets } from '../../renderers/live2d/types'
import { createLive2DStageRenderer } from '../../renderers/live2dStageRenderer'
import { catalog } from './catalog.generated'

const assets: Live2DAssets = { baseUrl: '/_live2d-release/', catalog }
export const instance: HudInstance = {
  id: 'live2d',
  createModules: () => ({ renderers: [createLive2DStageRenderer(assets)] }),
  prepareLocalInjection(hostWindow) { hostWindow.__MMD_LIVE2D_ASSETS_OVERRIDE__ = assets },
}
