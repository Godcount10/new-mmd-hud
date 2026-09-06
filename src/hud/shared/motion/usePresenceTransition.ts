import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { MotionScope } from './useMotionScope'

export type PresencePhase = 'closed' | 'entering' | 'open' | 'leaving'

export interface PresenceTransition {
  readonly mounted: ComputedRef<boolean>
  readonly phase: Readonly<Ref<PresencePhase>>
  readonly generation: Readonly<Ref<number>>
  show(): Promise<boolean>
  hide(): Promise<boolean>
  toggle(visible: boolean): Promise<boolean>
}

type TransitionDirection = 'show' | 'hide'

interface PendingTransition {
  direction: TransitionDirection
  promise: Promise<boolean>
}

export function usePresenceTransition(
  visible: Readonly<Ref<boolean>>,
  motion: MotionScope,
  duration = 360,
): PresenceTransition {
  const phase = ref<PresencePhase>(visible.value ? 'open' : 'closed')
  const generation = ref(0)
  const mounted = computed(() => phase.value !== 'closed')
  let pending: PendingTransition | null = null

  function begin(
    direction: TransitionDirection,
    transitionPhase: PresencePhase,
    settledPhase: PresencePhase,
  ): Promise<boolean> {
    if (motion.disposed.value) return Promise.resolve(false)

    const token = ++generation.value
    const motionToken = motion.nextGeneration()
    phase.value = transitionPhase

    if (motion.reducedMotion.value || duration <= 0) {
      phase.value = settledPhase
      pending = null
      return Promise.resolve(true)
    }

    const transition: PendingTransition = {
      direction,
      promise: Promise.resolve(false),
    }
    transition.promise = motion.delay(duration, motionToken).then((completed) => {
      const current = completed
        && !motion.disposed.value
        && token === generation.value
        && pending === transition
      if (current) phase.value = settledPhase
      if (pending === transition) pending = null
      return current
    })
    pending = transition
    return transition.promise
  }

  function show(): Promise<boolean> {
    if (phase.value === 'open') return Promise.resolve(true)
    if (phase.value === 'entering' && pending?.direction === 'show') return pending.promise
    return begin('show', 'entering', 'open')
  }

  function hide(): Promise<boolean> {
    if (phase.value === 'closed') return Promise.resolve(true)
    if (phase.value === 'leaving' && pending?.direction === 'hide') return pending.promise
    return begin('hide', 'leaving', 'closed')
  }

  function toggle(nextVisible: boolean): Promise<boolean> {
    return nextVisible ? show() : hide()
  }

  watch(visible, (nextVisible) => {
    void toggle(nextVisible)
  })

  onBeforeUnmount(() => {
    ++generation.value
    pending = null
  })

  return { mounted, phase, generation, show, hide, toggle }
}
