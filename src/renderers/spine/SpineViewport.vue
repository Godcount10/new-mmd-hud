<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Pause, Play, RotateCcw, RefreshCw } from 'lucide-vue-next'
import type { SpineAssetConfig, SpineLoadStatus, SpinePlayer } from './spineTypes'
import { mountSpineRenderer } from './spineRenderer'
import { resolveSpineAssetConfig } from './spinePackageLoader'

const props = defineProps<{ config: SpineAssetConfig; hostDocument: Document; hostWindow: Window; showMeta?: boolean }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const canvasKey = ref(0)
const status = ref<SpineLoadStatus>({ state: 'loading', label: props.config.label })
const animation = ref(props.config.animation ?? ''), skin = ref(props.config.skin ?? '')
const paused = ref(false), zoom = ref(1)
let player: SpinePlayer | null = null
let observer: ResizeObserver | null = null
let controller: AbortController | null = null
let generation = 0

async function load(): Promise<void> {
  const current = ++generation
  controller?.abort()
  player?.dispose()
  observer?.disconnect()
  player = null
  controller = new AbortController()
  status.value = { state: 'loading', label: props.config.label }
  canvasKey.value++
  paused.value = false; zoom.value = 1
  await nextTick()
  if (current !== generation || !canvas.value) return
  observer = new ResizeObserver(() => player?.resize())
  observer.observe(canvas.value)
  try {
    const config = await resolveSpineAssetConfig(props.config, props.hostDocument, props.hostWindow, controller.signal)
    if (current !== generation || !canvas.value) return
    player = mountSpineRenderer(canvas.value, config, { onStatus: value => {
      if (current !== generation) return
      status.value = value
      if (value.state === 'ready') {
        animation.value = value.animations.includes(config.animation ?? '') ? config.animation! : value.animations[0] ?? ''
        skin.value = config.skin ?? (value.skins.includes('default') ? 'default' : value.skins[0]) ?? ''
      }
    } })
    await player.ready
  } catch (error) {
    if (current !== generation) return
    status.value = { state: 'error', label: props.config.label, message: error instanceof Error ? error.message : String(error) }
  }
}
function togglePause(): void { paused.value = !paused.value; player?.setPaused(paused.value) }
function resetCamera(): void { zoom.value = 1; player?.setZoom(1) }
function changeAnimation(): void { player?.play(animation.value) }
function changeSkin(): void { player?.setSkin(skin.value) }
function changeZoom(): void { player?.setZoom(zoom.value) }
onMounted(() => { void load() })
onBeforeUnmount(() => {
  generation++
  controller?.abort()
  observer?.disconnect()
  player?.dispose()
})
</script>

<template>
  <section class="spine-player" :data-spine-state="status.state" :data-spine-version="props.config.runtimeVersion ?? '4.0'">
    <div class="spine-viewport">
      <canvas :key="canvasKey" ref="canvas" class="spine-viewport__canvas" :aria-label="`${props.config.label} Spine 模型`"></canvas>
      <div v-if="status.state !== 'ready'" class="spine-viewport__status" role="status">
        <span v-if="status.state === 'loading'" class="spine-viewport__spinner" aria-hidden="true"></span>
        <span>{{ status.state === 'loading' ? '正在载入模型' : status.message }}</span>
        <button v-if="status.state === 'error'" type="button" @click="load"><RefreshCw :size="16" />重新加载</button>
      </div>
    </div>
    <footer class="spine-controls">
      <button class="icon-button" type="button" :disabled="status.state !== 'ready'" :title="paused ? '播放' : '暂停'" :aria-label="paused ? '播放' : '暂停'" @click="togglePause"><Play v-if="paused" :size="18" /><Pause v-else :size="18" /></button>
      <label>动画<select v-model="animation" aria-label="动画" :disabled="status.state !== 'ready'" @change="changeAnimation">
        <option v-for="name in status.state === 'ready' ? status.animations : []" :key="name">{{ name }}</option>
      </select></label>
      <label>皮肤<select v-model="skin" aria-label="皮肤" :disabled="status.state !== 'ready'" @change="changeSkin">
        <option v-for="name in status.state === 'ready' ? status.skins : []" :key="name">{{ name }}</option>
      </select></label>
      <label class="spine-controls__zoom">缩放<input v-model.number="zoom" type="range" aria-label="缩放" min="0.5" max="2" step="0.05" :disabled="status.state !== 'ready'" @input="changeZoom"></label>
      <button class="icon-button" type="button" :disabled="status.state !== 'ready'" title="重置镜头" aria-label="重置镜头" @click="resetCamera"><RotateCcw :size="18" /></button>
    </footer>
  </section>
</template>
