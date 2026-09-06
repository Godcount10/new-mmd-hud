import type { StringMap } from '@esotericsoftware/spine-core'

export type SpineSkeletonType = 'json' | 'binary'

export type SpineInlinePackage = {
  skeleton: string
  atlas: string
}

/**
 * A host-neutral Spine asset description.
 *
 * `skeleton`, `atlas`, and atlas page names are resolved relative to
 * `basePath`, unless absolute URLs are supplied. `inline` is intended for
 * small development fixtures; production Nikke assets should be supplied by
 * the user or hosted at a URL they are allowed to use.
 */
export type SpineAssetConfig = {
  runtimeVersion?: '4.0' | '4.1'
  id: string
  label: string
  basePath?: string
  skeleton: string
  skeletonType?: SpineSkeletonType
  atlas: string
  textureAliases?: Record<string, string>
  /** Browser script that registers an inline skeleton/atlas package. */
  externalScript?: string
  /** Key used in window.__MMD_SPINE_PACKAGES__. Defaults to id. */
  externalPackage?: string
  inline?: {
    skeleton?: string
    atlas?: string
    textures?: Record<string, string>
  }
  animation?: string
  /** Optional setup skin. Some Nikke packages keep art outside the default skin. */
  skin?: string
  loop?: boolean
  scale?: number
  premultipliedAlpha?: boolean
  source?: 'inline-demo' | 'local' | 'remote' | 'user-provided'
  licenseNote?: string
}

export type SpineCatalogEntry = {
  /** Stable character code used by the source library, for example c010. */
  id: string
  name: string
  thumbnail?: string
  estimatedBytes: number
  asset: SpineAssetConfig
  category?: 'character' | 'other'
  variants?: SpineVariant[]
}

export type SpineVariant = {
  id: string
  label: string
  estimatedBytes: number
  asset: SpineAssetConfig
  animations?: string[]
  skins?: string[]
}

export type SpineLoadStatus =
  | { state: 'loading'; label: string }
  | { state: 'ready'; label: string; animations: string[]; skins: string[] }
  | { state: 'error'; label: string; message: string; errors?: StringMap<string> }

export type SpinePlayer = {
  readonly ready: Promise<string[]>
  play(animation?: string, loop?: boolean): boolean
  setSkin(name: string): boolean
  setPaused(paused: boolean): void
  setZoom(zoom: number): void
  resize(): void
  dispose(): void
}

declare global {
  interface Window {
    /** Packages registered by CSP-compatible external model scripts. */
    __MMD_SPINE_PACKAGES__?: Record<string, SpineInlinePackage>
    /** Optional host-provided asset config used by the production bundle. */
    __MMD_SPINE_ASSET__?: SpineAssetConfig
    /** Default asset selected by the local preview or production entry. */
    __MMD_DEFAULT_SPINE_ASSET__?: SpineAssetConfig
    /** Character choices shown before any Spine package is requested. */
    __MMD_SPINE_CATALOG__?: SpineCatalogEntry[]
    /** Explicit embedding/test override, separate from the last mounted catalog. */
    __MMD_SPINE_CATALOG_OVERRIDE__?: SpineCatalogEntry[]
    __MMD_SPINE_GAME_CATALOGS__?: Record<string, SpineCatalogEntry[]>
  }
}
