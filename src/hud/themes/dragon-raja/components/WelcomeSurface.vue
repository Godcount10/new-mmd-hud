<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMotionScope } from '../../../shared/motion'
import AdmissionsSealScene from './AdmissionsSealScene.vue'

const emit = defineEmits<{ enterStart: []; enter: [] }>()
const leaving = ref(false)
const root = ref<HTMLElement | null>(null)
const motion = useMotionScope({ root })

onMounted(() => {
  if (!root.value || motion.disposed.value || motion.reducedMotion.value) return

  motion.timeline(undefined, (timeline) => {
    timeline
      .fromTo('.dr-webgl-welcome__identity', { autoAlpha: 0, y: -18 }, { autoAlpha: 1, y: 0, duration: .5, ease: 'power3.out' }, 0)
      .fromTo('.dr-webgl-enter', { autoAlpha: 0, scale: .76, rotate: -12 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: .82, ease: 'expo.out' }, .1)
  })
})

function enter(): void {
  if (leaving.value || motion.disposed.value) return
  leaving.value = true
  emit('enterStart')
  const node = root.value
  if (!node || motion.reducedMotion.value) {
    emit('enter')
    return
  }

  const token = motion.nextGeneration()
  const rays = node.querySelector('.dr-webgl-welcome__rays')
  motion.timeline(undefined, (timeline) => {
    timeline
      .to('.dr-webgl-enter', { autoAlpha: 0, duration: .16, ease: 'power1.out' }, 0)
      .to('.dr-webgl-welcome__hint', { autoAlpha: 0, y: 10, duration: .2, ease: 'power2.in' }, 0)
      .to('.dr-webgl-welcome__identity > *', { y: -16, autoAlpha: 0, duration: .28, stagger: .025, ease: 'power2.in' }, .03)
      .to('.dr-webgl-welcome__scene', { scale: 1.065, y: 12, filter: 'brightness(1.28) saturate(.84)', duration: .42, ease: 'power3.inOut' }, 0)
    if (rays) timeline.to(rays, { autoAlpha: .35, scaleY: .94, duration: .38, ease: 'power2.inOut' }, 0)
    timeline
      .fromTo('.dr-welcome__threshold', { autoAlpha: 0, scaleX: .06 }, { autoAlpha: 1, scaleX: 1, duration: .3, ease: 'expo.out' }, .07)
      .to(node, { autoAlpha: 0, scale: 1.012, duration: .32, ease: 'power2.inOut' }, .12)
  })

  void motion.delay(450, token).then((completed) => {
    if (completed && motion.isCurrent(token)) emit('enter')
  })
}
</script>

<template>
  <section
    ref="root"
    class="dr-welcome dr-webgl-welcome dr-webgl-welcome--seal"
    :class="{ 'dr-welcome--leaving': leaving }"
    aria-labelledby="dr-welcome-title"
  >
    <AdmissionsSealScene />

    <div class="dr-welcome__threshold" aria-hidden="true"><i /></div>

    <header class="dr-webgl-welcome__identity">
      <h1 id="dr-welcome-title">龙族</h1>
      <p class="dr-webgl-welcome__subtitle">DRAGON RAJA</p>
    </header>

    <button
      type="button"
      class="dr-webgl-enter dr-webgl-enter--transparent-letter"
      :disabled="leaving"
      :aria-busy="leaving"
      aria-label="启封录取信"
      @click="enter"
    >
      <span class="dr-visually-hidden">{{ leaving ? '身份核验中' : '启封录取信' }}</span>
    </button>

  </section>
</template>
