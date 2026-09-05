import type { PreviewEventName, PreviewEventPayload, StageMode } from '../types'

/** Public SDK surface consumed by HUD code in both local and production hosts. */
export type MmdSdk = {
  input: {
    get(): string
    set(text: string): void
    add(text: string): void
    insert(text: string): void
    clear(): void
    focus(): void
    blur(): void
    getCursor(): number
    setCursor(position: number): void
  }
  composer: {
    show(): void
    hide(): void
    visible(): boolean
  }
  message: {
    send(text?: string): Promise<void>
    edit(id: string, text: string): Promise<void>
  }
  cache: {
    get(key: string): unknown
    set(key: string, value: unknown): void
    remove(key: string): void
  }
  save: {
    get(key: string): unknown
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
    keys(): string[]
  }
  stage: {
    open(mode?: StageMode): void
    close(): void
    el(): HTMLElement | null
    visible(): boolean
  }
  role: { get(): { name: string; avatarUrl: string } }
  user: { get(): { nickname: string; avatarUrl: string } }
  on(event: PreviewEventName, callback: (payload?: PreviewEventPayload) => void): () => void
  debug: { log(...args: unknown[]): void }
  version: string
}
