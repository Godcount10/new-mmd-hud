import type { EventBus } from '../core/eventBus'
import type { HudStore } from '../core/hudStore'
import type { GameStore } from '../domain/gameStore'
import type { MmdPlatformAdapter } from '../platform/contracts'
import type { PreviewEventName, PreviewEventPayload } from '../types'

export type HudEventMap = {
  [Name in PreviewEventName]: PreviewEventPayload | undefined
}

export type HudFeatureContext = {
  platform: MmdPlatformAdapter
  store: HudStore
  domain: GameStore
  events: EventBus<HudEventMap>
  window: Window
  document: Document
  onCleanup(cleanup: () => void): void
}

export type HudFeature = {
  id: string
  setup(context: HudFeatureContext): void | (() => void)
}
