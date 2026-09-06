import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { gsap } from 'gsap'

export interface MotionScopeOptions {
  root?: Ref<HTMLElement | null>
}

export interface MotionScope {
  readonly reducedMotion: Readonly<Ref<boolean>>
  readonly generation: Readonly<Ref<number>>
  readonly disposed: Readonly<Ref<boolean>>
  run<T>(callback: () => T): T
  timeline(
    vars?: gsap.TimelineVars,
    build?: (timeline: gsap.core.Timeline) => void,
  ): gsap.core.Timeline
  nextGeneration(): number
  isCurrent(token: number): boolean
  delay(milliseconds: number, token?: number): Promise<boolean>
  kill(): void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useMotionScope(options: MotionScopeOptions = {}): MotionScope {
  const reducedMotion = ref(prefersReducedMotion())
  const generation = ref(0)
  const disposed = ref(false)
  const timelines = new Set<gsap.core.Timeline>()
  const delays = new Set<{
    timer: number
    resolve: (completed: boolean) => void
  }>()
  let context: gsap.Context | null = null
  let mediaQuery: MediaQueryList | null = null

  const updateReducedMotion = (event?: MediaQueryListEvent): void => {
    reducedMotion.value = event?.matches ?? mediaQuery?.matches ?? prefersReducedMotion()
  }

  onMounted(() => {
    if (disposed.value) return
    context = gsap.context(() => {}, options.root?.value ?? undefined)
    if (typeof window.matchMedia !== 'function') return
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    updateReducedMotion()
    mediaQuery.addEventListener?.('change', updateReducedMotion)
  })

  function run<T>(callback: () => T): T {
    if (!context) return callback()
    let result!: T
    context.add(() => { result = callback() })
    return result
  }

  function timeline(
    vars?: gsap.TimelineVars,
    build?: (timeline: gsap.core.Timeline) => void,
  ): gsap.core.Timeline {
    return run(() => {
      const timeline = gsap.timeline(vars)
      timelines.add(timeline)
      build?.(timeline)
      return timeline
    })
  }

  function nextGeneration(): number {
    generation.value += 1
    return generation.value
  }

  function isCurrent(token: number): boolean {
    return !disposed.value && token === generation.value
  }

  function delay(milliseconds: number, token = generation.value): Promise<boolean> {
    if (!isCurrent(token)) return Promise.resolve(false)
    if (reducedMotion.value || milliseconds <= 0) return Promise.resolve(isCurrent(token))

    return new Promise((resolve) => {
      const pending = {
        timer: 0,
        resolve,
      }
      pending.timer = window.setTimeout(() => {
        delays.delete(pending)
        resolve(isCurrent(token))
      }, milliseconds)
      delays.add(pending)
    })
  }

  function kill(): void {
    if (disposed.value) return
    disposed.value = true
    generation.value += 1
    for (const timeline of timelines) timeline.kill()
    timelines.clear()
    for (const pending of delays) {
      window.clearTimeout(pending.timer)
      pending.resolve(false)
    }
    delays.clear()
    mediaQuery?.removeEventListener?.('change', updateReducedMotion)
    mediaQuery = null
    context?.revert()
    context = null
  }

  onBeforeUnmount(kill)

  return {
    reducedMotion: computed(() => reducedMotion.value),
    generation: computed(() => generation.value),
    disposed: computed(() => disposed.value),
    run,
    timeline,
    nextGeneration,
    isCurrent,
    delay,
    kill,
  }
}
