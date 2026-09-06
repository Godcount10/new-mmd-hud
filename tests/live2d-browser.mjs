import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const remote = process.argv.includes('--remote')
const injection = process.argv.includes('--injection') || remote
const suffix = remote ? 'remote' : injection ? 'injection' : 'local'
const base = process.env.LIVE2D_TEST_URL || 'http://127.0.0.1:5182'
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = [], violations = [], requests = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => requests.push({ url: request.url(), type: request.resourceType() }))
page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text().slice(0,400)) })
await page.addInitScript(() => {
  window.__CSP_AUDIT__ = []
  document.addEventListener('securitypolicyviolation', event => window.__CSP_AUDIT__.push({ directive: event.effectiveDirective, url: event.blockedURI }))
})
await mkdir('.impeccable/review', { recursive: true })
await mkdir('reports', { recursive: true })

async function pixels() {
  return page.locator('.live2d-canvas').evaluate(canvas => {
    const sample = document.createElement('canvas')
    sample.width = sample.height = 96
    const ctx = sample.getContext('2d')
    ctx.drawImage(canvas, 0, 0, 96, 96)
    const data = ctx.getImageData(0,0,96,96).data
    let visible = 0, hash = 2166136261, left = 96, right = 0, top = 96, bottom = 0
    const colors = new Set()
    for (let i=0; i<data.length; i+=4) {
      if (data[i+3] > 12) { visible++; const x=(i/4)%96, y=Math.floor(i/4/96); left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y) }
      colors.add(`${data[i]>>4},${data[i+1]>>4},${data[i+2]>>4},${data[i+3]>>4}`)
      hash = Math.imul(hash ^ data[i], 16777619)
    }
    return { visible, colors: colors.size, hash, bounds: {left,right,top,bottom}, width:canvas.width,height:canvas.height }
  })
}
async function load(id) {
  await page.getByLabel('Live2D 模型', { exact: true }).selectOption(id)
  await page.getByRole('button', { name: '载入模型', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  assert.match(await page.getByRole('dialog').innerText(), /MiB/)
  await page.getByRole('button', { name:'继续加载', exact:true }).click()
  await page.waitForFunction(() => ['ready','error'].includes(document.querySelector('[data-live2d-state]')?.dataset.live2dState), undefined, { timeout: 180000 })
  assert.equal(await page.locator('[data-live2d-state]').getAttribute('data-live2d-state'), 'ready', await page.locator('.live2d-viewport').innerText())
  await page.waitForTimeout(700)
  const a = await pixels()
  assert.ok(a.visible > 50 && a.colors > 20, `Blank model ${id}: ${JSON.stringify(a)}`)
  await page.waitForTimeout(1100)
  const b = await pixels()
  console.log(`${suffix}: ${id} rendered`, JSON.stringify(b))
  return { id, pixels:b, moving:a.hash !== b.hash }
}

try {
  await page.goto(`${base}/stage-preview.html${injection ? '?injection' : ''}${remote ? '&remote' : ''}`)
  await page.locator('[data-hud="live2d-stage"]').waitFor()
  await page.waitForTimeout(600)
  assert.equal(requests.filter(row => /\/(packages|raw|textures)\//.test(row.url)).length, 0, 'No model request before confirmation')
  await page.getByRole('button', { name:'载入模型', exact:true }).click()
  await page.getByRole('button', { name:'取消', exact:true }).click()
  assert.equal(requests.filter(row => /\/(packages|raw|textures)\//.test(row.url)).length, 0)
  const models = []
  models.push(await load('beierfasite_2'))
  assert.ok(models[0].moving, 'Idle animation must move')
  await page.screenshot({ path:`.impeccable/review/desktop-${suffix}.png` })
  await page.getByRole('button', { name:'暂停播放', exact:true }).click()
  await page.waitForTimeout(300)
  const pausedA = await pixels()
  await page.waitForTimeout(600)
  assert.equal((await pixels()).hash, pausedA.hash, 'Pause must stop updates')
  await page.getByRole('button', { name:'继续播放', exact:true }).click()
  const options = await page.getByLabel('Live2D 动作', { exact:true }).locator('option').count()
  if (options > 1) await page.getByLabel('Live2D 动作', { exact:true }).selectOption('1')
  await page.getByLabel('Live2D 缩放', { exact:true }).fill('1.5')
  await page.getByRole('button', { name:'重置镜头', exact:true }).click()
  assert.equal(await page.getByLabel('Live2D 缩放', { exact:true }).inputValue(), '1')
  await page.setViewportSize({ width:390,height:844 })
  await page.waitForTimeout(500)
  const mobile = await pixels()
  assert.ok(mobile.visible > 50)
  const overflow = await page.locator('[data-hud="live2d-stage"]').evaluate(el => el.scrollWidth > el.clientWidth)
  assert.equal(overflow,false,'Mobile width overflow')
  await page.screenshot({ path:`.impeccable/review/mobile-${suffix}.png` })
  await page.setViewportSize({ width:1440,height:900 })
  if (!remote) models.push(await load('aijier_2'))
  models.push(await load('dafeng_6'))
  models.push(await load('ankeleiqi_4'))
  if (!remote) models.push(await load('zhala_2--zhala_2'))
  await page.getByRole('button', { name:'卸载模型', exact:true }).click()
  assert.equal(await page.locator('[data-live2d-state]').getAttribute('data-live2d-state'),'empty')
  violations.push(...await page.evaluate(() => window.__CSP_AUDIT__))
  const modelViolations = violations.filter(row => !row.url.startsWith('ws:') && !row.url.includes('/@vite/'))
  assert.equal(modelViolations.length,0,JSON.stringify(modelViolations))
  assert.equal(errors.length,0,errors.join('\n'))
  const report = { mode:suffix, models, mobile, noEagerDownloads:true, cancelBeforeDownload:true, pause:true, unload:true,
    injection, cspViolations:violations, errors, requests:requests.filter(row => /\/(packages|raw|textures)\//.test(row.url)) }
  await writeFile(`reports/live2d-browser-${suffix}.json`,JSON.stringify(report,null,2))
  console.log(`${suffix}: PASS`)
} catch (error) {
  console.error(error)
  await page.screenshot({path:`reports/live2d-failure-${suffix}.png`})
  await writeFile(`reports/live2d-failure-${suffix}.json`,JSON.stringify({errors,violations:await page.evaluate(()=>window.__CSP_AUDIT__),text:await page.locator('body').innerText()},null,2))
  process.exitCode=1
} finally { await browser.close() }
