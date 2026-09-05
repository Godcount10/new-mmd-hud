import type { HudFeature, HudFeatureContext } from './types'

/** Registers HUD logic modules without coupling them to the Host UI. */
export class FeatureRegistry {
  private readonly features = new Map<string, HudFeature>()
  private readonly activeCleanups = new Map<string, () => void>()
  private context: HudFeatureContext | null = null

  register(feature: HudFeature): () => void {
    if (this.features.has(feature.id)) throw new Error(`HUD feature already registered: ${feature.id}`)
    this.features.set(feature.id, feature)
    if (this.context) this.mountFeature(feature, this.context)
    return () => this.unregister(feature.id)
  }

  mount(context: HudFeatureContext): void {
    this.unmount()
    this.context = context
    for (const feature of this.features.values()) this.mountFeature(feature, context)
  }

  unmount(): void {
    for (const cleanup of this.activeCleanups.values()) cleanup()
    this.activeCleanups.clear()
    this.context = null
  }

  unregister(id: string): void {
    this.activeCleanups.get(id)?.()
    this.activeCleanups.delete(id)
    this.features.delete(id)
  }

  list(): string[] {
    return [...this.features.keys()]
  }

  private mountFeature(feature: HudFeature, context: HudFeatureContext): void {
    const cleanup = feature.setup(context)
    if (cleanup) this.activeCleanups.set(feature.id, cleanup)
  }
}
