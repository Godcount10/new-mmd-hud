import { catalogRows } from './nikkeCatalog.generated'
import type { SpineCatalogEntry, SpineVariant } from './spineTypes'

type VariantRow = [string, string, '4.0' | '4.1', string, string, string, string | null, string | null, number]
export type CatalogRow = [string, string, 'character' | 'other', boolean, VariantRow[]]

/** URL roots are supplied by each entry point; catalog data stays environment-neutral. */
export function createNikkeCatalog(modelRoot: string, packageRoot: string, source: 'local' | 'remote'): SpineCatalogEntry[] {
  return catalogRows.map(([id, name, category, thumbnail, rows]) => {
    const variants: SpineVariant[] = rows.map(([key, label, runtimeVersion, path, skeleton, atlas, animation, skin, estimatedBytes]) => ({
      id: key, label, estimatedBytes,
      asset: { id: key, label: `${name} / ${label}`, runtimeVersion, basePath: `${modelRoot}${path}`,
        skeleton, atlas, skeletonType: 'binary', animation: animation ?? undefined, skin: skin ?? undefined,
        externalScript: `${packageRoot}packages/${key}.js`, externalPackage: key,
        scale: 1, loop: true, premultipliedAlpha: true, source },
    }))
    return { id, name, category, variants, asset: variants[0].asset, estimatedBytes: variants[0].estimatedBytes,
      thumbnail: thumbnail ? `${packageRoot}thumbnails/${encodeURIComponent(id)}.webp` : undefined }
  }).sort((a, b) => Number(a.category !== 'character') - Number(b.category !== 'character'))
}
