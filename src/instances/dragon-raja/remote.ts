import type { HudInstance } from '../types'
import { createDragonRajaStageRenderer } from '../../renderers/dragonRajaStageRenderer'

export const instance: HudInstance = {
  id: 'dragon-raja',
  createModules: () => ({ renderers: [createDragonRajaStageRenderer()] }),
}
