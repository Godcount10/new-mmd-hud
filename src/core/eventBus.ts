export type EventMap = Record<string, unknown>
export type EventName<Events extends EventMap> = keyof Events & string
export type EventListener<Payload> = (payload: Payload) => void

/** Small synchronous event bus shared by HUD features and renderers. */
export class EventBus<Events extends EventMap> {
  private readonly listeners = new Map<EventName<Events>, Set<EventListener<unknown>>>()

  on<Name extends EventName<Events>>(name: Name, listener: EventListener<Events[Name]>): () => void {
    const group = this.listeners.get(name) ?? new Set<EventListener<unknown>>()
    group.add(listener as EventListener<unknown>)
    this.listeners.set(name, group)
    return () => group.delete(listener as EventListener<unknown>)
  }

  emit<Name extends EventName<Events>>(name: Name, payload: Events[Name]): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener(payload)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
