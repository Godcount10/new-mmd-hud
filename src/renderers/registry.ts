import type { HudFeatureContext } from '../features/types'
import type { HudRenderer } from './types'

/** Renderer slots for DOM, Canvas, Three.js, and Live2D modules. */
export class RendererRegistry {
  private readonly renderers = new Map<string, HudRenderer>()
  private readonly activeCleanups = new Map<string, () => void>()
  private context: HudFeatureContext | null = null

  register(renderer: HudRenderer): () => void {
    if (this.renderers.has(renderer.id)) throw new Error(`HUD renderer already registered: ${renderer.id}`)
    this.renderers.set(renderer.id, renderer)
    if (this.context) this.mountRenderer(renderer, this.context)
    return () => this.unregister(renderer.id)
  }

  mount(context: HudFeatureContext): void {
    this.dispose()
    this.context = context
    for (const renderer of this.renderers.values()) this.mountRenderer(renderer, context)
  }

  dispose(): void {
    for (const cleanup of this.activeCleanups.values()) cleanup()
    this.activeCleanups.clear()
    this.context = null
  }

  unregister(id: string): void {
    this.activeCleanups.get(id)?.()
    this.activeCleanups.delete(id)
    this.renderers.delete(id)
  }

  list(): string[] {
    return [...this.renderers.keys()]
  }

  private mountRenderer(renderer: HudRenderer, context: HudFeatureContext): void {
    const cleanup = renderer.mount(context)
    if (cleanup) this.activeCleanups.set(renderer.id, cleanup)
  }
}
