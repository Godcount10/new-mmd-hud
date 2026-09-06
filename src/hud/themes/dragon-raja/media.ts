export interface DragonRajaMediaManifest {
  welcomePosterUrl: string
  cassellCrestUrl: string
  storyDesktopUrl: string
  storyMobileUrl: string
  storyPosterUrl: string
  alchemyAssetsUrl: string
  localMapUrl: string
  codexAssetsUrl: string
  paperGrainUrl: string
  brushFontUrl: string
  storySerifFontUrl: string
  storySansFontUrl: string
  storyMonoFontUrl: string
}

const emptyManifest: DragonRajaMediaManifest = {
  welcomePosterUrl: '',
  cassellCrestUrl: '',
  storyDesktopUrl: '',
  storyMobileUrl: '',
  storyPosterUrl: '',
  alchemyAssetsUrl: '',
  localMapUrl: '',
  codexAssetsUrl: '',
  paperGrainUrl: '',
  brushFontUrl: '',
  storySerifFontUrl: '',
  storySansFontUrl: '',
  storyMonoFontUrl: '',
}

const injectedManifest = typeof __DRAGON_RAJA_MEDIA__ === 'undefined'
  ? emptyManifest
  : __DRAGON_RAJA_MEDIA__

export const DRAGON_RAJA_MEDIA: Readonly<DragonRajaMediaManifest> = Object.freeze({
  welcomePosterUrl: injectedManifest.welcomePosterUrl.trim(),
  cassellCrestUrl: injectedManifest.cassellCrestUrl.trim(),
  storyDesktopUrl: injectedManifest.storyDesktopUrl.trim(),
  storyMobileUrl: injectedManifest.storyMobileUrl.trim(),
  storyPosterUrl: injectedManifest.storyPosterUrl.trim(),
  alchemyAssetsUrl: injectedManifest.alchemyAssetsUrl.trim(),
  localMapUrl: injectedManifest.localMapUrl.trim(),
  codexAssetsUrl: injectedManifest.codexAssetsUrl.trim(),
  paperGrainUrl: injectedManifest.paperGrainUrl.trim(),
  brushFontUrl: (injectedManifest.brushFontUrl ?? '').trim(),
  storySerifFontUrl: injectedManifest.storySerifFontUrl.trim(),
  storySansFontUrl: injectedManifest.storySansFontUrl.trim(),
  storyMonoFontUrl: injectedManifest.storyMonoFontUrl.trim(),
})

export function dragonRajaMediaCss(): string {
  const rootDeclarations = [
    cssUrlDeclaration('--dr-welcome-poster-image', DRAGON_RAJA_MEDIA.welcomePosterUrl),
    cssUrlDeclaration('--dr-story-image-desktop', DRAGON_RAJA_MEDIA.storyDesktopUrl),
    cssUrlDeclaration('--dr-story-image-mobile', DRAGON_RAJA_MEDIA.storyMobileUrl || DRAGON_RAJA_MEDIA.storyDesktopUrl),
    cssUrlDeclaration('--dr-story-image-poster', DRAGON_RAJA_MEDIA.storyPosterUrl),
    cssUrlDeclaration('--dr-alchemy-assets', DRAGON_RAJA_MEDIA.alchemyAssetsUrl),
    cssUrlDeclaration('--dr-local-map-image', DRAGON_RAJA_MEDIA.localMapUrl),
    cssUrlDeclaration('--dr-codex-assets', DRAGON_RAJA_MEDIA.codexAssetsUrl),
    cssUrlDeclaration('--dr-paper-grain', DRAGON_RAJA_MEDIA.paperGrainUrl),
    fontFamilyDeclaration(
      '--dr-font-serif',
      DRAGON_RAJA_MEDIA.storySerifFontUrl,
      '"DragonRaja Serif Remote","DragonRaja Serif","Noto Serif SC",SimSun,serif',
    ),
    fontFamilyDeclaration(
      '--dr-font-sans',
      DRAGON_RAJA_MEDIA.storySansFontUrl,
      '"DragonRaja Sans Remote","DragonRaja Sans","Segoe UI","Microsoft YaHei",system-ui,sans-serif',
    ),
    fontFamilyDeclaration(
      '--dr-font-mono',
      DRAGON_RAJA_MEDIA.storyMonoFontUrl,
      '"DragonRaja Mono Remote","DragonRaja Mono",Consolas,monospace',
    ),
    fontFamilyDeclaration(
      '--dr-font-brush',
      DRAGON_RAJA_MEDIA.brushFontUrl,
      '"DragonRaja Brush Remote","DragonRaja Brush"',
    ),
  ].filter(Boolean)

  const fontFaces = [
    fontFaceRule('DragonRaja Brush Remote', DRAGON_RAJA_MEDIA.brushFontUrl),
    fontFaceRule('DragonRaja Serif Remote', DRAGON_RAJA_MEDIA.storySerifFontUrl),
    fontFaceRule('DragonRaja Sans Remote', DRAGON_RAJA_MEDIA.storySansFontUrl),
    fontFaceRule('DragonRaja Mono Remote', DRAGON_RAJA_MEDIA.storyMonoFontUrl),
  ].filter(Boolean)

  const rootRule = rootDeclarations.length ? `:root{${rootDeclarations.join('')}}` : ''
  return `${fontFaces.join('')}${rootRule}`
}

function cssUrlDeclaration(name: string, value: string): string {
  if (!value) return ''
  return `${name}:url("${escapeCssString(value)}");`
}

function fontFamilyDeclaration(name: string, url: string, value: string): string {
  return url ? `${name}:${value};` : ''
}

function fontFaceRule(family: string, url: string): string {
  if (!url) return ''
  return `@font-face{font-family:"${family}";src:url("${escapeCssString(url)}") format("${fontFormat(url)}");font-display:swap;font-style:normal;font-weight:400 700;}`
}

function fontFormat(url: string): string {
  let pathname = url.toLowerCase()
  try {
    pathname = new URL(url, 'http://localhost').pathname.toLowerCase()
  } catch {
    // Keep the raw value for non-URL font references.
  }
  if (pathname.endsWith('.ttf')) return 'truetype'
  if (pathname.endsWith('.woff')) return 'woff'
  return 'woff2'
}

function escapeCssString(value: string): string {
  return value.replace(/["\\\n\r\f]/g, (character) => {
    if (character === '"') return '\\"'
    if (character === '\\') return '\\\\'
    if (character === '\n') return '\\a '
    if (character === '\r') return '\\d '
    return '\\c '
  })
}
