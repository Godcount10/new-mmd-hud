import { EventBus } from '../core/eventBus'
import { HudStore } from '../core/hudStore'
import { FeatureRegistry } from '../features/registry'
import type { HudEventMap, HudFeatureContext } from '../features/types'
import { createMockPlatformAdapter, type MmdPlatformAdapter } from '../platform/contracts'
import { RendererRegistry } from '../renderers/registry'
import type { MmdSdk } from '../platform/sdk'
import type { PreviewEventName } from '../types'
import type { HudFeature } from '../features/types'
import type { HudRenderer } from '../renderers/types'

export type HudRuntimeOptions = {
  platform: MmdPlatformAdapter
  store?: HudStore
  features?: FeatureRegistry
  renderers?: RendererRegistry
}

/**
 * Framework-neutral HUD orchestration. The Host supplies a platform adapter;
 * features and renderers only depend on this context.
 */
export class HudRuntime {
  readonly store: HudStore
  readonly events = new EventBus<HudEventMap>()
  readonly features: FeatureRegistry
  readonly renderers: RendererRegistry
  private readonly platform: MmdPlatformAdapter
  private readonly unsubscribers: Array<() => void> = []
  private contextCleanups: Array<() => void> = []
  private active = false

  constructor(options: HudRuntimeOptions) {
    this.platform = options.platform
    this.store = options.store ?? new HudStore()
    this.features = options.features ?? new FeatureRegistry()
    this.renderers = options.renderers ?? new RendererRegistry()
  }

  mount(): void {
    if (this.active) return
    this.active = true
    const context = this.createContext()
    for (const event of EVENT_NAMES) {
      this.unsubscribers.push(this.platform.subscribe(event, (payload) => {
        this.syncStore(event, payload)
        this.events.emit(event, payload)
      }))
    }
    this.features.mount(context)
    this.renderers.mount(context)
  }

  dispose(): void {
    if (!this.active) return
    this.renderers.dispose()
    this.features.unmount()
    for (const cleanup of this.contextCleanups.splice(0)) cleanup()
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe()
    this.events.clear()
    this.active = false
  }

  isMounted(): boolean {
    return this.active
  }

  registerFeature(feature: HudFeature): () => void {
    return this.features.register(feature)
  }

  registerRenderer(renderer: HudRenderer): () => void {
    return this.renderers.register(renderer)
  }

  private createContext(): HudFeatureContext {
    this.contextCleanups = []
    return {
      platform: this.platform,
      store: this.store,
      events: this.events,
      window: this.platform.window,
      document: this.platform.document,
      onCleanup: (cleanup) => this.contextCleanups.push(cleanup),
    }
  }

  private syncStore(event: PreviewEventName, payload?: HudEventMap[PreviewEventName]): void {
    if (event === 'theme:change' && payload?.theme) {
      this.store.setTheme(payload.theme)
      return
    }
    if (event === 'conversation:switch' && payload?.conversationId) {
      this.store.setConversation(payload.conversationId)
      return
    }
    if (event === 'input:change') {
      this.store.setInput(this.platform.sdk.input.get())
      return
    }
    if (event === 'stage:close') {
      this.store.setStage(false)
      return
    }
    if (!payload?.id || !payload.role || payload.content === undefined || !payload.state) return
    const current = this.store.getState().messages.find((message) => message.id === payload.id)
    this.store.upsertMessage({
      id: payload.id,
      role: payload.role,
      content: payload.content,
      state: payload.state,
      mounted: event === 'message:mount' ? true : event === 'message:unmount' ? false : current?.mounted ?? false,
      generated: current?.generated,
    })
  }
}

const EVENT_NAMES: PreviewEventName[] = [
  'ready', 'message:new', 'message:done', 'message:stream', 'message:mount',
  'message:unmount', 'input:change', 'conversation:switch', 'theme:change',
  'back', 'stage:close', 'dispose',
]

/** Convenience factory used by local Host code and tests. */
export function createMockHudRuntime(frameWindow: Window, sdk: MmdSdk): HudRuntime {
  const runtime = new HudRuntime({ platform: createMockPlatformAdapter(frameWindow, sdk) })
  runtime.mount()
  return runtime
}
