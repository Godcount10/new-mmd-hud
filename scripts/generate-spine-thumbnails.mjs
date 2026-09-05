#!/usr/bin/env node
import { build } from 'esbuild'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = join(root, 'release-assets/thumbnails')
const models = resolve(root, '../mmd-spine-models/models')
await mkdir(output, { recursive: true })
const catalog = JSON.parse(await readFile(join(root, 'release-assets/catalog.local.json'), 'utf8'))
const runtimes = {}
for (const [version, module] of [['4.0', 'spine-canvas-40'], ['4.1', 'spine-canvas-41']]) {
  const result = await build({ stdin: { contents: `export * from '${module}'; export { visibleBounds } from './src/renderers/spine/spineGeometry.ts'`, resolveDir: root },
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' })
  runtimes[version] = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const errors = []
const keys = {}
let previous = {}
try { previous = JSON.parse(await readFile(join(root, 'reports/thumbnail-audit.json'), 'utf8')).keys ?? {} } catch { /* First build. */ }
let count = 0
for (const entry of catalog) {
  const target = join(output, `${encodeURIComponent(entry.id)}.webp`)
  keys[entry.id] = `${entry.asset.id}|${entry.asset.skin}|${entry.asset.animation}|v2`
  try {
    if (previous[entry.id] === keys[entry.id]) {
      try { await stat(target); count++; continue } catch { /* Resume missing thumbnails. */ }
    }
    const config = entry.asset, spine = runtimes[config.runtimeVersion]
    const base = join(models, config.basePath.slice('/_model-files/'.length))
    const atlas = new spine.TextureAtlas(await readFile(join(base, config.atlas), 'utf8'))
    const images = []
    for (const page of atlas.pages) {
      const source = await loadImage(join(base, page.name))
      const image = createCanvas(page.width || source.width, page.height || source.height)
      image.getContext('2d').drawImage(source, 0, 0, image.width, image.height)
      images.push(image)
      page.setTexture(new spine.FakeTexture(image))
    }
    const data = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(await readFile(join(base, config.skeleton)))
    const skeleton = new spine.Skeleton(data)
    if (config.skin) skeleton.setSkinByName(config.skin)
    skeleton.setToSetupPose()
    const state = new spine.AnimationState(new spine.AnimationStateData(data))
    if (config.animation) { state.setAnimation(0, config.animation, true); state.update(0.2) }
    state.apply(skeleton)
    skeleton.updateWorldTransform()
    // Canvas drawTriangles does not skip inactive bones as the WebGL renderer does.
    skeleton.drawOrder = skeleton.drawOrder.filter(slot => slot.bone.active && slot.color.a > 0.01)
    const bounds = spine.visibleBounds(spine, skeleton, config.runtimeVersion)
    const canvas = createCanvas(960, 1280), ctx = canvas.getContext('2d')
    const scale = Math.min(232 / Math.max(1, bounds.width), 312 / Math.max(1, bounds.height))
    ctx.scale(4, 4)
    ctx.translate(120, 160)
    ctx.scale(scale, -scale)
    ctx.translate(-bounds.x - bounds.width / 2, -bounds.y - bounds.height / 2)
    const renderer = new spine.SkeletonRenderer(ctx)
    renderer.triangleRendering = true
    renderer.draw(skeleton)
    const thumbnail = createCanvas(240, 320)
    const thumbnailContext = thumbnail.getContext('2d')
    thumbnailContext.drawImage(canvas, 0, 0, 240, 320)
    const pixels = thumbnailContext.getImageData(0, 0, 240, 320).data
    let visible = 0
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 20) visible++
    if (visible < 50) throw new Error('Rendered portrait is blank')
    await writeFile(target, await thumbnail.encode('webp', 85))
    images.forEach(image => { image.width = 1; image.height = 1 })
    count++
    if (count % 50 === 0) console.log(`Portraits: ${count}/${catalog.length}`)
  } catch (error) { errors.push({ id: entry.id, error: error.message }) }
}
await writeFile(join(root, 'reports/thumbnail-audit.json'), JSON.stringify({ count, errors, keys }, null, 2))
console.log(JSON.stringify({ count, errors }, null, 2))
if (errors.length) process.exitCode = 1
