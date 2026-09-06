import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, posix, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = resolve(root, '../model-resources/azur-lane')
const repoRoot = resolve(root, '../mmd-live2d-models')
const release = JSON.parse(await readFile(join(root, 'live2d-release.json'), 'utf8'))
const target = resolve(repoRoot, release.packageDirectory)
const index = JSON.parse(await readFile(join(sourceRoot, 'source-index.json'), 'utf8'))
const prefix = `${index.treePath}/Azue Lane(JP)/`
const sourceFiles = new Map(index.files.map(file => [file.path, file]))
const caseFiles = new Map(index.files.map(file => [file.path.toLowerCase(), file.path]))
const models = index.files.filter(file => file.path.endsWith('.model3.json')).sort((a, b) => a.path.localeCompare(b.path, 'en'))
const entries = [], repairs = [], published = new Map()
const textureAliases = new Map()
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const gitHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const encodePath = path => path.split('/').map(encodeURIComponent).join('/')

await mkdir(join(root, 'reports'), { recursive: true })
await mkdir(join(root, 'src/instances/live2d'), { recursive: true })
if (!target.startsWith(`${repoRoot}${sep}`)) throw new Error('Invalid release directory')

async function writeAsset(path, bytes) {
  const absolute = resolve(target, path)
  if (!absolute.startsWith(`${target}${sep}`)) throw new Error('Invalid asset path')
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, bytes)
  published.set(`${release.packageDirectory}/${path}`, { path: `${release.packageDirectory}/${path}`, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) })
}

function resolveReference(modelPath, reference, optional = false) {
  if (typeof reference !== 'string' || !reference || /^[a-z]+:/i.test(reference) || reference.includes('\\')) throw new Error(`Invalid resource reference in ${modelPath}`)
  const requested = posix.normalize(posix.join(posix.dirname(modelPath), reference))
  let actual = sourceFiles.has(requested) ? requested : caseFiles.get(requested.toLowerCase())
  const repeated = `${posix.basename(posix.dirname(modelPath))}/`
  if (!actual && reference.startsWith(repeated)) {
    const corrected = posix.join(posix.dirname(modelPath), reference.slice(repeated.length))
    actual = sourceFiles.has(corrected) ? corrected : caseFiles.get(corrected.toLowerCase())
  }
  if (!actual) {
    const modelRoot = prefix + modelPath.slice(prefix.length).split('/')[0] + '/'
    const matches = [...sourceFiles.keys()].filter(path => path.startsWith(modelRoot)
      && posix.basename(path).toLowerCase() === posix.basename(reference).toLowerCase())
    if (matches.length === 1) actual = matches[0]
  }
  if (!actual) {
    if (!optional) throw new Error(`Missing required resource: ${requested}`)
    repairs.push({ model: modelPath, requested, action: 'omit-missing-motion' })
    return null
  }
  if (actual !== requested) repairs.push({ model: modelPath, requested, actual, action: 'resolve-reference' })
  return actual
}

async function readVerified(path) {
  const bytes = await readFile(join(sourceRoot, path))
  const file = sourceFiles.get(path)
  if (!file || bytes.length !== file.size || gitHash(bytes) !== file.sha) throw new Error(`Source integrity failed: ${path}`)
  return bytes
}

// Preserve all original files separately. Playback repairs only affect generated packages.
for (const file of index.files) {
  if (!file.path.startsWith(prefix)) continue
  const bytes = await readVerified(file.path)
  const destination = `raw/${file.path.slice(prefix.length)}`
  const path = join(target, destination)
  await mkdir(dirname(path), { recursive: true })
  try { await copyFile(join(sourceRoot, file.path), path, constants.COPYFILE_EXCL) }
  catch (error) {
    if (error.code !== 'EEXIST' || sha256(await readFile(path)) !== sha256(bytes)) throw error
  }
  published.set(`${release.packageDirectory}/${destination}`, { path: `${release.packageDirectory}/${destination}`, bytes: bytes.length, sha256: sha256(bytes) })
  if (file.path.endsWith('.png') && bytes.length > 19_000_000) {
    const converted = await sharp(bytes).webp({ lossless: true, effort: 4 }).toBuffer()
    if (converted.length > 19_000_000) throw new Error(`Texture still exceeds CDN limit: ${file.path}`)
    const path = `textures/${file.sha}.webp`
    await writeAsset(path, converted)
    textureAliases.set(file.path, { path, bytes: converted.length })
  }
}

for (const file of models) {
  const relative = file.path.slice(prefix.length)
  const id = posix.dirname(relative).replaceAll('/', '--')
  if (entries.some(entry => entry.id === id)) throw new Error(`Duplicate model ID: ${id}`)
  const settings = JSON.parse((await readVerified(file.path)).toString('utf8'))
  const refs = settings.FileReferences
  const files = Object.create(null)
  const used = new Set()
  async function add(reference, optional = false) {
    const actual = resolveReference(file.path, reference, optional)
    if (!actual) return null
    const key = actual.slice(prefix.length)
    if (!files[key]) {
      const bytes = await readVerified(actual)
      files[key] = actual.endsWith('.moc3') ? { encoding: 'base64', data: bytes.toString('base64') }
        : { encoding: 'json', data: JSON.parse(bytes.toString('utf8')) }
    }
    used.add(actual)
    return key
  }
  refs.Moc = await add(refs.Moc)
  refs.Textures = refs.Textures.map(reference => {
    const actual = resolveReference(file.path, reference)
    used.add(actual)
    return textureAliases.get(actual)?.path ?? `raw/${encodePath(actual.slice(prefix.length))}`
  })
  for (const key of ['Physics', 'Pose']) if (refs[key]) refs[key] = await add(refs[key])
  delete refs.DisplayInfo
  const motions = {}
  for (const [group, rows] of Object.entries(refs.Motions ?? {})) {
    const valid = []
    for (const row of rows) {
      if (!row.File) { repairs.push({ model: file.path, group, action: 'omit-viewer-command' }); continue }
      const path = await add(row.File, true)
      if (path) { const { Sound, Command, ...motion } = row; valid.push({ ...motion, File: path }) }
    }
    if (valid.length) motions[group] = valid
  }
  refs.Motions = motions
  refs.Expressions = await Promise.all((refs.Expressions ?? []).map(async row => ({ ...row, File: await add(row.File) })))
  const packet = { version: 1, id, settings, files }
  const serialized = JSON.stringify(packet)
  const packagePaths = []
  let packageBytes = 0
  for (let offset = 0; offset < serialized.length; offset += 4_000_000) {
    const part = packagePaths.length
    const value = JSON.stringify(serialized.slice(offset, offset + 4_000_000)).replaceAll('<', '\\u003c')
    const script = `;((globalThis.__MMD_LIVE2D_PARTS__??=Object.create(null))[${JSON.stringify(id)}]??=[])[${part}]=${value};\n`
    const path = `packages/${encodeURIComponent(id)}/${part}.js`
    await writeAsset(path, script)
    packagePaths.push(path)
    packageBytes += Buffer.byteLength(script)
  }
  const textureBytes = [...used].filter(path => path.endsWith('.png')).reduce((sum, path) => sum + (textureAliases.get(path)?.bytes ?? sourceFiles.get(path).size), 0)
  entries.push({ id, name: id, packagePaths, estimatedBytes: packageBytes + textureBytes,
    motionCount: Object.values(motions).reduce((sum, rows) => sum + rows.length, 0),
    textureCount: refs.Textures.length, sourcePath: relative })
}
const catalog = entries.map(({ sourcePath, ...entry }) => entry)
await writeAsset('catalog.json', `${JSON.stringify(catalog, null, 2)}\n`)
await writeFile(join(root, 'src/instances/live2d/catalog.generated.ts'), `// Generated by scripts/prepare-live2d-release.mjs.\nimport type { Live2DCatalogEntry } from '../../renderers/live2d/types'\nexport const catalog: Live2DCatalogEntry[] = ${JSON.stringify(catalog)}\n`)
const sourceReadme = await readFile(join(sourceRoot, 'README.md'))
await writeAsset('SOURCE-README.md', sourceReadme)
const manifest = { ...release, source: { repository: index.repository, commit: index.commit, date: index.sourceDate },
  modelCount: entries.length, totalFiles: published.size, totalBytes: [...published.values()].reduce((sum, row) => sum + row.bytes, 0),
  repairs, files: [...published.values()] }
await writeAsset('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
await writeFile(join(repoRoot, 'README.md'), ['# MMD Live2D Models', '',
  'Azur Lane Cubism Live2D resource snapshot for the MMD HUD.', '',
  `Source: https://github.com/${index.repository}/tree/${index.commit}`, `Source asset date: ${index.sourceDate}`, '',
  `${entries.length} model entries. See azur-lane/v1/manifest.json for hashes and playback-only reference repairs.`,
  '- raw/: unchanged original resource files, including source configurations.',
  '- packages/: on-demand browser script packages (MOC, motions, physics, expressions).',
  '- Textures are loaded separately as images. Viewer commands are never executed; audio is not enabled.',
  '- Cubism Core and player application code are NOT distributed in this resource repository.', '',
  'Game assets remain the property of their respective rights holders. No ownership or model license is granted by this repository.',
  'See azur-lane/v1/SOURCE-README.md for the upstream notice. Live2D runtime licensing is separate.', '',
].join('\n'))
await writeFile(join(root, 'reports/live2d-preparation.json'), JSON.stringify({ ...manifest, files: undefined,
  maxFileBytes: Math.max(...[...published.values()].map(row => row.bytes)) }, null, 2))
console.log(JSON.stringify({ models: entries.length, files: published.size, bytes: manifest.totalBytes, repairs: repairs.length, target }, null, 2))
