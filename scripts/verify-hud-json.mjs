import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { Script, createContext, runInContext } from 'node:vm'
const root = new URL('../', import.meta.url)
const source = await readFile(new URL('dist-hud/mmd-hud.js', root), 'utf8')
const card = JSON.parse(await readFile(new URL('dist-hud/mmd-hud.json', root), 'utf8'))
new Script(source)
const injected = []
const document = { createElement: () => ({ dataset: {}, textContent: '' }), head: { appendChild: element => injected.push(element.textContent) } }
const context = createContext({ document })
let html = card.statusbar
for (const rule of card.regex_scripts) {
  assert.ok(rule.replaceString.length <= 20000)
  // Apply once, in order, including MMD's numeric replacement-token pass.
  html = html.replace(rule.findRegex, () => rule.replaceString.replace(/\$\d+/g, ''))
}
assert.ok(!html.includes('【MMD HUD 注入 '))
const bodies = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1])
assert.equal(bodies.length, card.regex_scripts.length)
for (const body of bodies) runInContext(body, context, { timeout: 5000 })
assert.equal(injected.length, 1)
assert.equal(injected[0], source)
for (const body of bodies) runInContext(body, context, { timeout: 5000 })
assert.equal(injected.length, 1, 'Same build must not start twice')
assert.ok(!source.includes('process.env.NODE_ENV'))
assert.ok(!source.includes('http://127.0.0.1'))
const report = { rules: card.regex_scripts.length, largest: Math.max(...card.regex_scripts.map(row => row.replaceString.length)),
  sourceBytes: Buffer.byteLength(source), onePassReconstruction: true, syntax: true, duplicateStartGuard: true }
await writeFile(new URL('reports/injection-audit.json', root), JSON.stringify(report, null, 2))
console.log(report)
