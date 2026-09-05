import type { PreviewMessage, PreviewTheme, StageMode } from '../types'

export type HudStageState = {
  visible: boolean
  mode: StageMode
}

export type HudState = {
  input: string
  composerVisible: boolean
  theme: PreviewTheme
  conversationId: string
  stage: HudStageState
  messages: PreviewMessage[]
}

export type HudStateListener = (state: Readonly<HudState>) => void

function cloneMessage(message: PreviewMessage): PreviewMessage {
  return { ...message }
}

function cloneState(state: HudState): HudState {
  return {
    ...state,
    stage: { ...state.stage },
    messages: state.messages.map(cloneMessage),
  }
}

/**
 * HUD-owned state. It deliberately knows nothing about Vue, the iframe, or
 * the MMD SDK, so the same store can be used by a game feature or a renderer.
 */
export class HudStore {
  private state: HudState
  private readonly listeners = new Set<HudStateListener>()

  constructor(initial?: Partial<HudState>) {
    this.state = {
      input: initial?.input ?? '',
      composerVisible: initial?.composerVisible ?? true,
      theme: initial?.theme ?? 'dark',
      conversationId: initial?.conversationId ?? 'local-1',
      stage: { visible: false, mode: 'content', ...initial?.stage },
      messages: initial?.messages?.map(cloneMessage) ?? [],
    }
  }

  getState(): HudState {
    return cloneState(this.state)
  }

  subscribe(listener: HudStateListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  setInput(input: string): void {
    this.state.input = input
    this.notify()
  }

  setComposerVisible(visible: boolean): void {
    this.state.composerVisible = visible
    this.notify()
  }

  setTheme(theme: PreviewTheme): void {
    this.state.theme = theme
    this.notify()
  }

  setConversation(conversationId: string): void {
    this.state.conversationId = conversationId
    this.notify()
  }

  setStage(visible: boolean, mode = this.state.stage.mode): void {
    this.state.stage = { visible, mode }
    this.notify()
  }

  resetMessages(messages: PreviewMessage[] = []): void {
    this.state.messages = messages.map(cloneMessage)
    this.notify()
  }

  upsertMessage(message: PreviewMessage): void {
    const index = this.state.messages.findIndex((candidate) => candidate.id === message.id)
    if (index < 0) this.state.messages.push(cloneMessage(message))
    else this.state.messages[index] = cloneMessage(message)
    this.notify()
  }

  updateMessage(id: string, update: Partial<PreviewMessage>): void {
    const message = this.state.messages.find((candidate) => candidate.id === id)
    if (!message) return
    Object.assign(message, update)
    this.notify()
  }

  clear(): void {
    this.state.messages = []
    this.state.input = ''
    this.state.stage = { visible: false, mode: 'content' }
    this.notify()
  }

  private notify(): void {
    const snapshot = this.getState()
    for (const listener of this.listeners) listener(snapshot)
  }
}
