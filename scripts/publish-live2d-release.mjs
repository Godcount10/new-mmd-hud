import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const repo = resolve(root, '../mmd-live2d-models')
const release = JSON.parse(await readFile(join(root,'live2d-release.json'),'utf8'))
const manifestPath = `${release.packageDirectory}/manifest.json`
const manifest = JSON.parse(await readFile(join(repo,manifestPath),'utf8'))
const expectedRemote = 'https://github.com/Godcount10/mmd-live2d-models.git'
const reportPath = join(root,'reports/live2d-publish-progress.json')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const options = ['-c','gc.auto=0','-c','maintenance.auto=false','-c','core.autocrlf=false']

function git(args, input) {
  return new Promise((resolveResult,reject) => {
    const child=spawn('git',[...options,...args],{cwd:repo,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},stdio:['pipe','pipe','pipe']})
    const output=[],errors=[]
    child.stdout.on('data',chunk=>output.push(chunk))
    child.stderr.on('data',chunk=>{ errors.push(chunk); if(args[0]==='push') process.stderr.write(chunk) })
    child.on('error',reject)
    child.on('close',code=>code===0 ? resolveResult(Buffer.concat(output).toString('utf8').trim())
      : reject(new Error(`git ${args[0]}: ${Buffer.concat(errors).toString('utf8').slice(-4000)}`)))
    child.stdin.on('error',()=>undefined)
    child.stdin.end(input)
  })
}
async function push() {
  const head=await git(['rev-parse','HEAD'])
  const remote=(await git(['ls-remote','--heads','origin','main'])).split(/\s+/)[0]
  if(remote===head) return head
  if(remote) {
    await git(['fetch','--no-tags','origin','main'])
    await git(['merge-base','--is-ancestor','FETCH_HEAD','HEAD'])
  }
  await git(['push','origin','HEAD:refs/heads/main'])
  if((await git(['ls-remote','--heads','origin','main'])).split(/\s+/)[0]!==head) throw new Error('Remote commit not confirmed')
  return head
}

try {
  if(release.repository!=='Godcount10/mmd-live2d-models'||release.ref!=='v1.0.0'||manifest.repository!==release.repository) throw new Error('Unexpected publication target')
  for(const mode of ['local','injection']) {
    const test=JSON.parse(await readFile(join(root,`reports/live2d-browser-${mode}.json`),'utf8'))
    if(test.models.length<5||test.errors.length||!test.noEagerDownloads||!test.pause||!test.unload) throw new Error(`Incomplete ${mode} render tests`)
  }
  if(await git(['remote','get-url','origin'])!==expectedRemote) throw new Error('Unexpected origin')
  if(await git(['branch','--show-current'])!=='main') throw new Error('Expected main')
  if(await git(['diff','--name-only'])) throw new Error('Tracked files have uncommitted changes; preserved')
  const existingTag=await git(['ls-remote','--tags','origin',`refs/tags/${release.ref}`])
  if(existingTag) throw new Error('Release tag already exists; refusing to overwrite it')
  const files=[...manifest.files]
  for(const path of [manifestPath,'README.md']) {
    const bytes=await readFile(join(repo,path))
    files.push({path,bytes:bytes.length,sha256:hash(bytes)})
  }
  const allowed=new Set(files.map(file=>file.path))
  const staged=(await git(['diff','--cached','--name-only','-z'])).split('\0').filter(Boolean)
  if(staged.some(path=>!allowed.has(path))) throw new Error('Unrelated staged changes; preserved')
  console.log(`Verifying ${files.length} files before publication.`)
  for(const file of files) {
    const path=resolve(repo,file.path)
    if(!path.startsWith(`${repo}${sep}`)||file.bytes>95_000_000) throw new Error(`Invalid GitHub file: ${file.path}`)
    const bytes=await readFile(path)
    if(bytes.length!==file.bytes||hash(bytes)!==file.sha256) throw new Error(`Changed publication file: ${file.path}`)
  }
  // Batches stay below the push size limit. Only manifest-listed assets are staged.
  const batches=[]
  let current=[],size=0
  for(const file of files) {
    if(current.length&&size+file.bytes>240*1024**2) { batches.push(current);current=[];size=0 }
    current.push(file);size+=file.bytes
  }
  if(current.length) batches.push(current)
  let publishedBytes=0,publishedFiles=0,head=''
  for(let index=0;index<batches.length;index++) {
    const batch=batches[index]
    console.log(`Publishing batch ${index+1}/${batches.length} (${(batch.reduce((sum,row)=>sum+row.bytes,0)/1e6).toFixed(1)} MB)`)
    await git(['add','--pathspec-from-file=-','--pathspec-file-nul'],Buffer.from(batch.map(file=>file.path).join('\0')+'\0'))
    const names=(await git(['diff','--cached','--name-only','-z'])).split('\0').filter(Boolean)
    if(names.some(path=>!allowed.has(path))) throw new Error('Unrelated files appeared in index')
    if(names.length) await git(['commit','-m',`Publish Azur Lane Live2D v1 (${index+1}/${batches.length})`])
    head=await push()
    publishedFiles+=batch.length; publishedBytes+=batch.reduce((sum,row)=>sum+row.bytes,0)
    await writeFile(reportPath,JSON.stringify({status:'pushing',batch:index+1,batches:batches.length,publishedFiles,publishedBytes,head},null,2))
    console.log(`Confirmed ${index+1}/${batches.length}: ${(publishedBytes/1e9).toFixed(2)} GB on GitHub`)
  }
  await git(['tag','-a',release.ref,'-m','Azur Lane Live2D source snapshot and MMD playback packages',head])
  await git(['push','origin',`refs/tags/${release.ref}:refs/tags/${release.ref}`])
  const tagged=(await git(['ls-remote','--tags','origin',`refs/tags/${release.ref}^{}`])).split(/\s+/)[0]
  if(tagged!==head) throw new Error('Remote release tag not confirmed')
  await writeFile(reportPath,JSON.stringify({status:'complete',repository:release.repository,ref:release.ref,head,publishedFiles,publishedBytes},null,2))
  console.log(`Published ${release.repository}@${release.ref}: ${head}`)
} catch(error) { console.error(error); process.exitCode=1 }
