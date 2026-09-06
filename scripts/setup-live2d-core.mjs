import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const target = new URL('../vendor/live2d/', import.meta.url)
const url = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
await mkdir(target, { recursive: true })
let bytes
try { bytes = await readFile(new URL('live2dcubismcore.min.js', target)) }
catch (error) {
  if (error.code !== 'ENOENT') throw error
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`Core download: HTTP ${response.status}`)
  bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.toString().includes('Live2DCubismCore') || !bytes.toString().includes('Redistributable Code')) throw new Error('Unexpected Core response')
  await writeFile(new URL('live2dcubismcore.min.js', target), bytes, { flag: 'wx' })
}
const notice = [
  'Live2D Cubism Core', '(C) Live2D Inc. All rights reserved.',
  `Source: ${url}`, `SHA-256: ${createHash('sha256').update(bytes).digest('hex')}`,
  'This file is Redistributable Code, provided as part of the HUD application, not licensed under MIT.',
  'https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html',
  'https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html',
  'Live2D SDK release/commercial licensing may apply independently of model ownership.', '',
].join('\n')
await writeFile(new URL('NOTICE.txt', target), notice)
console.log(notice)
