import type { HudInstance } from '../types'
import type { Live2DAssets } from '../../renderers/live2d/types'
import { createLive2DStageRenderer } from '../../renderers/live2dStageRenderer'
import { catalog } from './catalog.generated'
import release from '../../../live2d-release.json'

const assets: Live2DAssets = {
  baseUrl: `https://cdn.jsdelivr.net/gh/${release.repository}@${release.ref}/${release.packageDirectory}/`, catalog,
}
export const instance: HudInstance = {
  id: 'live2d',
  createModules: hostWindow => ({ renderers: [createLive2DStageRenderer(hostWindow.__MMD_LIVE2D_ASSETS_OVERRIDE__ ?? assets)] }),
}
