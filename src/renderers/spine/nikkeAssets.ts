import type { SpineAssetConfig, SpineCatalogEntry } from './spineTypes'
import { createNikkeCatalog } from './spineCatalog'
import release from '../../../spine-release.json'

const REMOTE_BASE =
  'https://cdn.jsdelivr.net/gh/Godcount10/mmd-models@v1.0.1/models/nikke-rupee-winter-shopper/1.0.0/'

/** Local files are used by the Vite preview; production can load the same files from HTTPS. */
export const localNikkeSpineConfig: SpineAssetConfig = {
  id: 'nikke-rupee-winter-shopper',
  label: 'RUPEE / WINTER SHOPPER',
  basePath: '/spine/nikke-rupee/',
  skeleton: 'c203_00.skel',
  skeletonType: 'binary',
  atlas: 'c203_00.atlas',
  animation: 'idle',
  loop: true,
  scale: 0.35,
  premultipliedAlpha: true,
  source: 'local',
  licenseNote: 'Local development asset from the public nikke-rupee-winter-viewer repository.',
}

export const remoteNikkeSpineConfig: SpineAssetConfig = {
  ...localNikkeSpineConfig,
  basePath: REMOTE_BASE,
  skeleton: 'c203_00.skel',
  atlas: 'c203_00.atlas',
  externalScript: `${REMOTE_BASE}model.js`,
  externalPackage: 'nikke-rupee-winter-shopper',
  source: 'remote',
  licenseNote: 'Remote asset hosted in the Godcount10/mmd-models v1.0.1 repository.',
}

export const publishedNikkeCatalog: SpineCatalogEntry[] = [
  {
    id: 'c203',
    name: '露菲：冬日购物狂',
    estimatedBytes: 4_730_000,
    asset: remoteNikkeSpineConfig,
  },
]

const releaseRoot = `https://cdn.jsdelivr.net/gh/${release.repository}@${release.ref}/`
export const remoteNikkeCatalog = createNikkeCatalog(`${releaseRoot}models/`, `${releaseRoot}${release.packageDirectory}/`, 'remote')
// Keep the already published original demo playable before the new library release.
const rupee = remoteNikkeCatalog.find(entry => entry.id === 'c203')
if (rupee) {
  rupee.variants?.unshift({ id: remoteNikkeSpineConfig.id, label: '已发布 · 冬日购物狂', estimatedBytes: 4_730_000, asset: remoteNikkeSpineConfig })
  rupee.asset = remoteNikkeSpineConfig
  rupee.estimatedBytes = 4_730_000
}
