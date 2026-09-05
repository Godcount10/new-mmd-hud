#!/usr/bin/env node
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { basename, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const models = resolve(root, '../mmd-spine-models/models')
const output = join(root, 'release-assets')
await mkdir(join(output, 'packages'), { recursive: true })
await mkdir(join(root, 'reports'), { recursive: true })
const runtimes = {}
for (const [version, module] of [['4.0', '@esotericsoftware/spine-webgl'], ['4.1', 'spine-webgl-41']]) {
  const result = await build({ stdin: { contents: `export * from '${module}'`, resolveDir: root },
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' })
  runtimes[version] = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const legacy = 'nikke-spine-library', latest = 'nikke-db-2026-08-26'
const oldIndex = JSON.parse(await readFile(join(models, legacy, 'source-manifest.json'), 'utf8'))
const newIndex = JSON.parse(await readFile(join(models, latest, 'source-index.json'), 'utf8'))
const oldNames = JSON.parse(await readFile(join(models, legacy, 'source-names.json'), 'utf8'))
const names = new Map()
for (const filename of ['Characters.json', 'Character_icon.json', 'l2d.json']) {
  for (const row of JSON.parse(await readFile(join(models, latest, 'js/json', filename), 'utf8'))) {
    if (row.id && row.name) names.set(String(row.id), row.name)
  }
}
const entries = new Map(), errors = [], variants = [], duplicates = []
const signatures = new Map()
for (const [source, index] of [[latest, newIndex], [legacy, oldIndex]]) {
  const files = new Map(index.files.map(file => [file.path.replaceAll('\\', '/'), file]))
  for (const path of [...files.keys()].filter(path => path.endsWith('.skel')).sort()) {
    try {
      const id = path.split('/')[source === latest ? 1 : 0]
      const bytes = await readFile(join(models, source, path))
      const input = new runtimes['4.0'].BinaryInput(bytes)
      input.readInt32(); input.readInt32()
      const editorVersion = input.readString()
      const runtimeVersion = editorVersion.split('.').slice(0, 2).join('.')
      const spine = runtimes[runtimeVersion]
      if (!spine) throw new Error(`Unsupported Spine ${editorVersion}`)
      let atlasPath = path.replace(/\.skel$/, '.atlas')
      if (!files.has(atlasPath)) {
        const candidates = [...files.keys()].filter(file => file.endsWith('.atlas') && posix.dirname(file) === posix.dirname(path))
        if (candidates.length !== 1) throw new Error(`Cannot uniquely pair atlas: ${path}`)
        atlasPath = candidates[0]
      }
      const atlasBytes = await readFile(join(models, source, atlasPath))
      const atlas = new spine.TextureAtlas(atlasBytes.toString('utf8'))
      const textures = []
      const signature = createHash('sha256').update(bytes).update(atlasBytes)
      for (const page of atlas.pages) {
        const texturePath = posix.join(posix.dirname(path), page.name)
        const png = await readFile(join(models, source, texturePath))
        const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
        signature.update(png)
        textures.push({ path: `${source}/${texturePath}`, bytes: png.length,
          width, height, atlasWidth: page.width, atlasHeight: page.height })
        page.setTexture(new spine.FakeTexture({ width: page.width || width, height: page.height || height }))
      }
      const hash = signature.digest('hex')
      const previous = signatures.get(`${id}:${hash}`)
      if (previous) { duplicates.push({ source, path, sameAs: previous }); continue }
      const data = runInNewContext('parse()', {
        parse: () => new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(bytes),
      }, { timeout: 10000 })
      const skins = data.skins.map(skin => skin.name)
      const animations = data.animations.map(animation => animation.name)
      const skin = skins.includes('00') ? '00' : skins.includes('default') ? 'default' : skins[0]
      const animation = animations.find(name => /^idle$/i.test(name)) ?? animations.find(name => /idle/i.test(name)) ?? animations[0]
      const packageId = `nikke-${hash.slice(0, 20)}`
      const packageSource = `(()=>{(globalThis.__MMD_SPINE_PACKAGES__??=Object.create(null))[${JSON.stringify(packageId)}]=${JSON.stringify({
        skeleton: `data:application/octet-stream;base64,${bytes.toString('base64')}`,
        atlas: `data:text/plain;charset=utf-8;base64,${atlasBytes.toString('base64')}`,
      })}})();\n`
      await writeFile(join(output, 'packages', `${packageId}.js`), packageSource)
      const estimatedBytes = Buffer.byteLength(packageSource) + textures.reduce((sum, texture) => sum + texture.bytes, 0)
      const pose = /(?:^|[/_])aim(?:[/_]|$)/i.test(path) ? '瞄准' : /(?:^|[/_])cover(?:[/_]|$)/i.test(path) ? '掩体'
        : /skill/i.test(path) ? '技能' : '立绘'
      const label = `${pose} · ${source === latest ? '新版' : '旧版'} · ${basename(path, '.skel')}`
      const asset = { id: packageId, label, runtimeVersion, basePath: `/_model-files/${source}/${posix.dirname(path)}/`,
        skeleton: basename(path), skeletonType: 'binary', atlas: basename(atlasPath),
        externalScript: `/_model-release/packages/${packageId}.js`, externalPackage: packageId,
        animation, skin, loop: true, scale: 1, premultipliedAlpha: true, source: 'local' }
      const variant = { id: packageId, label, estimatedBytes, asset, animations, skins }
      signatures.set(`${id}:${hash}`, `${source}/${path}`)
      variants.push({ ...variant, directoryId: id, source, path, textures, editorVersion })
      let entry = entries.get(id)
      if (!entry) {
        const oldName = oldNames[id]?.name
        entry = { id, name: oldName && oldName.toLowerCase() !== id.toLowerCase() ? oldName : names.get(id) ?? id.toUpperCase(),
          category: /^c\d/.test(id) ? 'character' : 'other', variants: [] }
        entries.set(id, entry)
      }
      entry.variants.push(variant)
    } catch (error) { errors.push({ source, path, error: error.message }) }
  }
  console.log(`Parsed ${source}: ${variants.length} unique variants, ${errors.length} errors`)
}
// The old demo is byte-identical to c203 in the new snapshot, not an extra character.
const catalog = [...entries.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
for (const entry of catalog) {
  entry.variants.sort((a, b) => (a.label.startsWith('立绘') ? 0 : 1) - (b.label.startsWith('立绘') ? 0 : 1))
  entry.name = entry.id === 'c203' ? '露菲：冬日购物狂' : entry.name
  const first = entry.variants[0]
  entry.asset = { ...first.asset, label: entry.name }
  entry.estimatedBytes = first.estimatedBytes
  const thumbnail = `thumbnails/${encodeURIComponent(entry.id)}.webp`
  try { await stat(join(output, thumbnail)); entry.thumbnail = `/_model-release/${thumbnail}` } catch { /* Generated separately. */ }
}
await writeFile(join(output, 'catalog.local.json'), JSON.stringify(catalog))
const rows = catalog.map(entry => [entry.id, entry.name, entry.category, Boolean(entry.thumbnail),
  entry.variants.map(row => [row.id, row.label, row.asset.runtimeVersion,
    row.asset.basePath.slice('/_model-files/'.length), row.asset.skeleton, row.asset.atlas,
    row.asset.animation ?? null, row.asset.skin ?? null, row.estimatedBytes])])
await writeFile(join(root, 'src/renderers/spine/nikkeCatalog.generated.ts'),
  `import type { CatalogRow } from './spineCatalog'\n// Generated by scripts/generate-spine-catalog.mjs.\nexport const catalogRows = ${JSON.stringify(rows)} as CatalogRow[]\n`)
const report = { generatedAt: new Date().toISOString(), directories: catalog.length,
  variants: variants.length, runtime40: variants.filter(row => row.asset.runtimeVersion === '4.0').length,
  runtime41: variants.filter(row => row.asset.runtimeVersion === '4.1').length,
  duplicates, errors, textureMismatches: variants.filter(row => row.textures.some(p => p.width !== p.atlasWidth || p.height !== p.atlasHeight)).map(row => row.id), models: variants }
await writeFile(join(root, 'reports/catalog-audit.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ directories: catalog.length, variants: variants.length, duplicates: duplicates.length, errors, output }, null, 2))
if (errors.length) process.exitCode = 1
