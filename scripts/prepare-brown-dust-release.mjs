import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = resolve(root, '../model-resources/brown-dust-2')
const repo = resolve(root, '../mmd-brown-dust-2-models')
const packages = join(root, 'release-assets/brown-dust-2')
const release = JSON.parse(await readFile(join(root, 'brown-dust-release.json'), 'utf8'))
const index = JSON.parse(await readFile(join(source, 'source-index.json'), 'utf8'))
const inventory = JSON.parse(await readFile(join(source, 'inventory-report.json'), 'utf8'))
const catalog = JSON.parse(await readFile(join(packages, 'catalog.local.json'), 'utf8'))
const files = []
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const gitHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')

if (release.repository !== 'Godcount10/mmd-brown-dust-2-models' || index.commit !== release.sourceCommit
  || inventory.commit !== index.commit || !inventory.summary.integrityComplete
  || catalog.length !== inventory.summary.models) throw new Error('Resource snapshot or catalog does not match the release')

function within(base, path) {
  const target = resolve(base, path)
  if (!target.startsWith(base + sep)) throw new Error(`Path outside publication directory: ${path}`)
  return target
}

async function save(path, bytes) {
  const target = within(repo, path)
  await mkdir(dirname(target), { recursive: true })
  try { await writeFile(target, bytes, { flag: 'wx' }) }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
    if (!(await readFile(target)).equals(bytes)) throw new Error(`Existing publication file differs: ${path}`)
  }
  files.push({ path, bytes: bytes.length, sha256: hash(bytes), gitBlobSha: gitHash(bytes) })
}

async function copy(path, destination, expected) {
  const bytes = await readFile(path)
  if (bytes.length > 95_000_000) throw new Error(`File exceeds publication limit: ${destination}`)
  if (expected && (expected.size !== bytes.length || expected.sha !== gitHash(bytes))) {
    throw new Error(`Source integrity mismatch: ${destination}`)
  }
  const target = within(repo, destination)
  await mkdir(dirname(target), { recursive: true })
  try { await copyFile(path, target, constants.COPYFILE_EXCL) }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
  if (!(await readFile(target)).equals(bytes)) throw new Error(`Copy integrity mismatch: ${destination}`)
  files.push({ path: destination, bytes: bytes.length, sha256: hash(bytes), gitBlobSha: gitHash(bytes) })
}

for (const [number, file] of index.files.entries()) {
  if (!file.path.startsWith('assets/') && !['README.md', 'LICENSE'].includes(file.path)) {
    throw new Error(`Unexpected indexed path: ${file.path}`)
  }
  await copy(within(source, file.path), file.path === 'README.md' ? 'upstream/README.md' : file.path, file)
  if (number % 500 === 0) console.log(`Verified and copied ${number + 1}/${index.files.length} source files`)
}
await copy(join(source, 'source-index.json'), 'upstream/source-index.json')
await copy(join(source, 'inventory-report.json'), 'upstream/inventory-report.json')
const ids = new Set(catalog.flatMap(entry => (entry.variants ?? [{ asset: entry.asset }]).map(row => row.asset.externalPackage)))
if (ids.size !== inventory.summary.models || [...ids].some(id => !/^bd2-[a-f0-9]{16}$/.test(id))) {
  throw new Error('Unexpected model package set')
}
for (const id of [...ids].sort()) await copy(join(packages, `packages/${id}.js`), `${release.packageDirectory}/packages/${id}.js`)

const cdn = `https://cdn.jsdelivr.net/gh/${release.repository}@${release.ref}/`
function remoteAsset(asset) {
  if (!asset.basePath.startsWith('/_brown-model-files/')) throw new Error('Unexpected local model URL')
  return { ...asset, basePath: `${cdn}assets/${asset.basePath.slice('/_brown-model-files/'.length)}`,
    externalScript: `${cdn}${release.packageDirectory}/packages/${asset.externalPackage}.js`, source: 'remote' }
}
const remoteCatalog = catalog.map(entry => ({ ...entry, asset: remoteAsset(entry.asset),
  variants: entry.variants?.map(row => ({ ...row, asset: remoteAsset(row.asset) })) }))
await save(`${release.packageDirectory}/catalog.json`, Buffer.from(JSON.stringify(remoteCatalog)))
await save('.gitattributes', Buffer.from('* -text\n*.png -diff\n*.skel -diff\n'))
await save('README.md', Buffer.from([
  '# MMD Brown Dust 2 Models', '',
  'Versioned Brown Dust 2 Spine resources for the MMD HUD.', '',
  `Source: https://github.com/${index.repository}/tree/${index.commit}`, '',
  `This snapshot contains ${inventory.summary.models} Spine ${Object.keys(inventory.summary.versions).join(', ')} models.`,
  'It is a community snapshot, not a guarantee of complete official game coverage.', '',
  '## Layout', '',
  '- assets/: original skeletons, atlases, textures and skill cutscene backgrounds.',
  `- ${release.packageDirectory}/packages/: external scripts registering skeleton/atlas data for MMD playback.`,
  `- ${release.packageDirectory}/catalog.json: remote catalog using the immutable release tag.`,
  '- upstream/: original README, source index and dependency inventory.',
  '- manifest.json: byte sizes, SHA-256 and Git blob hashes for every publication file.', '',
  `Use ${release.ref}, not main, for CDN URLs:`, '',
  '```text', `${cdn}${release.packageDirectory}/catalog.json`, '```', '',
  'No Git LFS is used. Models are requested individually; the complete snapshot is not a startup download.',
  'The upstream LICENSE is preserved. Game assets remain the property of their respective rights holders;',
  'the source repository license does not independently establish rights to all game artwork.', '',
].join('\n')))
const manifest = { repository: release.repository, ref: release.ref, packageDirectory: release.packageDirectory,
  source: { repository: index.repository, commit: index.commit }, modelCount: inventory.summary.models,
  totalFiles: files.length, totalBytes: files.reduce((sum, row) => sum + row.bytes, 0), files }
await save('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'))
console.log(JSON.stringify({ repository: release.repository, modelCount: manifest.modelCount,
  files: files.length, bytes: files.reduce((sum, row) => sum + row.bytes, 0), maxFileBytes: Math.max(...files.map(row => row.bytes)) }, null, 2))
