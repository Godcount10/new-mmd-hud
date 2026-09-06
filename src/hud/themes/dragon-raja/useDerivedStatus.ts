import { computed, type Ref } from 'vue'
import type { ChatSnapshot } from '../../../contracts'
import { hasDerivedMarkers, parseDerivedMarkers } from './parseDerivedMarkers'
import type { DerivedDossier, DerivedStatus } from './types'

const EMPTY: DerivedDossier = Object.freeze({
  time: '',
  characters: Object.freeze([]),
  options: Object.freeze([]),
  forum: null,
  statuses: Object.freeze([]),
  hasContent: false,
})

/**
 * Reads the dossier from assistant text only. Whole-snapshot semantics: the most recent assistant
 * message carrying any marker defines the entire panel and every earlier message is ignored. Values
 * are never merged across messages, so a repeated slot cannot compose one character out of two
 * different people, and a field the assistant stops sending simply disappears.
 *
 * Temporary, read-only, and never written back to the native Snapshot.
 */
export function useDerivedDossier(snapshot: Readonly<Ref<ChatSnapshot>>) {
  return computed<DerivedDossier>(() => {
    for (let index = snapshot.value.messages.length - 1; index >= 0; index -= 1) {
      const message = snapshot.value.messages[index]
      if (!message || message.role !== 'assistant') continue
      if (!hasDerivedMarkers(message.text)) continue
      return parseDerivedMarkers(message.text)
    }
    return EMPTY
  })
}

/** Free-form `[A=B]` pairs that are not part of the reserved dossier vocabulary. */
export function useDerivedStatus(snapshot: Readonly<Ref<ChatSnapshot>>) {
  const dossier = useDerivedDossier(snapshot)
  return computed<DerivedStatus[]>(() => [...dossier.value.statuses].slice(-6))
}
