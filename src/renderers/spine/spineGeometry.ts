import type * as Spine40 from '@esotericsoftware/spine-webgl'

export type Bounds = { x: number; y: number; width: number; height: number }

/** Shared geometry only; each model's objects must come from the same runtime. */
export function visibleBounds(spine: typeof Spine40, skeleton: Spine40.Skeleton, version: string): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const vertices: number[] = []
  for (const slot of skeleton.drawOrder) {
    const attachment = slot.getAttachment()
    if (!slot.bone.active || skeleton.color.a * slot.color.a <= 0.01) continue
    if (attachment instanceof spine.RegionAttachment) {
      if (attachment.color.a <= 0.01) continue
      vertices.length = 8
      // 4.1 changed this argument from Bone to Slot (for sequence attachments).
      attachment.computeWorldVertices(version === '4.1' ? slot as unknown as Spine40.Bone : slot.bone, vertices, 0, 2)
    } else if (attachment instanceof spine.MeshAttachment) {
      if (attachment.color.a <= 0.01) continue
      vertices.length = attachment.worldVerticesLength
      attachment.computeWorldVertices(slot, 0, vertices.length, vertices, 0, 2)
    } else continue
    for (let i = 0; i < vertices.length; i += 2) {
      if (!Number.isFinite(vertices[i]) || !Number.isFinite(vertices[i + 1])) continue
      minX = Math.min(minX, vertices[i]); maxX = Math.max(maxX, vertices[i])
      minY = Math.min(minY, vertices[i + 1]); maxY = Math.max(maxY, vertices[i + 1])
    }
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : { x: -50, y: -50, width: 100, height: 100 }
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y }
}

/** Sample a separate skeleton so fitting never changes the live animation. */
export function animationBounds(spine: typeof Spine40, data: Spine40.SkeletonData, version: string, skin?: string, animation?: string): Bounds {
  const sample = new spine.Skeleton(data)
  if (skin && data.findSkin(skin)) sample.setSkinByName(skin)
  sample.setToSetupPose()
  const state = new spine.AnimationState(new spine.AnimationStateData(data))
  const duration = animation ? data.findAnimation(animation)?.duration ?? 0 : 0
  if (animation) state.setAnimation(0, animation, false)
  let bounds: Bounds | undefined
  const steps = duration ? 60 : 0
  for (let i = 0; i <= steps; i++) {
    if (i) state.update(duration / steps)
    state.apply(sample)
    sample.updateWorldTransform()
    const current = visibleBounds(spine, sample, version)
    bounds = bounds ? unionBounds(bounds, current) : current
  }
  return bounds!
}

export function cameraFit(bounds: Bounds, width: number, height: number, zoom = 1) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
    zoom: Math.max(Math.max(1, bounds.width) * 1.12 / Math.max(1, width),
      Math.max(1, bounds.height) * 1.12 / Math.max(1, height)) / zoom }
}

export function textureSize(width: number, height: number, maxSize: number) {
  const scale = Math.min(1, maxSize / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
