import { localNikkeCatalog } from '../src/renderers/spine/nikkeCatalog.local'
import { resolveSpineAssetConfig } from '../src/renderers/spine/spinePackageLoader'
import { mountSpineRenderer } from '../src/renderers/spine/spineRenderer'
import type { SpinePlayer } from '../src/renderers/spine/spineTypes'

const button = document.querySelector<HTMLButtonElement>('#run')!
const result = document.querySelector('#results')!
const stage = document.querySelector<HTMLElement>('#stage')!
button.onclick = async () => {
  button.disabled = true
  const results: unknown[] = []
  const cases = [['c203', '新版'], ['c010_03', '新版'], ['c200', '旧版'], ['c912', '旧版'], ['c010_01', '新版'], ['bowwowparadise', '新版'], ['c081', '旧版']]
  for (const [id, source] of cases) {
    for (const size of [[1280, 560], [390, 610]]) {
      let player: SpinePlayer | undefined
      try {
        const entry = localNikkeCatalog.find(row => row.id === id)!
        const variant = entry.variants!.find(row => row.label.startsWith('立绘') && row.label.includes(source))!
        const canvas = document.createElement('canvas')
        canvas.style.width = `${size[0]}px`; canvas.style.height = `${size[1]}px`
        stage.replaceChildren(canvas)
        const config = await resolveSpineAssetConfig(variant.asset, document, window)
        const hashes = new Set<number>(), cameras = new Set<string>()
        let frames = 0, pixels = 0, edgePixels = 0
        let finish: () => void = () => undefined
        const complete = new Promise<void>(resolve => { finish = resolve })
        player = mountSpineRenderer(canvas, config, { onFrame(gl, camera) {
          frames++
          cameras.add(JSON.stringify(camera))
          if (frames % 10 === 0) {
            const data = new Uint8Array(canvas.width * canvas.height * 4)
            gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data)
            let hash = 2166136261, count = 0, edge = 0
            for (let i = 0; i < data.length; i += 4) {
              hash = Math.imul(hash ^ data[i] ^ data[i + 1] ^ data[i + 2] ^ data[i + 3], 16777619)
              if (data[i + 3] > 20) {
                count++
                const p = i / 4, x = p % canvas.width, y = Math.floor(p / canvas.width)
                if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2) edge++
              }
            }
            hashes.add(hash); pixels = Math.max(pixels, count); edgePixels = Math.max(edgePixels, edge)
          }
          if (frames >= 40) finish()
        } })
        await player.ready
        let timer: ReturnType<typeof setTimeout>
        try { await Promise.race([complete, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Frame timeout')), 15000) })]) }
        finally { clearTimeout(timer!) }
        player.dispose()
        const disposedFrames = frames
        await new Promise(resolve => setTimeout(resolve, 80))
        results.push({ id, source, runtime: config.runtimeVersion, size, pixels, changedFrames: hashes.size,
          cameraStable: cameras.size === 1, edgePixels, stoppedAfterDispose: frames === disposedFrames,
          pass: pixels > 100 && hashes.size > 1 && cameras.size === 1 && edgePixels === 0 && frames === disposedFrames })
      } catch (error) { results.push({ id, size, error: String(error), pass: false }) }
      finally { player?.dispose() }
      result.textContent = JSON.stringify(results, null, 2)
    }
  }
  stage.replaceChildren()
  document.documentElement.dataset.complete = 'true'
  button.disabled = false
}
