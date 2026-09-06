<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMotionScope } from '../../../shared/motion'

const props = defineProps<{ ok: boolean; message: string }>()
const emit = defineEmits<{ dismiss: [] }>()
const root = ref<HTMLElement | null>(null)
const motion = useMotionScope({ root })
let closing = false

function dismiss(): void {
  if (closing || motion.disposed.value) return
  closing = true
  const token = motion.nextGeneration()
  if (motion.reducedMotion.value) {
    emit('dismiss')
    return
  }
  motion.timeline(undefined, (timeline) => {
    timeline.to(root.value, { autoAlpha: 0, y: 12, scale: .98, duration: .24, ease: 'power2.in' })
  })
  void motion.delay(240, token).then((completed) => {
    if (completed && motion.isCurrent(token)) emit('dismiss')
  })
}

onMounted(() => {
  if (!motion.reducedMotion.value) {
    motion.timeline(undefined, (timeline) => {
      timeline
        .fromTo(root.value, { autoAlpha: 0, y: 14, scale: .98 }, { autoAlpha: 1, y: 0, scale: 1, duration: .34, ease: 'expo.out' })
        .fromTo('.dr-toast__scan', { scaleX: 0 }, { scaleX: 1, duration: .42, ease: 'power3.out' }, .08)
    })
  }
  const displayToken = motion.nextGeneration()
  void motion.delay(3000, displayToken).then((completed) => {
    if (completed && motion.isCurrent(displayToken)) dismiss()
  })
})

onBeforeUnmount(() => motion.kill())
</script>

<template>
  <div ref="root" class="dr-toast" :class="{ error: !props.ok }" :role="props.ok ? 'status' : 'alert'" :aria-live="props.ok ? 'polite' : 'assertive'">
    <i />
    <span>{{ props.message }}</span>
    <b class="dr-toast__scan" aria-hidden="true" />
  </div>
</template>
