import type { HudRenderer } from '../renderers/types'
import type { HudFeature } from '../features/types'

/** Only this instance's imports enter the dependency graph. No global module list. */
export type HudInstance = {
  id: string
  createModules(hostWindow: Window): { features?: HudFeature[]; renderers?: HudRenderer[] }
  prepareLocalInjection?(hostWindow: Window): void
}
