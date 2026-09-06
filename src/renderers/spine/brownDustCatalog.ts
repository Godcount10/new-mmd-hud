import type { SpineCatalogEntry } from './spineTypes'
import { brownDustCatalogRows } from './brownDustCatalog.generated'

export const localBrownDustCatalog: SpineCatalogEntry[] = brownDustCatalogRows.map(entry => ({
  ...entry,
  asset: { ...entry.asset, source: 'local' },
  variants: entry.variants?.map(variant => ({ ...variant, asset: { ...variant.asset, source: 'local' } })),
}))
