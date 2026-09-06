const BLOODLINE_ORBIT_COUNTS: Record<string, number> = {
  C: 3,
  B: 4,
  A: 5,
  S: 6,
  SS: 7,
  SSS: 8,
}

/**
 * Derives the decorative density tier from the assistant-owned bloodline label.
 * The component uses this tier for 2-3 concentric rings plus 3-8 orbital marks.
 * Unknown or missing labels intentionally fall back to the minimum C density.
 */
export function resolveBloodlineOrbitCount(bloodline: string | null | undefined): number {
  const normalized = String(bloodline ?? '').toUpperCase().replace(/[\s\u3000]/g, '')
  const rank = normalized.match(/SSS|SS|S|A|B|C/)?.[0] ?? 'C'
  return BLOODLINE_ORBIT_COUNTS[rank] ?? BLOODLINE_ORBIT_COUNTS.C
}

/**
 * Removes the crimson plate baked into the supplied Rive alchemy frame.
 * Neutral linework (and warm gold pixels) is left untouched so the asset can
 * remain animated while its opaque background becomes transparent.
 */
export function stripCrimsonPlatePixels(data: Uint8ClampedArray, frameWidth: number, frameHeight: number): number {
  const pixelCount = Math.floor(data.length / 4)
  const width = Math.max(1, Math.min(Math.floor(frameWidth) || 1, pixelCount))
  const height = Math.max(1, Math.min(Math.floor(frameHeight) || 1, Math.ceil(pixelCount / width)))
  const crimson = new Uint8Array(pixelCount)
  const connected = new Uint8Array(pixelCount)
  const queue = new Int32Array(pixelCount)

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const index = pixel * 4
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (!alpha || red < 24) continue

    const redDominance = red - Math.max(green, blue)
    if (redDominance > 10
      && red > green * 1.22
      && red > blue * 1.18
      && green < 125
      && blue < 125) crimson[pixel] = 1
  }

  let head = 0
  let tail = 0
  const enqueue = (pixel: number): void => {
    if (pixel < 0 || pixel >= pixelCount || !crimson[pixel] || connected[pixel]) return
    connected[pixel] = 1
    queue[tail] = pixel
    tail += 1
  }

  // The plate is an edge-connected fill; constellation marks remain isolated
  // inside it and therefore survive the flood fill.
  for (let x = 0; x < width; x += 1) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width)
    enqueue(y * width + width - 1)
  }

  while (head < tail) {
    const pixel = queue[head]
    head += 1
    const x = pixel % width
    if (x > 0) enqueue(pixel - 1)
    if (x + 1 < width) enqueue(pixel + 1)
    if (pixel >= width) enqueue(pixel - width)
    if (pixel + width < pixelCount) enqueue(pixel + width)
  }

  let removed = 0
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (!connected[pixel]) continue
    const index = pixel * 4

    data[index + 3] = 0
    data[index] = 0
    data[index + 1] = 0
    data[index + 2] = 0
    removed += 1
  }

  return removed
}
