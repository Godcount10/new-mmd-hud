import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const browser=await chromium.launch({channel:'msedge',headless:true})
const page=await browser.newPage()
const errors=[]
page.on('pageerror',error=>errors.push(error.message))
async function confirm() {
  await page.getByRole('button',{name:'载入模型',exact:true}).click()
  await page.getByRole('button',{name:'继续加载',exact:true}).click()
}
async function ready() {
  await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('[data-live2d-state]')?.dataset.live2dState))
  assert.equal(await page.locator('[data-live2d-state]').getAttribute('data-live2d-state'),'ready',await page.locator('.live2d-viewport').innerText())
}
try {
  await page.goto('http://127.0.0.1:5182/stage-preview.html?injection')
  await page.locator('[data-hud="live2d-stage"]').waitFor()
  await page.route('**/packages/**',async route=>{ await new Promise(resolve=>setTimeout(resolve,1000)); await route.continue().catch(()=>undefined) })
  await confirm()
  await page.getByRole('button',{name:'取消加载',exact:true}).click()
  await page.unrouteAll({behavior:'wait'})
  assert.equal(await page.locator('[data-live2d-state]').getAttribute('data-live2d-state'),'empty')
  await page.route('**/raw/**',route=>route.abort())
  await confirm()
  await page.locator('[data-live2d-state="error"]').waitFor()
  await page.unrouteAll({behavior:'wait'})
  await page.getByRole('button',{name:'重试',exact:true}).click()
  await ready()
  for(let i=0;i<3;i++) { await confirm();await ready() }
  const stageRect=await page.locator('.live2d-canvas').boundingBox()
  await page.mouse.move(stageRect.x+stageRect.width/2,stageRect.y+stageRect.height/2)
  await page.mouse.down();await page.mouse.move(stageRect.x+stageRect.width/2+60,stageRect.y+stageRect.height/2+20);await page.mouse.up()
  await page.getByRole('button',{name:'重置镜头',exact:true}).click()
  await page.getByRole('button',{name:'关闭舞台',exact:true}).click()
  await page.evaluate(()=>window.sdk.stage.open('full'))
  assert.equal(await page.locator('[data-live2d-state]').getAttribute('data-live2d-state'),'empty')
  await confirm();await ready()
  assert.deepEqual(errors,[])
  await writeFile('reports/live2d-lifecycle.json',JSON.stringify({passed:true,cancelInFlight:true,textureFailureRecovery:true,repeatedSameModel:true,drag:true,closeAndReopen:true,errors},null,2))
  console.log('Lifecycle: PASS')
} finally {await browser.close()}
