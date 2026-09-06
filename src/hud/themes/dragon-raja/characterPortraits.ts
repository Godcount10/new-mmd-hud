/**
 * Character name to portrait URL. Portraits are theme assets keyed by name, never supplied by the
 * assistant: accepting a URL from generated text would be an open content-loading hole. Only these
 * strings ship in the bundle; the bytes live on the asset host.
 *
 * Placeholders for now - replace the values as real URLs arrive.
 */
const PORTRAITS: Readonly<Record<string, string>> = Object.freeze({})

/**
 * Resolved at render time so an unknown name degrades to the fallback rather than a broken image.
 * Returns an empty string when neither is configured, and the UI then draws its CSS placeholder.
 */
export function portraitFor(name: string): string {
  const key = name.trim()
  if (!key) return fallbackPortrait()
  return PORTRAITS[key] || fallbackPortrait()
}

function fallbackPortrait(): string {
  return ''
}
