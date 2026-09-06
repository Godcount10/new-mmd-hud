import type { HudInstance } from '../types'
import { createSpineStageRenderer } from '../../renderers/spineStageRenderer'
import { remoteNikkeCatalog, remoteNikkeSpineConfig } from '../../renderers/spine/nikkeAssets'

export const instance: HudInstance = {
  id: 'nikke',
  createModules(hostWindow) {
    hostWindow.__MMD_DEFAULT_SPINE_ASSET__ = remoteNikkeSpineConfig
    hostWindow.__MMD_SPINE_CATALOG__ = hostWindow.__MMD_SPINE_CATALOG_OVERRIDE__ ?? remoteNikkeCatalog
    hostWindow.__MMD_SPINE_GAME_CATALOGS__ = { nikke: hostWindow.__MMD_SPINE_CATALOG__ }
    return { renderers: [createSpineStageRenderer()] }
  },
}
