import type { HudFeatureContext } from '../features/types'

export type HudRenderer = {
  id: string
  mount(context: HudFeatureContext): void | (() => void)
}
