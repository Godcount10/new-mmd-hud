#!/usr/bin/env node
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LIBRARY = resolve(ROOT, '../mmd-spine-models/models/nikke-db-2026-08-26')
const index = JSON.parse(await readFile(join(LIBRARY, 'source-index.json'), 'utf8'))
const bundled = await build({ stdin: { contents: 'export * from "@esotericsoftware/spine-core"', resolveDir: ROOT },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' })
const spine = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
const indexedPaths = new Set(index.files.map((file) => file.path))
const verifiedPaths = new Set()
const problems = []
const models = []
const versions = {}
const fileTypes = {}
let verifiedBytes = 0

// Read source metadata as data only; unknown and stale names stay explicit.
const names = new Map()
for (const filename of ['Characters.json', 'Character_icon.json', 'l2d.json']) {
  for (const entry of JSON.parse(await readFile(join(LIBRARY, 'js/json', filename), 'utf8'))) {
    if (typeof entry.id === 'string' && typeof entry.name === 'string') names.set(entry.id, entry.name)
  }
}

for (const file of index.files) {
  fileTypes[extname(file.path)] = (fileTypes[extname(file.path)] ?? 0) + 1
  try {
    const bytes = await readFile(join(LIBRARY, file.path))
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
    if (bytes.length !== file.size || hash !== file.sha) throw new Error('Source size or Git blob SHA-1 mismatch')
    verifiedPaths.add(file.path)
    verifiedBytes += bytes.length
  } catch (error) { problems.push({ path: file.path, error: error.message }) }
}

for (const file of index.files.filter((entry) => entry.path.endsWith('.skel'))) {
  if (!verifiedPaths.has(file.path)) continue
  const id = file.path.split('/')[1]
  const row = { path: file.path, directoryId: id, name: names.get(id) ?? null, warnings: [] }
  try {
    const bytes = await readFile(join(LIBRARY, file.path))
    const input = new spine.BinaryInput(bytes)
    input.readInt32()
    input.readInt32()
    row.version = input.readString()
    if (!/^\d+\.\d+\.\d+/.test(row.version ?? '')) throw new Error('Unrecognized skeleton header')
    versions[row.version] = (versions[row.version] ?? 0) + 1
    row.requiresRuntime = row.version.split('.').slice(0, 2).join('.')
    row.currentRuntimeSupported = row.requiresRuntime === '4.0'
    const atlasPath = `${file.path.slice(0, -5)}.atlas`
    if (!indexedPaths.has(atlasPath)) throw new Error(`Matching atlas absent from source: ${atlasPath}`)
    if (!verifiedPaths.has(atlasPath)) throw new Error(`Atlas not verified: ${atlasPath}`)
    const atlas = new spine.TextureAtlas(await readFile(join(LIBRARY, atlasPath), 'utf8'))
    if (!atlas.pages.length) throw new Error('Atlas has no texture pages')
    row.texturePages = []
    for (const page of atlas.pages) {
      const texturePath = posix.join(dirname(atlasPath).replaceAll('\\', '/'), page.name)
      if (!indexedPaths.has(texturePath) || !verifiedPaths.has(texturePath)) throw new Error(`Texture absent or unverified: ${texturePath}`)
      const texture = await readFile(join(LIBRARY, texturePath))
      if (!texture.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`Texture is not a PNG: ${texturePath}`)
      const width = texture.readUInt32BE(16), height = texture.readUInt32BE(20)
      row.texturePages.push({ path: texturePath, width, height, atlasWidth: page.width, atlasHeight: page.height, pma: page.pma })
      if (width !== page.width || height !== page.height) row.warnings.push(`Atlas/texture dimensions differ; verify UV mapping: ${texturePath}`)
      page.setTexture(new spine.FakeTexture({ width, height }))
    }
    // Never try to interpret a 4.1 binary body with a 4.0 runtime.
    if (row.currentRuntimeSupported) {
      const data = runInNewContext('parse()', {
        parse: () => new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(bytes),
      }, { timeout: 3000 })
      row.skins = data.skins.map((skin) => skin.name)
      row.animations = data.animations.map((animation) => animation.name)
      row.parsedWithCurrentRuntime = true
    }
  } catch (error) {
    row.error = error.message
  }
  models.push(row)
}

const directories = [...new Set(index.files.filter((file) => file.path.startsWith('l2d/')).map((file) => file.path.split('/')[1]))]
const characterDirectories = directories.filter((id) => /^c\d/.test(id))
const summary = { expectedFiles: index.fileCount, verifiedFiles: verifiedPaths.size, verifiedBytes,
  integrityComplete: verifiedPaths.size === index.fileCount && !problems.length,
  fileTypes, directories: directories.length, characterStyleDirectories: characterDirectories.length,
  otherDirectories: directories.length - characterDirectories.length,
  exactNamedDirectories: directories.filter((id) => names.has(id)).length,
  unnamedDirectoryIds: directories.filter((id) => !names.has(id)),
  versions, skeletons: models.length,
  currentRuntimeParsed: models.filter((row) => row.parsedWithCurrentRuntime).length,
  requiresOtherRuntime: models.filter((row) => row.currentRuntimeSupported === false).length,
  textureDimensionWarnings: models.filter((row) => row.warnings.length).length,
  modelErrors: models.filter((row) => row.error).map(({ path, error }) => ({ path, error })),
  oldRupee: models.filter((row) => row.directoryId === 'c203') }
const report = { auditedAt: new Date().toISOString(), repository: index.repository, commit: index.commit,
  scope: 'File SHA-1, skeleton headers, atlas/PNG dependencies; full parse only for Spine 4.0. Not a visual compatibility guarantee.',
  summary, fileProblems: problems, models }
const target = join(LIBRARY, 'inventory-report.json')
await writeFile(target, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...summary, unnamedDirectoryIds: summary.unnamedDirectoryIds.length,
  oldRupee: summary.oldRupee.map(({ path, version, error }) => ({ path, version, error })),
  fileProblems: problems.length, report: target }, null, 2))
if (!summary.integrityComplete || summary.modelErrors.length) process.exitCode = 1
