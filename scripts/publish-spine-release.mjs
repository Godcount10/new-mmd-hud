#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const repo = resolve(root, '../mmd-spine-models')
const manifest = JSON.parse(await readFile(join(root, 'release-assets/publish-manifest.json'), 'utf8'))
const progressFile = join(root, 'reports/spine-publish-progress.json')
const expectedRemote = 'https://github.com/Godcount10/mmd-models.git'
const batchLimit = 256 * 1024 * 1024
const gitOptions = ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-c', 'core.autocrlf=false']

function git(args, { input, visible = false, allowed = [0] } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn('git', [...gitOptions, ...args], {
      cwd: repo, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const out = [], err = []
    child.stdout.on('data', chunk => { out.push(chunk); if (visible) process.stdout.write(chunk) })
    child.stderr.on('data', chunk => { err.push(chunk); if (visible) process.stderr.write(chunk) })
    child.on('error', reject)
    child.on('close', code => {
      const stdout = Buffer.concat(out).toString('utf8'), stderr = Buffer.concat(err).toString('utf8')
      if (!allowed.includes(code)) reject(new Error(`git ${args[0]} failed (${code}): ${stderr.slice(-5000)}`))
      else resolveResult({ stdout, stderr, code })
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}

function targetPath(destination) {
  if (!/^(?:hud-assets\/v2\/|models\/(?:nikke-db-2026-08-26|nikke-spine-library)\/)/.test(destination)) {
    throw new Error(`Unexpected publication target: ${destination}`)
  }
  const path = resolve(repo, destination)
  if (!path.startsWith(`${repo}${sep}`)) throw new Error(`Target escapes repository: ${destination}`)
  return path
}

async function pushMain() {
  const head = (await git(['rev-parse', 'HEAD'])).stdout.trim()
  // Do not force, and reconcile an interrupted push before adding the next batch.
  const remote = (await git(['ls-remote', '--heads', 'origin', 'main'])).stdout.trim().split(/\s+/)[0]
  if (remote === head) return
  await git(['fetch', '--no-tags', 'origin', 'main'])
  const ancestor = await git(['merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD'], { allowed: [0, 1] })
  if (ancestor.code !== 0) throw new Error('Remote main contains new changes; refusing to overwrite or auto-merge.')
  await git(['push', 'origin', 'HEAD:refs/heads/main'], { visible: true })
  const confirmed = (await git(['ls-remote', '--heads', 'origin', 'main'])).stdout.trim().split(/\s+/)[0]
  if (confirmed !== head) throw new Error('Remote main did not confirm the pushed commit.')
}

try {
  if (manifest.repository !== 'Godcount10/mmd-models' || manifest.ref !== 'v2.0.0') throw new Error('Unexpected release destination.')
  if ((await git(['remote', 'get-url', 'origin'])).stdout.trim() !== expectedRemote) throw new Error('Remote URL does not match the requested repository.')
  if ((await git(['branch', '--show-current'])).stdout.trim() !== 'main') throw new Error('Expected the main branch.')
  const dirtyTracked = (await git(['diff', '--name-only'])).stdout.trim()
  if (dirtyTracked) throw new Error(`Tracked files have user changes: ${dirtyTracked}`)
  const allowedPaths = new Set(manifest.files.map(file => file.destination))
  allowedPaths.add('hud-assets/v2/manifest.json')
  allowedPaths.add('hud-assets/v2/README.md')
  const staged = (await git(['diff', '--cached', '--name-only', '-z'])).stdout.split('\0').filter(Boolean)
  if (staged.some(path => !allowedPaths.has(path))) throw new Error('Unrelated staged files exist; refusing to include them.')
  const existingTag = (await git(['ls-remote', '--tags', 'origin', 'refs/tags/v2.0.0', 'refs/tags/v2.0.0^{}'])).stdout.trim()
  if (existingTag) throw new Error('v2.0.0 already exists remotely; refusing to move an immutable release tag.')

  console.log(`Preparing ${manifest.totalFiles} publication files (${(manifest.totalBytes / 1e9).toFixed(2)} GB).`)
  for (const file of manifest.files) {
    const target = targetPath(file.destination), source = resolve(file.localPath)
    const sourceAllowed = source.startsWith(`${resolve(root, 'release-assets')}${sep}`)
      || source.startsWith(`${resolve(repo, 'models')}${sep}`)
    if (!sourceAllowed || (await stat(source)).size !== file.bytes) throw new Error(`Source changed or outside scope: ${file.destination}`)
    if (source === target) continue
    await mkdir(dirname(target), { recursive: true })
    try { await copyFile(source, target, constants.COPYFILE_EXCL) }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      const digest = createHash('sha256').update(await readFile(target)).digest('hex')
      if (digest !== file.sha256) throw new Error(`Existing destination differs: ${file.destination}`)
    }
  }
  const publicManifest = {
    version: '2.0.0', directories: 730, variants: 1756, spineVersions: ['4.0', '4.1'],
    totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes,
    files: manifest.files.map(({ destination, bytes, sha256 }) => ({ path: destination, bytes, sha256 })),
    sources: ['https://github.com/Nikke-db/Nikke-db.github.io', 'https://github.com/fatboytao/NikkeSpine'],
  }
  const publicFiles = [
    ['hud-assets/v2/manifest.json', `${JSON.stringify(publicManifest, null, 2)}\n`],
    ['hud-assets/v2/README.md', [
      '# NIKKE HUD Asset Release v2', '',
      '730 catalog entries and 1,756 model variants for the MMD HUD. Runtime versions: Spine 4.0 and 4.1.', '',
      '- packages/: skeleton and atlas data registered by browser scripts, avoiding cross-origin XHR.',
      '- thumbnails/: small static gallery previews; no model package is required to browse them.',
      '- ../../models/nikke-db-2026-08-26/ and ../../models/nikke-spine-library/: referenced PNG textures.',
      '- manifest.json: published paths, transfer sizes and SHA-256 hashes. No local workstation paths.', '',
      'The original .skel and .atlas data is contained in each packages/*.js file as Base64.',
      'Use the immutable v2.0.0 tag, not main, for production CDN URLs.',
      'Model/source ownership remains with the respective rights holders. Runtime licenses are separate.', '',
    ].join('\n')],
  ]
  for (const [destination, contents] of publicFiles) {
    const path = targetPath(destination)
    await mkdir(dirname(path), { recursive: true })
    try { await writeFile(path, contents, { flag: 'wx' }) }
    catch (error) { if (error.code !== 'EEXIST' || await readFile(path, 'utf8') !== contents) throw error }
  }

  // Only publish listed runtime assets, not raw download reports or local scripts.
  const allFiles = [...manifest.files, ...publicFiles.map(([destination, contents]) => ({ destination, bytes: Buffer.byteLength(contents) }))]
  const batches = []
  let current = [], bytes = 0
  for (const file of allFiles) {
    if (current.length && bytes + file.bytes > batchLimit) { batches.push(current); current = []; bytes = 0 }
    current.push(file); bytes += file.bytes
  }
  if (current.length) batches.push(current)
  await pushMain()
  let publishedBytes = 0, publishedFiles = 0
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index]
    console.log(`Batch ${index + 1}/${batches.length}: ${batch.length} files, ${(batch.reduce((sum, file) => sum + file.bytes, 0) / 1e6).toFixed(1)} MB.`)
    const names = batch.map(file => file.destination)
    await git(['add', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: Buffer.from(`${names.join('\0')}\0`) })
    const stagedNow = (await git(['diff', '--cached', '--name-only', '-z'])).stdout.split('\0').filter(Boolean)
    if (stagedNow.some(path => !allowedPaths.has(path))) throw new Error('Unrelated index changes appeared while publishing.')
    if (stagedNow.length) {
      await git(['commit', '-m', `Publish NIKKE HUD v2 assets (${index + 1}/${batches.length})`])
    }
    await pushMain()
    publishedBytes += batch.reduce((sum, file) => sum + file.bytes, 0)
    publishedFiles += batch.length
    const progress = { status: 'pushing', batch: index + 1, batches: batches.length, publishedFiles, publishedBytes,
      head: (await git(['rev-parse', 'HEAD'])).stdout.trim(), updatedAt: new Date().toISOString() }
    await writeFile(progressFile, JSON.stringify(progress, null, 2))
    console.log(`Confirmed ${index + 1}/${batches.length}: ${(publishedBytes / 1e9).toFixed(2)} GB on GitHub.`)
  }
  const head = (await git(['rev-parse', 'HEAD'])).stdout.trim()
  const localTag = await git(['rev-parse', '--verify', 'refs/tags/v2.0.0^{}'], { allowed: [0, 128] })
  if (localTag.code === 0 && localTag.stdout.trim() !== head) throw new Error('Existing local v2.0.0 points elsewhere.')
  if (localTag.code !== 0) await git(['tag', '-a', 'v2.0.0', '-m', 'NIKKE HUD: merged catalog assets for Spine 4.0 and 4.1', head])
  await git(['push', 'origin', 'refs/tags/v2.0.0:refs/tags/v2.0.0'], { visible: true })
  const tag = (await git(['ls-remote', '--tags', 'origin', 'refs/tags/v2.0.0^{}'])).stdout.trim().split(/\s+/)[0]
  if (tag !== head) throw new Error('Remote release tag did not confirm the final commit.')
  await writeFile(progressFile, JSON.stringify({ status: 'complete', repository: manifest.repository, tag: 'v2.0.0', head,
    publishedFiles, publishedBytes, updatedAt: new Date().toISOString() }, null, 2))
  console.log(`Published v2.0.0 at ${head}.`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
