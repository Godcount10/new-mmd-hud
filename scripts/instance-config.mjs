import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const root = fileURLToPath(new URL('..', import.meta.url))
export const instances = JSON.parse(readFileSync(resolve(root, 'hud-instances.json'), 'utf8'))
export function instanceConfig(name = process.env.MMD_HUD_INSTANCE || 'nikke') {
  if (!Object.hasOwn(instances, name)) throw new Error(`Unknown HUD instance: ${name}`)
  return { id: name, ...instances[name], outDir: resolve(root, 'dist-hud', name) }
}
