import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const SPINE_ROUTE = '/_spine-models/'
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

function hudArtifactPlugin(): Plugin {
  return {
    name: 'mmd-hud-artifact',
    generateBundle() {
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
  if (isHudBuild) {
    return {
      // Vue's runtime references process.env.NODE_ENV. The standalone bundle
      // runs directly in the MMD browser, so replace it at build time instead
      // of relying on a Node.js process global at runtime.
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      plugins: [vue(), hudArtifactPlugin()],
      root: '.',
      base: './',
      build: {
        copyPublicDir: false,
        outDir: 'dist-hud',
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
    plugins: [vue(), localSpineLibraryPlugin()],
    root: '.',
    base: './',
    server: {
      host: '127.0.0.1',
      port: 5180,
    },
  }
})
