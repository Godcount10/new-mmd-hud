import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile, stat } from 'node:fs/promises'
import { Script, runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
const root = new URL('../', import.meta.url)
const result = await build({ entryPoints: [fileURLToPath(new URL('src/renderers/spine/spineGeometry.ts', root))],
  bundle: true, write: false, format: 'esm', platform: 'node' })
const geometry = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const catalog = JSON.parse(await readFile(new URL('release-assets/catalog.local.json', root), 'utf8'))
const audit = JSON.parse(await readFile(new URL('reports/catalog-audit.json', root), 'utf8'))

test('merged catalog covers every skeleton and restores the original demo', () => {
  assert.equal(catalog.length, 730)
  assert.equal(audit.variants + audit.duplicates.length, 1502 + 254)
  assert.equal(audit.runtime40, 632)
  assert.equal(audit.runtime41, 1124)
  assert.deepEqual(audit.errors, [])
  for (const id of ['c203', 'c081', 'c122', 'c211', 'c909', 'c913']) assert.ok(catalog.some(row => row.id === id))
  assert.equal(new Set(catalog.map(row => row.id)).size, catalog.length)
})
test('fixed camera contains the bounds at portrait and landscape sizes', () => {
  const bounds = { x: -300, y: -90, width: 900, height: 2000 }
  for (const [width, height] of [[1280, 560], [390, 610], [320, 240]]) {
    const fit = geometry.cameraFit(bounds, width, height)
    assert.ok(fit.zoom * width > bounds.width)
    assert.ok(fit.zoom * height > bounds.height)
    assert.equal(fit.x, 150)
    assert.equal(fit.y, 910)
  }
  assert.deepEqual(geometry.textureSize(8192, 4096, 4096), { width: 4096, height: 2048 })
  assert.deepEqual(geometry.textureSize(1200, 800, 4096), { width: 1200, height: 800 })
})
test('each external package registers only its expected key and matches the binary version', async () => {
  for (const row of audit.models) {
    const script = await readFile(new URL(`release-assets/packages/${row.id}.js`, root), 'utf8')
    const context = {}
    new Script(script)
    runInNewContext(script, context, { timeout: 1000 })
    assert.deepEqual(Object.keys(context.__MMD_SPINE_PACKAGES__), [row.id])
    const data = context.__MMD_SPINE_PACKAGES__[row.id]
    assert.ok(data.skeleton.startsWith('data:application/octet-stream;base64,'))
    assert.ok(data.atlas.startsWith('data:text/plain;charset=utf-8;base64,'))
    const bytes = Buffer.from(data.skeleton.split(',')[1], 'base64')
    assert.ok(bytes.subarray(8, 32).includes(Buffer.from(row.asset.runtimeVersion)))
    assert.equal(Buffer.byteLength(script) + row.textures.reduce((sum, p) => sum + p.bytes, 0), row.estimatedBytes)
  }
})
test('gallery references small real previews only', async () => {
  for (const row of catalog) {
    assert.ok(row.thumbnail?.endsWith('.webp'))
    const size = await stat(new URL(`release-assets/thumbnails/${encodeURIComponent(row.id)}.webp`, root))
    assert.ok(size.size > 100 && size.size < 250000, `${row.id}: ${size.size}`)
  }
})
