<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'
import {
  describeAdmissionsSealSceneFailure,
  mountAdmissionsSealScene,
  type AdmissionsSealSceneController,
  type AdmissionsSealSceneFailure,
} from './admissionsSealScene'
import LightRays, { type RaysOrigin } from './LightRays.vue'

interface ActiveLightRays {
  background: string
  brightness: number
  raysOrigin: RaysOrigin
  raysColor: string
  raysSpeed: number
  lightSpread: number
  rayLength: number
  pulsating: boolean
  fadeDistance: number
  saturation: number
  followMouse: boolean
  mouseInfluence: number
  noiseAmount: number
  distortion: number
}

const root = ref<HTMLElement | null>(null)
const sceneFailure = ref<AdmissionsSealSceneFailure | null>(null)
const lightRaysFailure = ref<AdmissionsSealSceneFailure | null>(null)
const failure = computed(() => sceneFailure.value ?? lightRaysFailure.value)
const lightRays = ref<ActiveLightRays | null>(null)
const showFailureDetails = import.meta.env.DEV
const canvasCandidates = new Set<HTMLCanvasElement>()
let activeCanvas: HTMLCanvasElement | null = null
let controller: AdmissionsSealSceneController | null = null
let observer: MutationObserver | null = null
let mountGeneration = 0
let activeSceneSignature = ''

function disposeController(releaseContext: boolean): void {
  controller?.dispose({ releaseContext })
  controller = null
}

function setCanvasRef(element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLCanvasElement) canvasCandidates.add(element)
}

function syncCanvasCandidates(): void {
  for (const canvas of canvasCandidates) {
    if (!canvas.isConnected || !root.value?.contains(canvas)) canvasCandidates.delete(canvas)
  }
  root.value
    ?.querySelectorAll<HTMLCanvasElement>('canvas.dr-webgl-welcome__scene')
    .forEach(canvas => canvasCandidates.add(canvas))
}

function isSelectedCanvas(element: HTMLCanvasElement): boolean {
  const liveVariant = element.closest<HTMLElement>('[data-impeccable-variant]')
  if (liveVariant) {
    if (!element.isConnected) return false
    const variantStyle = window.getComputedStyle(liveVariant)
    return variantStyle.display !== 'none'
      && variantStyle.visibility !== 'hidden'
      && variantStyle.visibility !== 'collapse'
  }

  return Boolean(root.value?.contains(element))
}

function resolveLightRays(canvas: HTMLCanvasElement): ActiveLightRays | null {
  if (canvas.classList.contains('dr-webgl-welcome__scene--imperial-crown')) {
    return {
      background: '#070302',
      brightness: 1.155,
      raysOrigin: 'top-center',
      raysColor: '#ffd184',
      raysSpeed: .61,
      lightSpread: .47,
      rayLength: 3.2,
      pulsating: true,
      fadeDistance: 1.72,
      saturation: 1.08,
      followMouse: false,
      mouseInfluence: 0,
      noiseAmount: .025,
      distortion: .035,
    }
  }
  if (canvas.classList.contains('dr-webgl-welcome__scene--light-rays-embers')) {
    return {
      background: '#070302',
      brightness: 1,
      raysOrigin: 'top-center',
      raysColor: '#ffbd68',
      raysSpeed: .64,
      lightSpread: .5,
      rayLength: 3,
      pulsating: true,
      fadeDistance: 1.6,
      saturation: 1.08,
      followMouse: false,
      mouseInfluence: 0,
      noiseAmount: .035,
      distortion: .06,
    }
  }

  return null
}

function resolveSceneSignature(canvas: HTMLCanvasElement): string {
  return canvas.className
}

function mountActiveCanvas(): void {
  syncCanvasCandidates()
  const nextCanvas = [...canvasCandidates].find(isSelectedCanvas) ?? null
  const nextSignature = nextCanvas ? resolveSceneSignature(nextCanvas) : ''
  lightRays.value = nextCanvas ? resolveLightRays(nextCanvas) : null
  if (nextCanvas === activeCanvas && nextSignature === activeSceneSignature) return

  if (!nextCanvas) {
    if (activeCanvas && !activeCanvas.isConnected) {
      mountGeneration += 1
      disposeController(true)
      activeCanvas = null
      activeSceneSignature = ''
    }
    return
  }

  const generation = ++mountGeneration
  const releasePreviousContext = activeCanvas !== null
    && (!activeCanvas.isConnected || !root.value?.contains(activeCanvas))
  disposeController(releasePreviousContext)
  activeCanvas = nextCanvas
  activeSceneSignature = nextSignature
  sceneFailure.value = null
  lightRaysFailure.value = null

  try {
    controller = mountAdmissionsSealScene(nextCanvas, {
      onFailure: (nextFailure) => {
        if (generation === mountGeneration && activeCanvas === nextCanvas) sceneFailure.value = nextFailure
      },
      onRecovery: () => {
        if (generation === mountGeneration && activeCanvas === nextCanvas) sceneFailure.value = null
      },
    })
  } catch (error) {
    if (generation === mountGeneration && activeCanvas === nextCanvas) {
      sceneFailure.value = describeAdmissionsSealSceneFailure(error)
    }
  }
}

function handleLightRaysFailure(error: Error): void {
  lightRaysFailure.value = {
    code: 'renderer-initialization-failed',
    message: `LightRays: ${error.message}`,
  }
}

function handleLightRaysRecovery(): void {
  lightRaysFailure.value = null
}

onMounted(() => {
  mountActiveCanvas()
  requestAnimationFrame(mountActiveCanvas)

  if (!root.value || typeof MutationObserver === 'undefined') return
  observer = new MutationObserver(() => {
    mountActiveCanvas()
    requestAnimationFrame(mountActiveCanvas)
  })
  observer.observe(root.value, {
    attributes: true,
    attributeFilter: ['class', 'style'],
    childList: true,
    subtree: true,
  })
  observer.observe(document.head, {
    childList: true,
    characterData: true,
    subtree: true,
  })
})

onBeforeUnmount(() => {
  mountGeneration += 1
  observer?.disconnect()
  observer = null
  disposeController(true)
  activeCanvas = null
  activeSceneSignature = ''
  lightRays.value = null
  canvasCandidates.clear()
})
</script>

<template>
  <div
    ref="root"
    class="dr-webgl-welcome__visual"
    :class="{ 'dr-webgl-welcome__visual--fallback': failure }"
    :data-webgl-status="failure ? 'fallback' : 'active'"
    :data-webgl-failure-code="failure?.code"
    :data-webgl-failure-detail="failure?.message"
    aria-hidden="true"
  >
    <div class="dr-webgl-welcome__fallback" />

    <div
      v-if="lightRays && !sceneFailure"
      class="dr-webgl-welcome__rays"
      :style="{ backgroundColor: lightRays.background, filter: `brightness(${lightRays.brightness})` }"
    >
      <LightRays
        :rays-origin="lightRays.raysOrigin"
        :rays-color="lightRays.raysColor"
        :rays-speed="lightRays.raysSpeed"
        :light-spread="lightRays.lightSpread"
        :ray-length="lightRays.rayLength"
        :pulsating="lightRays.pulsating"
        :fade-distance="lightRays.fadeDistance"
        :saturation="lightRays.saturation"
        :follow-mouse="lightRays.followMouse"
        :mouse-influence="lightRays.mouseInfluence"
        :noise-amount="lightRays.noiseAmount"
        :distortion="lightRays.distortion"
        @failure="handleLightRaysFailure"
        @recovery="handleLightRaysRecovery"
      />
    </div>
    <p class="dr-webgl-welcome__hint">点击信封以开始游戏...</p>
    <canvas
      :ref="setCanvasRef"
      class="dr-webgl-welcome__scene dr-webgl-welcome__scene--light-rays-embers dr-webgl-welcome__scene--imperial-crown dr-webgl-welcome__scene--cassell-crimson"
    />



    <output v-if="showFailureDetails && failure" class="dr-webgl-welcome__diagnostic">
      <b>WebGL diagnostic</b>
      <span>{{ failure.code }}</span>
      <small>{{ failure.message }}</small>
    </output>

  </div>
</template>

<style scoped>
.dr-webgl-welcome__hint {
  position: absolute;
  z-index: 3;
  top: calc(52.5% + clamp(150px, 17vw, 270px) + 18px);
  left: 50%;
  width: min(88vw, 520px);
  margin: 0;
  translate: -50% 0;
  color: transparent;
  background: linear-gradient(90deg, #b99761, #ffbd68 48%, #d84624);
  background-clip: text;
  font: 600 16px/1.5 var(--dr-font-serif);
  letter-spacing: 0;
  text-align: center;
  pointer-events: none;
}

@media (max-width: 700px) {
  .dr-webgl-welcome__hint {
    font-size: 15px;
  }
}
</style>
