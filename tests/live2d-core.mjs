import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const source = new URL('../../model-resources/azur-lane/', import.meta.url)
const index = JSON.parse(await readFile(new URL('source-index.json',source),'utf8'))
const files = index.files.filter(file=>file.path.endsWith('.moc3'))
const browser = await chromium.launch({channel:'msedge',headless:true})
const results=[]
try {
  const page=await browser.newPage()
  await page.addScriptTag({content:await readFile(new URL('../vendor/live2d/live2dcubismcore.min.js',import.meta.url),'utf8')})
  for(const file of files) {
    const data=(await readFile(new URL(file.path,source))).toString('base64')
    const result=await page.evaluate(base64=>{
      const core=window.Live2DCubismCore
      const buffer=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)).buffer
      const moc=core.Moc.fromArrayBuffer(buffer)
      if(!moc) return {ok:false,error:'Core rejected MOC'}
      let model
      try {
        model=core.Model.fromMoc(moc)
        if(!model) return {ok:false,error:'Core rejected model'}
        model.update()
        return {ok:true,drawables:model.drawables.count,parameters:model.parameters.count,coreVersion:core.Version.csmGetVersion()}
      } finally { model?.release();moc._release() }
    },data)
    results.push({path:file.path,...result})
    assert.ok(result.ok&&result.drawables>0,JSON.stringify(results[results.length-1]))
  }
  await writeFile(new URL('../reports/live2d-core-audit.json',import.meta.url),JSON.stringify({models:results.length,passed:true,results},null,2))
  console.log(`${results.length}/${files.length} MOC files parsed and updated by official Cubism Core`)
} finally {await browser.close()}
