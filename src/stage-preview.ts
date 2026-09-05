import { createPreviewRuntime } from './app/createPreviewRuntime'
import { MockMmdRuntime } from './runtime/mockMmd'
import { currentCard } from './card/currentCard'
import { localNikkeCatalog } from './renderers/spine/nikkeCatalog.local'
import type { CardRule } from './types'

async function start(): Promise<void> {
  if (new URLSearchParams(location.search).has('audit')) {
    const update = () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      document.documentElement.dataset.modelRequests = String(resources.filter(row => /\/(?:packages|_model-files)\//.test(row.name)).length)
      document.documentElement.dataset.modelScripts = String(resources.filter(row => /\/packages\//.test(row.name)).length)
    }
    const observer = new PerformanceObserver(update)
    observer.observe({ type: 'resource', buffered: true })
    update()
  }
  const options = { onLog: () => undefined, onEvent: () => undefined }
  if (new URLSearchParams(location.search).has('injection')) {
    const response = await fetch('/dist-hud/mmd-hud.json')
    if (!response.ok) throw new Error('Build the HUD JSON before running the injection preview.')
    const card = await response.json() as { statusbar: string; regex_scripts: CardRule[] }
    window.__MMD_SPINE_CATALOG_OVERRIDE__ = localNikkeCatalog
    const runtime = new MockMmdRuntime(window, options)
    // Match the relevant official restriction after the test fixture is read.
    const csp = document.createElement('meta')
    csp.httpEquiv = 'Content-Security-Policy'
    csp.content = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://cdn.jsdelivr.net"
    document.head.appendChild(csp)
    runtime.mount({ name: '注入构建验证', statusbar: '', beginning: '', rules: [] })
    let html = card.statusbar
    for (const rule of card.regex_scripts) {
      html = html.replace(rule.findRegex, () => rule.replaceString.replace(/\$\d+/g, ''))
    }
    const fragments = document.createElement('template')
    fragments.innerHTML = html
    for (const fragment of fragments.content.querySelectorAll('script')) {
      const script = document.createElement('script')
      script.textContent = fragment.textContent
      document.head.appendChild(script)
    }
  } else {
    const runtime = createPreviewRuntime(window, options)
    runtime.mount(currentCard)
    runtime.sdk.stage.open('full')
  }
}
void start().catch(error => { document.body.textContent = String(error) })
