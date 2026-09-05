export type GamePhase = 'idle' | 'running' | 'paused' | 'ended'

export type GameState = {
  phase: GamePhase
  tick: number
  variables: Record<string, unknown>
  flags: Record<string, boolean>
  inventory: Record<string, number>
}

export type GameAction =
  | { type: 'phase:set'; phase: GamePhase }
  | { type: 'tick' }
  | { type: 'variable:set'; key: string; value: unknown }
  | { type: 'variable:remove'; key: string }
  | { type: 'flag:set'; key: string; value: boolean }
  | { type: 'item:add'; key: string; amount?: number }
  | { type: 'item:remove'; key: string; amount?: number }
  | { type: 'reset'; state?: Partial<GameState> }

export type GameStateListener = (state: Readonly<GameState>) => void

function cloneState(state: GameState): GameState {
  return {
    phase: state.phase,
    tick: state.tick,
    variables: { ...state.variables },
    flags: { ...state.flags },
    inventory: { ...state.inventory },
  }
}

const initialState: GameState = {
  phase: 'idle',
  tick: 0,
  variables: {},
  flags: {},
  inventory: {},
}

/** Pure domain state for game systems; it never touches the DOM or MMD SDK. */
export class GameStore {
  private state: GameState
  private readonly listeners = new Set<GameStateListener>()

  constructor(initial?: Partial<GameState>) {
    this.state = {
      ...initialState,
      ...initial,
      variables: { ...initialState.variables, ...initial?.variables },
      flags: { ...initialState.flags, ...initial?.flags },
      inventory: { ...initialState.inventory, ...initial?.inventory },
    }
  }

  getState(): GameState {
    return cloneState(this.state)
  }

  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  dispatch(action: GameAction): void {
    switch (action.type) {
      case 'phase:set':
        this.state.phase = action.phase
        break
      case 'tick':
        this.state.tick += 1
        break
      case 'variable:set':
        this.state.variables[action.key] = action.value
        break
      case 'variable:remove':
        delete this.state.variables[action.key]
        break
      case 'flag:set':
        this.state.flags[action.key] = action.value
        break
      case 'item:add':
        this.state.inventory[action.key] = (this.state.inventory[action.key] ?? 0) + (action.amount ?? 1)
        break
      case 'item:remove':
        this.state.inventory[action.key] = Math.max(0, (this.state.inventory[action.key] ?? 0) - (action.amount ?? 1))
        break
      case 'reset':
        this.state = {
          ...initialState,
          ...action.state,
          variables: { ...action.state?.variables },
          flags: { ...action.state?.flags },
          inventory: { ...action.state?.inventory },
        }
        break
    }
    this.notify()
  }

  private notify(): void {
    const snapshot = this.getState()
    for (const listener of this.listeners) listener(snapshot)
  }
}
