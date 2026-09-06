import { MARKER_PATTERN } from './parseDerivedMarkers'

/**
 * Strips `[key=value]` markers from prose. Applied per text node rather than to the whole HTML
 * string, so a bracket inside an attribute value can never be mangled. Runs for assistant turns
 * only - a reader's own square brackets are left exactly as typed.
 */
function stripMarkers(text: string): string {
  MARKER_PATTERN.lastIndex = 0
  return text.replace(MARKER_PATTERN, '')
}

export function sanitizeMessageHtml(html: string, stripDerivedMarkers = false): string {
  const template = document.createElement('template')
  template.innerHTML = html
  const allowed = new Set(['P', 'BR', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'SMALL', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'HR', 'CODE', 'PRE', 'DIV', 'FONT'])
  const forbidden = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'INPUT', 'TEXTAREA', 'BUTTON', 'LINK', 'META'])
  /* Containers that would leave a visible gap in the prose if markers were their only content. */
  const collapsible = new Set(['P', 'DIV', 'SPAN', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'LI', 'SMALL', 'STRONG', 'B', 'EM', 'I'])
  const output = document.createElement('div')

  function copy(source: Node, target: Node): void {
    if (source.nodeType === Node.TEXT_NODE) {
      const value = source.nodeValue || ''
      target.appendChild(document.createTextNode(stripDerivedMarkers ? stripMarkers(value) : value))
      return
    }
    if (!(source instanceof HTMLElement) || forbidden.has(source.tagName)) return
    if (!allowed.has(source.tagName)) {
      source.childNodes.forEach((child) => copy(child, target))
      return
    }
    const tag = source.tagName === 'FONT' ? 'span' : source.tagName.toLowerCase()
    const clean = document.createElement(tag)
    const color = source.tagName === 'FONT' ? source.getAttribute('color') : source.style.color
    if (color) {
      const probe = document.createElement('span')
      probe.style.color = color
      if (probe.style.color) clean.style.color = probe.style.color
    }
    source.childNodes.forEach((child) => copy(child, clean))
    /*
     * A paragraph holding nothing but markers would otherwise survive as an empty box and open a
     * gap in the prose. Void and self-meaningful tags (br, hr, img) are never dropped.
     */
    if (stripDerivedMarkers && collapsible.has(clean.tagName) && !clean.textContent?.trim() && !clean.querySelector('br, hr, img')) return
    target.appendChild(clean)
  }

  template.content.childNodes.forEach((node) => copy(node, output))
  return output.innerHTML
}
