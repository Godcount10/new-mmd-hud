import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { instanceConfig, root } from './instance-config.mjs'

const selected = instanceConfig(process.argv[2])
const env = { ...process.env, MMD_HUD_INSTANCE: selected.id }
for (const [path, args] of [
  ['node_modules/vue-tsc/bin/vue-tsc.js', ['--noEmit']],
  ['node_modules/vite/bin/vite.js', ['build', '--mode', 'hud']],
  ['scripts/build-role-card-json.mjs', []],
  ['scripts/verify-hud-json.mjs', []],
]) {
  const result = spawnSync(process.execPath, [resolve(root, path), ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
