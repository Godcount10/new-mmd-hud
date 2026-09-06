import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('..', import.meta.url))
const repo = resolve(root, '../mmd-brown-dust-2-models')
const release = JSON.parse(await readFile(join(root, 'brown-dust-release.json'), 'utf8'))
const manifestBytes = await readFile(join(repo, 'manifest.json'))
const manifest = JSON.parse(manifestBytes)
const progressFile = join(root, 'reports/brown-dust-publish-progress.json')
const expectedRemote = 'https://github.com/Godcount10/mmd-brown-dust-2-models.git'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const gitHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const options = ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-c', 'core.autocrlf=false',
  '-c', 'http.version=HTTP/1.1', ...(process.platform === 'win32' ? ['-c', 'http.sslBackend=openssl'] : [])]

function commandOnce(bin, args, input, allowed = [0]) {
  return new Promise((done, reject) => {
    const child = spawn(bin, args, { cwd: repo, windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, stdio: ['pipe', 'pipe', 'pipe'] })
    const out = [], err = []
    child.stdout.on('data', chunk => out.push(chunk))
    child.stderr.on('data', chunk => { err.push(chunk); if (args.includes('push')) process.stderr.write(chunk) })
    child.on('error', reject)
    child.on('close', code => allowed.includes(code)
      ? done({ text: Buffer.concat(out).toString('utf8').trim(), code })
      : reject(new Error(`${bin} ${args.join(' ')} failed: ${Buffer.concat(err).toString('utf8').slice(-4000)}`)))
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}
async function command(bin, args, input, allowed = [0]) {
  const network = bin === 'gh' || args.some(arg => ['ls-remote', 'fetch', 'push'].includes(arg))
  for (let attempt = 0; ; attempt++) {
    try { return await commandOnce(bin, args, input, allowed) }
    catch (error) {
      if (!network || attempt >= 3 || !/reset|timed out|timeout|TLS|RPC failed|hung up|resolve host|connect|HTTP 50[234]/i.test(error.message)) throw error
      console.log(`Network request interrupted; retry ${attempt + 1}/3 in ${2 ** (attempt + 1)} seconds`)
      await delay(1000 * 2 ** (attempt + 1))
    }
  }
}
const git = (args, input, allowed) => command('git', [...options, ...args], input, allowed)
async function push() {
  const head = (await git(['rev-parse', 'HEAD'])).text
  const remote = (await git(['ls-remote', '--heads', 'origin', 'main'])).text.split(/\s+/)[0]
  if (remote === head) return head
  if (remote) {
    await git(['fetch', '--no-tags', 'origin', 'main'])
    await git(['merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD'])
  }
  await git(['push', 'origin', 'HEAD:refs/heads/main'])
  if ((await git(['ls-remote', '--heads', 'origin', 'main'])).text.split(/\s+/)[0] !== head) {
    throw new Error('Remote commit was not confirmed')
  }
  return head
}

if (release.repository !== 'Godcount10/mmd-brown-dust-2-models' || release.ref !== 'v1.0.0'
  || manifest.repository !== release.repository || manifest.ref !== release.ref) throw new Error('Unexpected release destination')
const files = [...manifest.files, { path: 'manifest.json', bytes: manifestBytes.length,
  sha256: hash(manifestBytes), gitBlobSha: gitHash(manifestBytes) }]
console.log(`Checking ${files.length} publication files before any Git commit`)
for (const file of files) {
  const path = resolve(repo, file.path)
  if (!path.startsWith(repo + sep) || file.bytes > 95_000_000) throw new Error(`Invalid publication path: ${file.path}`)
  const bytes = await readFile(path)
  if (bytes.length !== file.bytes || hash(bytes) !== file.sha256 || gitHash(bytes) !== file.gitBlobSha) {
    throw new Error(`Publication file changed: ${file.path}`)
  }
}
if (!existsSync(join(repo, '.git'))) await git(['init', '--initial-branch=main'])
const origin = await git(['remote', 'get-url', 'origin'], undefined, [0, 2])
if (origin.code === 2) await git(['remote', 'add', 'origin', expectedRemote])
else if (origin.text !== expectedRemote) throw new Error('Unexpected origin URL')
if ((await git(['branch', '--show-current'])).text !== 'main') throw new Error('Expected main branch')
if ((await git(['diff', '--name-only'])).text) throw new Error('Tracked user changes must be preserved')
const allowed = new Set(files.map(file => file.path))
function checkStaged(names) {
  if (names.split('\0').filter(Boolean).some(path => !allowed.has(path))) throw new Error('Unrelated staged files must be preserved')
}
checkStaged((await git(['diff', '--cached', '--name-only', '-z'])).text)
const batches = []
let current = [], size = 0
for (const file of files) {
  if (current.length && size + file.bytes > 240 * 1024 ** 2) { batches.push(current); current = []; size = 0 }
  current.push(file); size += file.bytes
}
if (current.length) batches.push(current)
await mkdir(join(root, 'reports'), { recursive: true })
// Reconcile an interrupted push before staging another batch.
const priorHead = await git(['rev-parse', '--verify', 'HEAD'], undefined, [0, 128])
if (priorHead.code === 0) await push()
let publishedBytes = 0, publishedFiles = 0, head = ''
for (const [index, batch] of batches.entries()) {
  console.log(`Publishing batch ${index + 1}/${batches.length}: ${(batch.reduce((sum, row) => sum + row.bytes, 0) / 1e6).toFixed(1)} MB`)
  await git(['add', '--pathspec-from-file=-', '--pathspec-file-nul'], Buffer.from(batch.map(row => row.path).join('\0') + '\0'))
  const staged = (await git(['diff', '--cached', '--name-only', '-z'])).text
  checkStaged(staged)
  if (staged) await git(['commit', '-m', `Publish Brown Dust 2 v1 assets (${index + 1}/${batches.length})`])
  head = await push()
  publishedFiles += batch.length; publishedBytes += batch.reduce((sum, row) => sum + row.bytes, 0)
  await writeFile(progressFile, JSON.stringify({ status: 'pushing', batch: index + 1, batches: batches.length,
    publishedFiles, publishedBytes, head, updatedAt: new Date().toISOString() }, null, 2))
  console.log(`Confirmed ${index + 1}/${batches.length}: ${(publishedBytes / 1e9).toFixed(2)} GB on GitHub`)
}
// Match every remote Git blob, not merely the count or HTTP status.
const tree = JSON.parse((await command('gh', ['api', `repos/${release.repository}/git/trees/${head}?recursive=1`])).text)
if (tree.truncated) throw new Error('Remote tree response is incomplete')
const remoteFiles = new Map(tree.tree.filter(row => row.type === 'blob').map(row => [row.path, row]))
for (const file of files) {
  const remote = remoteFiles.get(file.path)
  if (!remote || remote.sha !== file.gitBlobSha || remote.size !== file.bytes) throw new Error(`Remote file mismatch: ${file.path}`)
}
const localTag = await git(['rev-parse', '--verify', `refs/tags/${release.ref}^{}`], undefined, [0, 128])
if (localTag.code === 0 && localTag.text !== head) throw new Error('Existing immutable tag points elsewhere')
if (localTag.code !== 0) await git(['tag', '-a', release.ref, '-m', 'Brown Dust 2 Spine assets and MMD playback packages', head])
await git(['push', 'origin', `refs/tags/${release.ref}:refs/tags/${release.ref}`])
const tagged = (await git(['ls-remote', '--tags', 'origin', `refs/tags/${release.ref}^{}`])).text.split(/\s+/)[0]
if (tagged !== head) throw new Error('Remote release tag was not confirmed')
await writeFile(progressFile, JSON.stringify({ status: 'complete', repository: release.repository, ref: release.ref,
  head, publishedFiles, publishedBytes, remoteBlobsVerified: files.length, updatedAt: new Date().toISOString() }, null, 2))
console.log(`Published ${release.repository}@${release.ref}: ${head}`)
