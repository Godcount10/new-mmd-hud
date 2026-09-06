import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const SPINE_ROUTE = '/_spine-models/'
const instances: Record<string, { localEntry: string; remoteEntry: string; forbiddenModules: string[] }> = JSON.parse(readFileSync(resolve('hud-instances.json'), 'utf8'))
const SPINE_LIBRARY_ROOT = resolve(
  process.cwd(),
  '..',
  'mmd-spine-models',
  'models',
  'nikke-spine-library',
)

const spineMimeTypes: Record<string, string> = {
  '.atlas': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.skel': 'application/octet-stream',
  '.webp': 'image/webp',
  '.js': 'text/javascript; charset=utf-8',
}

/** Serves the large local model library without copying it into HOST/public. */
function localSpineLibraryPlugin(): Plugin {
  return {
    name: 'local-spine-library',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : ''
        const routes = [
          [SPINE_ROUTE, SPINE_LIBRARY_ROOT],
          ['/_model-files/', resolve(SPINE_LIBRARY_ROOT, '..')],
          ['/_model-release/', resolve(process.cwd(), 'release-assets')],
          ['/_brown-model-files/', resolve(process.cwd(), '../model-resources/brown-dust-2/assets')],
          ['/_brown-model-release/', resolve(process.cwd(), 'release-assets/brown-dust-2')],
          ['/_live2d-release/', resolve(process.cwd(), '../mmd-live2d-models/azur-lane/v1')],
        ]
        const route = routes.find(([prefix]) => pathname.startsWith(prefix))
        if (!route) return next()
        let relativePath: string
        try { relativePath = decodeURIComponent(pathname.slice(route[0].length)) }
        catch { response.statusCode = 400; response.end('Invalid path'); return }
        const filePath = resolve(route[1], relativePath)
        const withinLibrary = filePath.startsWith(`${route[1]}${sep}`)
        if (!withinLibrary || !existsSync(filePath) || !statSync(filePath).isFile()) {
          response.statusCode = 404
          response.end('Not found')
          return
        }

        response.setHeader('Content-Type', spineMimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream')
        response.setHeader('Cache-Control', route[0] === '/_model-release/' ? 'no-cache' : 'public, max-age=3600')
        const stream = createReadStream(filePath)
        stream.on('error', () => { response.destroy() })
        stream.pipe(response)
      })
    },
  }
}

function hudArtifactPlugin(instanceId: string): Plugin {
  return {
    name: 'mmd-hud-artifact',
    generateBundle(_options, bundle) {
      const modules = [...new Set(Object.values(bundle).flatMap(chunk => chunk.type === 'chunk'
        ? Object.entries(chunk.modules).filter(([, info]) => info.renderedLength > 0).map(([id]) => id.replaceAll('\\', '/')) : []))]
      const forbidden = instances[instanceId].forbiddenModules
      const violations = modules.filter(id => forbidden.some(fragment => id.includes(fragment)))
      if (violations.length) this.error(`Instance ${instanceId} includes forbidden modules: ${violations.join(', ')}`)
      this.emitFile({ type: 'asset', fileName: 'bundle-modules.json', source: JSON.stringify({
        instance: instanceId, forbiddenModules: forbidden, isolationPassed: true,
        modules: modules.map(id => id.replace(process.cwd().replaceAll('\\', '/') + '/', '')),
      }, null, 2) })
      this.emitFile({
        type: 'asset',
        fileName: 'mmd-hud.snippet.html',
        source: [
          '<!-- Replace ./mmd-hud.js with the final HTTPS URL when using an external script. -->',
          '<script src="./mmd-hud.js"></script>',
        ].join('\n'),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const isHudBuild = mode === 'hud'
  const instanceId = process.env.MMD_HUD_INSTANCE || (mode === 'live2d' ? 'live2d' : mode === 'dragon-raja' ? 'dragon-raja' : 'nikke')
  if (!Object.prototype.hasOwnProperty.call(instances, instanceId)) throw new Error(`Unknown HUD instance: ${instanceId}`)
  const entry = instances[instanceId][isHudBuild || process.env.MMD_ASSETS === 'remote' ? 'remoteEntry' : 'localEntry']
  const shared = {
    resolve: { alias: { '@hud-instance': resolve(entry) } },
    define: {
      __HUD_INSTANCE__: JSON.stringify(instanceId),
      __DRAGON_RAJA_MEDIA__: JSON.stringify({
        welcomePosterUrl: '', cassellCrestUrl: '', storyDesktopUrl: '', storyMobileUrl: '',
        storyPosterUrl: '', alchemyAssetsUrl: '', localMapUrl: '', codexAssetsUrl: '',
        paperGrainUrl: '', brushFontUrl: '', storySerifFontUrl: '', storySansFontUrl: '', storyMonoFontUrl: '',
      }),
    },
  }
  if (isHudBuild) {
    return {
      ...shared,
      // Vue's runtime references process.env.NODE_ENV. The standalone bundle
      // runs directly in the MMD browser, so replace it at build time instead
      // of relying on a Node.js process global at runtime.
      define: {
        ...shared.define,
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      plugins: [vue(), hudArtifactPlugin(instanceId)],
      root: '.',
      base: './',
      build: {
        copyPublicDir: false,
        outDir: `dist-hud/${instanceId}`,
        emptyOutDir: true,
        target: 'es2020',
        sourcemap: false,
        minify: 'esbuild',
        lib: {
          entry: 'src/production/entry.ts',
          name: 'MmdHudBundle',
          formats: ['iife'] as const,
          fileName: () => 'mmd-hud.js',
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      },
    }
  }

  return {
    ...shared,
    plugins: [vue(), localSpineLibraryPlugin()],
    root: '.',
    base: './',
    server: {
      host: '127.0.0.1',
      port: instanceId === 'live2d' ? 5182 : instanceId === 'dragon-raja' ? 5183 : 5180,
    },
  }
})
