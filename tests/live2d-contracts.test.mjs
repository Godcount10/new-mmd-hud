import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import { createHash } from 'node:crypto'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
const root = fileURLToPath(new URL('..', import.meta.url))
const repo = resolve(root, '../mmd-live2d-models')
const assetRoot = join(repo, 'azur-lane/v1')
const catalog = JSON.parse(await readFile(join(assetRoot,'catalog.json'),'utf8'))
const manifest = JSON.parse(await readFile(join(assetRoot,'manifest.json'),'utf8'))
const files = new Map(manifest.files.map(file => [file.path,file]))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('the platform Runtime does not import domain, Vue or any model engine', async () => {
  const result = await build({ entryPoints:[join(root,'src/hud/runtime.ts')], bundle:true, write:false, metafile:true, platform:'node', format:'esm' })
  for (const path of Object.keys(result.metafile.inputs)) assert.ok(!/domain|node_modules|renderers\/(spine|live2d)/.test(path),path)
})

test('all 243 model packages reconstruct, match hashes and resolve playback dependencies', async () => {
  assert.equal(catalog.length,243)
  assert.equal(new Set(catalog.map(row=>row.id)).size,243)
  for (const entry of catalog) {
    const context = createContext({})
    let transferBytes = 0
    for (const path of entry.packagePaths) {
      const bytes = await readFile(join(assetRoot,path))
      assert.ok(bytes.length < 8_000_000,`CDN file limit: ${path}`)
      assert.equal(hash(bytes), files.get(`azur-lane/v1/${path}`).sha256)
      transferBytes += bytes.length
      runInContext(bytes.toString('utf8'),context,{timeout:10000})
    }
    const parts = context.__MMD_LIVE2D_PARTS__[entry.id]
    assert.equal(parts.length,entry.packagePaths.length)
    const packet = JSON.parse(parts.join(''))
    assert.equal(packet.id,entry.id)
    const refs=packet.settings.FileReferences
    assert.equal(Buffer.from(packet.files[refs.Moc].data,'base64').subarray(0,4).toString(),'MOC3')
    for (const key of ['Physics','Pose']) if(refs[key]) assert.ok(packet.files[refs[key]],`${entry.id}: ${key}`)
    for (const motion of Object.values(refs.Motions).flat()) {
      assert.ok(packet.files[motion.File],`${entry.id}: ${motion.File}`)
      assert.equal(motion.Command,undefined)
      assert.equal(motion.Sound,undefined)
      assert.ok(packet.files[motion.File].data.Curves)
    }
    for (const expression of refs.Expressions) assert.ok(packet.files[expression.File])
    for (const texture of refs.Textures) {
      const decoded=decodeURIComponent(texture)
      const absolute=resolve(assetRoot,decoded)
      assert.ok(absolute.startsWith(`${assetRoot}${sep}`))
      const info=await stat(absolute)
      assert.ok(info.size<19_000_000,`${entry.id}: texture CDN limit`)
      transferBytes+=info.size
    }
    assert.equal(transferBytes,entry.estimatedBytes,`${entry.id}: transfer estimate`)
  }
})
