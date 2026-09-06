import type { HudInstance } from '../types'
import { createSpineStageRenderer } from '../../renderers/spineStageRenderer'
import { localNikkeCatalog } from '../../renderers/spine/nikkeCatalog.local'
import { localNikkeSpineConfig } from '../../renderers/spine/nikkeAssets'
import { localBrownDustCatalog } from '../../renderers/spine/brownDustCatalog'

export const instance: HudInstance = {
  id: 'nikke',
  prepareLocalInjection(hostWindow) {
    hostWindow.__MMD_SPINE_CATALOG_OVERRIDE__ = localNikkeCatalog
    hostWindow.__MMD_SPINE_GAME_CATALOGS__ = { nikke: localNikkeCatalog, 'brown-dust-2': localBrownDustCatalog }
  },
  createModules(hostWindow) {
    hostWindow.__MMD_DEFAULT_SPINE_ASSET__ = localNikkeSpineConfig
    hostWindow.__MMD_SPINE_CATALOG__ = localNikkeCatalog
    hostWindow.__MMD_SPINE_GAME_CATALOGS__ = { nikke: localNikkeCatalog, 'brown-dust-2': localBrownDustCatalog }
    return { renderers: [createSpineStageRenderer()] }
  },
}
