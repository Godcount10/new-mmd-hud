#!/usr/bin/env node
import { build } from 'esbuild'
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LIBRARY = resolve(ROOT, '../mmd-spine-models/models/nikke-spine-library')
const manifest = JSON.parse(await readFile(join(LIBRARY, 'source-manifest.json'), 'utf8'))
const bundled = await build({ stdin: { contents: 'export * from "@esotericsoftware/spine-core"', resolveDir: ROOT },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' })
const spine = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

function bounds(skeleton, includeTransparentAttachments = false) {
  let count = 0
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const slot of skeleton.drawOrder) {
    if (!slot.bone.active || slot.color.a * skeleton.color.a <= .01) continue
    const attachment = slot.getAttachment()
    const vertices = []
    if (attachment instanceof spine.RegionAttachment) attachment.computeWorldVertices(slot.bone, vertices, 0, 2)
    else if (attachment instanceof spine.MeshAttachment) attachment.computeWorldVertices(slot, 0, attachment.worldVerticesLength, vertices, 0, 2)
    else continue
    if (!includeTransparentAttachments && attachment.color.a <= .01) continue
    count++
    for (let i = 0; i < vertices.length; i += 2) {
      minX = Math.min(minX, vertices[i]); minY = Math.min(minY, vertices[i + 1])
      maxX = Math.max(maxX, vertices[i]); maxY = Math.max(maxY, vertices[i + 1])
    }
  }
  return { attachments: count, finite: [minX, minY, maxX, maxY].every(Number.isFinite),
    x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const fileProblems = []
for (const file of manifest.files) {
  try {
    const info = await stat(join(LIBRARY, file.path))
    if (info.size !== file.size) fileProblems.push({ path: file.path, expected: file.size, actual: info.size })
  } catch (error) { fileProblems.push({ path: file.path, error: error.message }) }
}

const models = []
for (const id of manifest.modelIds) {
  const row = { id }
  try {
    const base = join(LIBRARY, id, '00')
    const atlas = new spine.TextureAtlas(await readFile(join(base, `${id}_00.atlas`), 'utf8'))
    row.textures = []
    for (const page of atlas.pages) {
      const path = join(base, page.name)
      const bytes = await readFile(path)
      const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      row.textures.push({ name: page.name, pma: page.pma, bytes: bytes.length,
        atlasWidth: page.width, atlasHeight: page.height,
        png, width: png ? bytes.readUInt32BE(16) : null, height: png ? bytes.readUInt32BE(20) : null })
      page.setTexture(new spine.FakeTexture({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }))
    }
    const parser = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas))
    parser.scale = .35
    const data = parser.readSkeletonData(await readFile(join(base, `${id}_00.skel`)))
    row.version = data.version
    row.skins = data.skins.map((skin) => skin.name)
    row.animations = data.animations.map((animation) => ({ name: animation.name, duration: animation.duration }))
    row.skin00Missing = !data.findSkin('00')
    row.unsupportedRegionRotations = data.skins.flatMap((skin) => skin.getAttachments()
      .filter(({ attachment }) => attachment instanceof spine.RegionAttachment && [180, 270].includes(attachment.region?.degrees))
      .map(({ name, slotIndex, attachment }) => ({ skin: skin.name, name, slot: data.slots[slotIndex].name, degrees: attachment.region.degrees })))
    row.skinSamples = []
    for (const skin of data.skins) {
      const skeleton = new spine.Skeleton(data)
      skeleton.setSkin(skin)
      skeleton.setToSetupPose()
      skeleton.updateWorldTransform()
      const state = new spine.AnimationState(new spine.AnimationStateData(data))
      const animation = data.findAnimation('idle') ?? data.animations[0]
      if (animation) state.setAnimation(0, animation.name, true)
      const samples = []
      const rendererSamples = []
      for (let i = 0; i < 25; i++) {
        state.update((animation?.duration || 1) / 24)
        state.apply(skeleton)
        skeleton.updateWorldTransform()
        samples.push(bounds(skeleton))
        rendererSamples.push(bounds(skeleton, true))
      }
      const finite = samples.filter((sample) => sample.finite)
      const widths = finite.map((sample) => sample.width)
      const heights = finite.map((sample) => sample.height)
      row.skinSamples.push({ skin: skin.name, animation: animation?.name,
        finiteSamples: finite.length, totalSamples: samples.length,
        first: samples[0], widthRatio: finite.length ? Math.max(...widths) / Math.min(...widths) : null,
        heightRatio: finite.length ? Math.max(...heights) / Math.min(...heights) : null,
        cameraSamples: rendererSamples.every((sample) => sample.finite) ? [
          { name: 'desktop', width: 960, height: 560 },
          { name: 'portrait', width: 390, height: 700 },
        ].map((viewport) => {
          const zooms = rendererSamples.map((b) => Math.max(b.width * 1.12 / viewport.width, b.height * 1.12 / viewport.height))
          const centersX = rendererSamples.map((b) => b.x + b.width / 2)
          const centersY = rendererSamples.map((b) => b.y + b.height / 2)
          return { ...viewport, zoomRatio: Math.max(...zooms) / Math.min(...zooms),
            cameraXRange: Math.max(...centersX) - Math.min(...centersX),
            cameraYRange: Math.max(...centersY) - Math.min(...centersY) }
        }) : [],
        transparentAttachmentBoundsDifference: rendererSamples.some((b, i) => Math.abs(b.width - samples[i].width) > .01 || Math.abs(b.height - samples[i].height) > .01) })
    }
  } catch (error) { row.error = error.message }
  models.push(row)
}

const report = { auditedAt: new Date().toISOString(), runtime: 'spine-core 4.0.31',
  manifestFiles: manifest.files.length, fileProblems, models,
  summary: { models: models.length, parseErrors: models.filter((row) => row.error).map(({ id, error }) => ({ id, error })),
    textureSizeDifferences: models.filter((row) => row.textures?.some((t) => t.width !== t.atlasWidth || t.height !== t.atlasHeight))
      .map((row) => ({ id: row.id, textures: row.textures })),
    unsupportedRegionRotations: models.filter((row) => row.unsupportedRegionRotations?.length)
      .map((row) => ({ id: row.id, attachments: row.unsupportedRegionRotations })),
    missingSkin00: models.filter((row) => row.skin00Missing).map((row) => ({ id: row.id, skins: row.skins })),
    missingIdle: models.filter((row) => row.animations && !row.animations.some((a) => a.name === 'idle')).map((row) => ({ id: row.id, animations: row.animations })),
    invalidSkin00: models.filter((row) => row.skinSamples?.some((sample) => sample.skin === '00' && sample.finiteSamples < sample.totalSamples)).map((row) => row.id),
    missingPortraits: manifest.modelIds.filter((id) => !manifest.files.some((file) => file.path === `${id}/${id}_00.png`)) } }
const target = join(ROOT, 'reports/spine-library-audit.json')
await mkdir(dirname(target), { recursive: true })
await writeFile(target, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ fileProblems, ...report.summary, report: target }, null, 2))
