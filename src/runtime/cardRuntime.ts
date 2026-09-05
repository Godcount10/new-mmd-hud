import type { CardDefinition, CardRule } from '../types'

export type CompiledCard = {
  definition: CardDefinition
  statusbarHtml: string
  styles: string[]
  scripts: string[]
  warnings: string[]
}

type ReplacementMatch = {
  groups: string[]
  named: Record<string, string>
}

export function compileCard(definition: CardDefinition): CompiledCard {
  const styles: string[] = []
  const scripts: string[] = []
  const warnings: string[] = []
  const rules = definition.rules ?? []

  for (const rule of rules) {
    const fragments = extractFragments(rule.replaceString)
    styles.push(...fragments.styles)
    scripts.push(...fragments.scripts)
  }

  const statusbar = applyRules(definition.statusbar, rules, warnings)
  const statusbarFragments = extractFragments(statusbar)
  styles.push(...statusbarFragments.styles)
  scripts.push(...statusbarFragments.scripts)

  return {
    definition,
    statusbarHtml: sanitizeCardHtml(statusbarFragments.html),
    styles,
    scripts,
    warnings,
  }
}

export function renderMessage(content: string, rules: CardRule[], warnings: string[] = []): string {
  const replaced = applyRules(content, rules, warnings)
  return sanitizeCardHtml(extractFragments(replaced).html)
}

function applyRules(input: string, rules: CardRule[], warnings: string[]): string {
  let output = input
  for (const rule of rules) {
    const pattern = parsePattern(rule.findRegex)
    if (!pattern) {
      warnings.push(`规则“${rule.name ?? rule.scriptName ?? '未命名'}”的正则无效，已跳过`)
      continue
    }
    try {
      output = output.replace(pattern, (...args: unknown[]) => {
        const lastArgument = args[args.length - 1]
        const hasNamedGroups = typeof lastArgument === 'object' && lastArgument !== null
        const match = args[0]
        const groups = args.slice(1, hasNamedGroups ? -3 : -2).map((value) => value == null ? '' : String(value))
        const matchedText = typeof match === 'string' ? match : ''
        return replaceTokens(rule.replaceString, {
          groups,
          named: parseNamedPairs(matchedText),
        })
      })
    } catch (error) {
      warnings.push(`规则“${rule.name ?? rule.scriptName ?? '未命名'}”执行失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
  return output
}

function parsePattern(source: string): RegExp | null {
  const trimmed = source.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    const end = trimmed.lastIndexOf('/')
    const expression = trimmed.slice(1, end)
    const flags = trimmed.slice(end + 1).replaceAll('g', '') + 'g'
    try {
      return new RegExp(expression, flags)
    } catch {
      return null
    }
  }
  return new RegExp(escapeRegExp(trimmed), 'g')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceTokens(template: string, match: ReplacementMatch): string {
  return template
    .replace(/\$(\d+)/g, (_, index: string) => match.groups[Number(index) - 1] ?? '')
    .replace(/\$([\u4e00-\u9fffA-Za-z][\w\u4e00-\u9fff]*)/g, (_, name: string) => match.named[name] ?? `$${name}`)
}

function parseNamedPairs(value: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of value.split(';;')) {
    const separator = pair.indexOf('::')
    if (separator <= 0) continue
    const key = pair.slice(0, separator).trim()
    if (key) result[key] = pair.slice(separator + 2).trim()
  }
  return result
}

type ExtractedFragments = { html: string; styles: string[]; scripts: string[] }

function extractFragments(source: string): ExtractedFragments {
  const styles: string[] = []
  const scripts: string[] = []
  let html = source
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, content: string) => {
      styles.push(content)
      return ''
    })
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_, attributes: string, content: string) => {
      const srcMatch = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
      scripts.push(srcMatch ? `/* external script skipped by local host: ${srcMatch[1]} */` : content)
      return ''
    })
  return { html, styles, scripts }
}

const ALLOWED_TAGS = new Set([
  'div', 'span', 'p', 'b', 'i', 'strong', 'em', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'tr', 'th', 'td', 'pre', 'code', 'blockquote', 'button', 'input',
  'textarea', 'label', 'select', 'option', 'img', 'video', 'details', 'summary', 'svg', 'path',
  'circle', 'rect', 'line', 'text', 'mark', 'small', 'sub', 'sup', 'u', 's', 'del', 'font',
])

const FORBIDDEN_TAGS = new Set(['iframe', 'link', 'meta', 'form', 'object', 'embed', 'base', 'noscript'])
const ALLOWED_ATTRIBUTES = new Set([
  'class', 'id', 'style', 'title', 'type', 'value', 'href', 'src', 'alt', 'width', 'height',
  'checked', 'selected', 'disabled', 'readonly', 'maxlength', 'rows', 'cols', 'placeholder',
  'for', 'role', 'aria-label', 'aria-hidden', 'onclick',
])

export function sanitizeCardHtml(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = markdownHintToHtml(html)
  const output = document.createElement('div')

  const copyNode = (source: Node, target: Node): void => {
    if (source.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(source.nodeValue ?? ''))
      return
    }
    if (source.nodeType !== Node.ELEMENT_NODE) return
    const sourceElement = source as HTMLElement
    const tag = sourceElement.tagName.toLowerCase()
    if (FORBIDDEN_TAGS.has(tag)) return
    if (!ALLOWED_TAGS.has(tag)) {
      sourceElement.childNodes.forEach((child) => copyNode(child, target))
      return
    }
    const clean = document.createElement(tag)
    for (const attribute of [...sourceElement.attributes]) {
      if (!ALLOWED_ATTRIBUTES.has(attribute.name.toLowerCase()) && !attribute.name.startsWith('data-chat') && !attribute.name.startsWith('data-slot')) continue
      if (attribute.name.startsWith('data-') && !attribute.name.startsWith('data-chat') && !attribute.name.startsWith('data-slot')) continue
      if ((attribute.name === 'href' || attribute.name === 'src') && !/^(https?:|data:image\/)/i.test(attribute.value)) continue
      clean.setAttribute(attribute.name, attribute.value)
    }
    sourceElement.childNodes.forEach((child) => copyNode(child, clean))
    target.appendChild(clean)
  }

  template.content.childNodes.forEach((node) => copyNode(node, output))
  return output.innerHTML
}

function markdownHintToHtml(source: string): string {
  if (!source.includes('**')) return source
  return source.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}
