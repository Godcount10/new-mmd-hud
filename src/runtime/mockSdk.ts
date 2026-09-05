import type { PreviewEventName, PreviewEventPayload, PreviewLog, PreviewTheme, SdkError, SdkErrorCode, StageMode } from '../types'
import type { MmdSdk } from '../platform/sdk'

export type MockSdkHost = {
  getInput(): string
  setInput(value: string): void
  setComposerVisible(visible: boolean): void
  isComposerVisible(): boolean
  sendMessage(text?: string): Promise<void>
  editMessage(id: string, text: string): Promise<void>
  getStage(): HTMLElement | null
  openStage(mode: StageMode): void
  closeStage(): void
  isStageVisible(): boolean
  getRole(): { name: string; avatarUrl: string }
  getUser(): { nickname: string; avatarUrl: string }
  debugLog(...args: unknown[]): void
  onLog(log: Omit<PreviewLog, 'id' | 'time'>): void
  onEvent(name: PreviewEventName, payload?: PreviewEventPayload): void
}

export type MockSdk = MmdSdk & {
  /** Internal lifecycle bridge used by the Host, intentionally undocumented. */
  __emitEvent(name: PreviewEventName, payload?: PreviewEventPayload): void
  __resetEvents(): void
}

export function createMockSdk(host: MockSdkHost): MockSdk {
  const cache = new Map<string, unknown>()
  const save = new Map<string, unknown>()
  const listeners = new Map<PreviewEventName, Set<(payload?: PreviewEventPayload) => void>>()
  const lastEvents = new Map<PreviewEventName, PreviewEventPayload | undefined>()

  const on = (event: PreviewEventName, callback: (payload?: PreviewEventPayload) => void): (() => void) => {
    const group = listeners.get(event) ?? new Set()
    group.add(callback)
    listeners.set(event, group)
    if (event === 'ready' && lastEvents.has(event)) {
      queueMicrotask(() => callback(lastEvents.get(event)))
    }
    return () => group.delete(callback)
  }

  const emit = (event: PreviewEventName, payload?: PreviewEventPayload): void => {
    lastEvents.set(event, payload)
    host.onEvent(event, payload)
    for (const callback of listeners.get(event) ?? []) {
      try {
        callback(payload)
      } catch (error) {
        host.onLog({ kind: 'error', label: `${event} 回调异常`, detail: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  const fail = (code: SdkErrorCode, message: string): never => {
    const error = new Error(message) as SdkError
    error.code = code
    throw error
  }

  const sdk: MockSdk = {
    input: {
      get: () => host.getInput(),
      set: (text) => host.setInput(String(text)),
      add: (text) => host.setInput(`${host.getInput()}${String(text)}`),
      insert: (text) => {
        const current = host.getInput()
        const position = sdk.input.getCursor()
        host.setInput(`${current.slice(0, position)}${String(text)}${current.slice(position)}`)
        sdk.input.setCursor(position + String(text).length)
      },
      clear: () => host.setInput(''),
      focus: () => host.onLog({ kind: 'sdk', label: 'sdk.input.focus' }),
      blur: () => host.onLog({ kind: 'sdk', label: 'sdk.input.blur' }),
      getCursor: () => {
        const input = host.getStage()?.ownerDocument.querySelector<HTMLInputElement>('[data-chat="input"] textarea, [data-chat="input"] input')
        return input?.selectionStart ?? host.getInput().length
      },
      setCursor: (position) => {
        const input = host.getStage()?.ownerDocument.querySelector<HTMLInputElement>('[data-chat="input"] textarea, [data-chat="input"] input')
        input?.setSelectionRange(Math.max(0, position), Math.max(0, position))
      },
    },
    composer: {
      show: () => host.setComposerVisible(true),
      hide: () => host.setComposerVisible(false),
      visible: () => host.isComposerVisible(),
    },
    message: {
      send: (text) => host.sendMessage(text),
      edit: (id, text) => host.editMessage(String(id), String(text)),
    },
    cache: {
      get: (key) => cache.get(key),
      set: (key, value) => cache.set(key, value),
      remove: (key) => cache.delete(key),
    },
    save: {
      get: (key) => save.get(key),
      set: async (key, value) => {
        if (!key || key.length > 64 || key.includes(':')) fail('INVALID_ARGS', '存档 key 无效')
        if (!save.has(key) && save.size >= 10) fail('RATE_LIMITED', '本地 Host 最多保存 10 个存档 key')
        try { structuredClone(value) } catch { fail('INVALID_ARGS', '存档值必须可以被 JSON/结构化克隆') }
        save.set(key, structuredClone(value))
      },
      remove: async (key) => { save.delete(key) },
      keys: () => [...save.keys()],
    },
    stage: {
      open: (mode = 'content') => host.openStage(mode),
      close: () => host.closeStage(),
      el: () => host.getStage(),
      visible: () => host.isStageVisible(),
    },
    role: { get: () => host.getRole() },
    user: { get: () => host.getUser() },
    on,
    debug: { log: (...args) => host.debugLog(...args) },
    version: '1',
    __emitEvent: () => undefined,
    __resetEvents: () => undefined,
  }

  sdk.__emitEvent = emit
  sdk.__resetEvents = () => {
    listeners.clear()
    lastEvents.clear()
  }
  return sdk
}
