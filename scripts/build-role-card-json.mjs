#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(ROOT, 'dist-hud')
const SOURCE_FILE = join(DIST_DIR, 'mmd-hud.js')

// MMD accepts at most 20,000 characters in one replacement. Keep the same
// 18,000-character safety line as the original project's inline builder.
const MAX_REPLACEMENT_LENGTH = 20_000
const SAFE_REPLACEMENT_LENGTH = 18_000
const RULE_PREFIX = '【MMD HUD 注入 '
const RULE_SUFFIX = '】'
const STATE_KEY = '__MMD_HUD_JSON_STATE__'
const RULE_WRAPPER_OVERHEAD = 256

function buildId() {
  const configured = process.env.MMD_HUD_BUILD_ID?.trim()
  return configured || `hud-${Date.now()}`
}

function placeholder(index) {
  return `${RULE_PREFIX}${String(index).padStart(3, '0')}${RULE_SUFFIX}`
}

function encodeJavaScriptString(value) {
  // The chunks are later placed inside a script element. Escaping '<' keeps a
  // source sequence such as </script> from terminating that element early.
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('$', '\\u0024')
}

function appendChunk(chunk, chunkIndex) {
  const encoded = encodeJavaScriptString(chunk)
  const next = placeholder(chunkIndex + 2)
  return `<script>(()=>{const s=globalThis.${STATE_KEY}??=Object.create(null);s.p??=[];s.p[${chunkIndex}]=${encoded};})()</script>${next}`
}

function splitSource(source) {
  const chunks = []
  let offset = 0
  let index = 0

  while (offset < source.length) {
    let length = Math.min(source.length - offset, SAFE_REPLACEMENT_LENGTH - RULE_WRAPPER_OVERHEAD)
    let replacement = appendChunk(source.slice(offset, offset + length), index)

    // JSON escaping can make a chunk larger than its source slice. Adjust the
    // slice until the complete replacement is below the safety line.
    while (replacement.length > SAFE_REPLACEMENT_LENGTH && length > 1) {
      length = Math.max(1, length - Math.ceil((replacement.length - SAFE_REPLACEMENT_LENGTH) * 1.1))
      replacement = appendChunk(source.slice(offset, offset + length), index)
    }

    if (replacement.length > SAFE_REPLACEMENT_LENGTH) {
      throw new Error(`第 ${index + 1} 个 HUD 片段超过 ${SAFE_REPLACEMENT_LENGTH} 字符安全线`)
    }

    chunks.push({
      index,
      source: source.slice(offset, offset + length),
      replacement,
    })
    offset += length
    index += 1
  }

  return chunks
}

function startReplacement(id, partCount) {
  const encodedId = JSON.stringify(id)
  const replacement = `<script>(()=>{const s=globalThis.${STATE_KEY};if(!s||!Array.isArray(s.p)||s.p.length<${partCount})throw new Error('MMD HUD bundle incomplete');if(s.started===${encodedId})return;for(let i=0;i<${partCount};i++)if(typeof s.p[i]!=='string')throw new Error('MMD HUD bundle part missing');const code=s.p.slice(0,${partCount}).join('');if(!code)throw new Error('MMD HUD bundle is empty');const e=document.createElement('script');e.dataset.mmdHudJson=${encodedId};e.textContent=code;(document.head||document.documentElement).appendChild(e);s.started=${encodedId};})()</script>`
  if (replacement.length > SAFE_REPLACEMENT_LENGTH) {
    throw new Error(`HUD 启动片段超过 ${SAFE_REPLACEMENT_LENGTH} 字符安全线`)
  }
  return replacement
}

function createRules(source, id) {
  const chunks = splitSource(source)
  if (chunks.length === 0) {
    throw new Error('mmd-hud.js 为空，无法生成注入规则')
  }

  const scripts = chunks.map((chunk) => ({
    id: -1,
    replaceString: chunk.replacement,
    scriptName: `MMD HUD 注入 ${String(chunk.index + 1).padStart(3, '0')}`,
    findRegex: placeholder(chunk.index + 1),
  }))
  const startIndex = scripts.length + 1
  scripts.push({
    id: -1,
    replaceString: startReplacement(id, chunks.length),
    scriptName: 'MMD HUD 注入 启动',
    findRegex: placeholder(startIndex),
  })

  return { chunks, scripts }
}

function validateRules(source, chunks, scripts) {
  if (chunks.map((chunk) => chunk.source).join('') !== source) {
    throw new Error('HUD 源码分块后无法还原原始 bundle')
  }

  for (const [index, script] of scripts.entries()) {
    if (script.replaceString.length > MAX_REPLACEMENT_LENGTH) {
      throw new Error(`规则 ${index + 1} 超过 ${MAX_REPLACEMENT_LENGTH} 字符平台限制`)
    }
    if (script.findRegex !== placeholder(index + 1)) {
      throw new Error(`规则 ${index + 1} 的占位符顺序错误`)
    }
    if (index < scripts.length - 1 && !script.replaceString.includes(placeholder(index + 2))) {
      throw new Error(`规则 ${index + 1} 没有连接到下一条占位符`)
    }

    const scriptEnd = script.replaceString.lastIndexOf('</script>')
    const scriptBody = script.replaceString.slice('<script>'.length, scriptEnd)
    if (scriptBody.includes('</script>')) {
      throw new Error(`规则 ${index + 1} 的脚本正文包含未转义的 </script>`)
    }
  }

  const last = scripts.at(-1)
  if (!last || last.replaceString.includes(RULE_PREFIX)) {
    throw new Error('启动规则不应再包含后续占位符')
  }
}

const id = buildId()
const source = await readFile(SOURCE_FILE, 'utf8')
const release = JSON.parse(await readFile(join(ROOT, 'spine-release.json'), 'utf8'))
const { chunks, scripts } = createRules(source, id)
validateRules(source, chunks, scripts)

const importData = {
  pageDepth: 2,
  statusbar: scripts[0].findRegex,
  beginning: '',
  regex_scripts: scripts,
}
const placeholders = `${scripts.map((script) => script.findRegex).join('')}\n`
const replacementLengths = scripts.map((script) => script.replaceString.length)
const manifest = {
  modelRelease: release,
  version: 1,
  format: 'mmd-regex-role-card',
  buildId: id,
  sourceFile: 'mmd-hud.js',
  sourceCharacters: source.length,
  sourceBytes: Buffer.byteLength(source, 'utf8'),
  maxReplacementLength: MAX_REPLACEMENT_LENGTH,
  safeReplacementLength: SAFE_REPLACEMENT_LENGTH,
  largestReplacementLength: Math.max(...replacementLengths),
  bundleParts: chunks.length,
  totalRules: scripts.length,
  entry: scripts.at(-1).findRegex,
  generatedFiles: {
    importJson: 'mmd-hud.json',
    placeholders: 'mmd-hud-placeholders.txt',
    manifest: 'mmd-hud-manifest.json',
  },
}

await mkdir(DIST_DIR, { recursive: true })
const notices = []
for (const dependency of ['@esotericsoftware/spine-webgl', 'spine-webgl-41', 'vue', 'lucide-vue-next']) {
  notices.push(`${dependency}\n\n${await readFile(join(ROOT, 'node_modules', dependency, 'LICENSE'), 'utf8')}`)
}
await writeFile(join(DIST_DIR, 'THIRD-PARTY-LICENSES.txt'), notices.join('\n\n--------------------\n\n'))
await Promise.all([
  writeFile(join(DIST_DIR, 'mmd-hud.json'), `${JSON.stringify(importData, null, 2)}\n`, 'utf8'),
  writeFile(join(DIST_DIR, 'mmd-hud-placeholders.txt'), placeholders, 'utf8'),
  writeFile(join(DIST_DIR, 'mmd-hud-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
])

console.log(`Generated ${scripts.length} MMD regex rules in ${DIST_DIR}`)
console.log(`Bundle parts: ${chunks.length}; largest replacement: ${manifest.largestReplacementLength}/${MAX_REPLACEMENT_LENGTH}`)
if (!release.published) console.warn(`Model release ${release.repository}@${release.ref} is NOT published. New remote models require the files in release-assets/publish-manifest.json.`)
