import { createHash } from 'node:crypto'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const release = JSON.parse(await readFile(join(root, 'spine-release.json'), 'utf8'))
const catalog = JSON.parse(await readFile(join(root, 'release-assets/catalog.local.json'), 'utf8'))
const audit = JSON.parse(await readFile(join(root, 'reports/catalog-audit.json'), 'utf8'))
const files = new Map()
for (const entry of catalog) files.set(`${release.packageDirectory}/thumbnails/${encodeURIComponent(entry.id)}.webp`, join(root, 'release-assets/thumbnails', `${encodeURIComponent(entry.id)}.webp`))
for (const model of audit.models) {
  files.set(`${release.packageDirectory}/packages/${model.id}.js`, join(root, 'release-assets/packages', `${model.id}.js`))
  for (const texture of model.textures) files.set(`models/${texture.path}`, resolve(root, '../mmd-spine-models/models', texture.path))
}
const manifest = []
let bytes = 0
for (const [destination, path] of files) {
  const info = await stat(path)
  const sha256 = createHash('sha256').update(await readFile(path)).digest('hex')
  manifest.push({ destination, localPath: path, bytes: info.size, sha256 })
  bytes += info.size
}
await writeFile(join(root, 'release-assets/publish-manifest.json'), JSON.stringify({ ...release,
  status: release.published ? 'publication-must-be-verified' : 'not-published',
  totalFiles: manifest.length, totalBytes: bytes, files: manifest }, null, 2))
console.log(JSON.stringify({ ...release, files: manifest.length, bytes, maxFileBytes: Math.max(...manifest.map(row => row.bytes)) }, null, 2))
