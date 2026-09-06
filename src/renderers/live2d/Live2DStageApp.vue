<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, Pause, Play, RotateCcw, X, RefreshCw } from 'lucide-vue-next'
import type { HudFeatureContext } from '../../features/types'
import type { Live2DAssets, Live2DCatalogEntry, Live2DPlayer } from './types'

const props = defineProps<{ context: HudFeatureContext; assets: Live2DAssets }>()
const query = ref('')
const selectedId = ref(props.assets.catalog.find(row => row.id === 'beierfasite_2')?.id ?? props.assets.catalog[0]?.id ?? '')
const filtered = computed(() => props.assets.catalog.filter(row => row.name.toLowerCase().includes(query.value.toLowerCase().trim())))
const selected = computed(() => props.assets.catalog.find(row => row.id === selectedId.value))
watch(filtered, rows => { if (!rows.some(row => row.id === selectedId.value)) selectedId.value = rows[0]?.id ?? '' })
const active = ref<Live2DCatalogEntry | null>(null)
const pending = ref<Live2DCatalogEntry | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const canvasVersion = ref(0)
const state = ref<'empty' | 'loading' | 'ready' | 'error'>('empty')
const status = ref('尚未载入模型')
const motions = ref<Live2DPlayer['motions']>([])
const expressions = ref<string[]>([])
const motionIndex = ref(0), expressionName = ref(''), paused = ref(false), zoom = ref(1)
const dialog = ref<HTMLElement | null>(null), cancelButton = ref<HTMLButtonElement | null>(null)
const loadButton = ref<HTMLButtonElement | null>(null)
let player: Live2DPlayer | null = null
let controller: AbortController | null = null
let generation = 0
let offClose = () => {}
const megabytes = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MiB`

function requestLoad() {
  if (!selected.value) return
  pending.value = selected.value
  void nextTick(() => cancelButton.value?.focus())
}
function cancel() { pending.value = null; void nextTick(() => loadButton.value?.focus()) }
function unload() {
  generation++
  canvasVersion.value++
  controller?.abort(); controller = null
  player?.dispose(); player = null
  state.value = 'empty'; active.value = null; status.value = '尚未载入模型'
  motions.value = []; expressions.value = []
}
async function load(entry: Live2DCatalogEntry) {
  unload()
  const current = generation
  active.value = entry
  pending.value = null
  controller = new AbortController()
  const signal = controller.signal
  paused.value = false; zoom.value = 1; motionIndex.value = 0; expressionName.value = ''
  state.value = 'loading'; status.value = '准备播放器'
  await nextTick()
  try {
    const { createLive2DPlayer } = await import('./player')
    signal.throwIfAborted()
    const created = await createLive2DPlayer(canvas.value!, props.assets, entry, signal,
      label => { if (generation === current) status.value = label })
    if (generation !== current) { created.dispose(); return }
    player = created
    motions.value = created.motions; expressions.value = created.expressions
    state.value = 'ready'; status.value = '已载入'
  } catch (error) {
    if (generation !== current || signal.aborted) return
    state.value = 'error'; status.value = error instanceof Error ? error.message : String(error)
  }
}
function confirm() { if (pending.value) void load(pending.value) }
function closeStage() { unload(); props.context.platform.sdk.stage.close() }
function togglePause() { paused.value = !paused.value; player?.setPaused(paused.value) }
async function playMotion() {
  const motion = motions.value[motionIndex.value]
  if (!motion || !player) return
  try { await player.play(motion.group, motion.index) }
  catch (error) { status.value = `动作加载失败：${String(error)}` }
}
async function changeExpression() {
  try { await player?.expression(expressionName.value || undefined) }
  catch (error) { status.value = `表情加载失败：${String(error)}` }
}
function resetCamera() { zoom.value = 1; player?.resetCamera() }
function changeZoom() { player?.setZoom(zoom.value) }
function keydown(event: KeyboardEvent) {
  if (!pending.value) return
  if (event.key === 'Escape') { event.preventDefault(); cancel() }
  if (event.key !== 'Tab' || !dialog.value) return
  const buttons = [...dialog.value.querySelectorAll<HTMLButtonElement>('button')]
  const first = buttons[0], last = buttons[buttons.length - 1]
  if (event.shiftKey && props.context.document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && props.context.document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(() => {
  props.context.document.addEventListener('keydown', keydown)
  offClose = props.context.events.on('stage:close', unload)
})
onBeforeUnmount(() => { unload(); offClose(); props.context.document.removeEventListener('keydown', keydown) })
</script>

<template>
  <main class="live2d-stage" data-hud="live2d-stage" aria-label="碧蓝航线 Live2D">
    <div class="live2d-workspace" :inert="Boolean(pending)">
      <header class="live2d-header">
        <div><h1>碧蓝航线 <span>Live2D</span></h1><p>{{ assets.catalog.length }} 个模型<span class="live2d-dot" aria-hidden="true"></span>{{ active?.name ?? '未选择档案' }}</p></div>
        <button class="l2d-icon" type="button" title="关闭舞台" aria-label="关闭舞台" @click="closeStage"><X :size="20" /></button>
      </header>
      <section class="live2d-selection" aria-label="模型选择">
        <label>筛选<input v-model="query" type="search" placeholder="模型文件名" aria-label="筛选 Live2D 模型"></label>
        <label class="live2d-model-select">模型<select v-model="selectedId" aria-label="Live2D 模型"><option v-if="!filtered.length" disabled value="">没有匹配模型</option><option v-for="entry in filtered" :key="entry.id" :value="entry.id">{{ entry.name }}</option></select></label>
        <div class="live2d-size" aria-live="polite">{{ selected ? megabytes(selected.estimatedBytes) : '未选择' }}<small>{{ selected?.motionCount ?? 0 }} 个动作</small></div>
        <button ref="loadButton" class="l2d-command l2d-primary" type="button" :disabled="!selected || !filtered.length" @click="requestLoad"><Download :size="17" />载入模型</button>
      </section>
      <section class="live2d-viewport" :data-live2d-state="state" :data-model="active?.id" aria-label="模型舞台">
        <canvas :key="canvasVersion" ref="canvas" class="live2d-canvas" :class="{ 'is-hidden': state !== 'ready' }" aria-label="Live2D 模型画布"></canvas>
        <div v-if="state !== 'ready'" class="live2d-state" role="status" aria-live="polite">
          <div v-if="state === 'loading'" class="live2d-spinner" aria-hidden="true"></div>
          <strong>{{ state === 'empty' ? '模型待命' : state === 'error' ? '载入失败' : active?.name }}</strong>
          <p>{{ status }}</p>
          <button v-if="state === 'error' && active" class="l2d-command" type="button" @click="load(active!)"><RefreshCw :size="17" />重试</button>
          <button v-if="state === 'loading'" class="l2d-command" type="button" @click="unload"><X :size="17" />取消加载</button>
        </div>
        <div v-if="state === 'ready'" class="live2d-runtime-state" role="status">{{ status }}<span>{{ paused ? '已暂停' : '播放中' }}</span></div>
      </section>
      <footer class="live2d-controls">
        <button class="l2d-icon" type="button" :disabled="state !== 'ready'" :title="paused ? '继续播放' : '暂停播放'" :aria-label="paused ? '继续播放' : '暂停播放'" @click="togglePause"><Play v-if="paused" :size="18" /><Pause v-else :size="18" /></button>
        <label class="live2d-motion">动作<select v-model.number="motionIndex" aria-label="Live2D 动作" :disabled="state !== 'ready'" @change="playMotion"><option v-for="(motion, index) in motions" :key="index" :value="index">{{ motion.label }}</option></select></label>
        <button class="l2d-icon" type="button" :disabled="state !== 'ready'" title="重新播放动作" aria-label="重新播放动作" @click="playMotion"><Play :size="18" /></button>
        <label v-if="expressions.length">表情<select v-model="expressionName" aria-label="Live2D 表情" @change="changeExpression"><option value="">随机表情</option><option v-for="name in expressions" :key="name">{{ name }}</option></select></label>
        <label class="live2d-zoom">缩放<input v-model.number="zoom" type="range" aria-label="Live2D 缩放" min="0.25" max="3" step="0.05" :disabled="state !== 'ready'" @input="changeZoom"></label>
        <button class="l2d-icon" type="button" :disabled="state !== 'ready'" title="重置镜头" aria-label="重置镜头" @click="resetCamera"><RotateCcw :size="18" /></button>
        <button class="l2d-icon" type="button" :disabled="state === 'empty'" title="卸载模型" aria-label="卸载模型" @click="unload"><X :size="18" /></button>
      </footer>
    </div>
    <div v-if="pending" class="live2d-dialog-backdrop" @click.self="cancel">
      <section ref="dialog" class="live2d-dialog" role="dialog" aria-modal="true" aria-labelledby="live2d-dialog-title" aria-describedby="live2d-transfer-note">
        <h2 id="live2d-dialog-title">载入 {{ pending.name }}？</h2>
        <dl><dt>预计本次流量</dt><dd>{{ megabytes(pending.estimatedBytes) }}</dd></dl>
        <p id="live2d-transfer-note">将下载该模型的骨骼、动作、物理数据与贴图。移动网络下请留意流量；实际传输量受缓存和压缩影响，运行时内存占用会更高。</p>
        <div class="live2d-dialog-actions"><button ref="cancelButton" class="l2d-command" type="button" @click="cancel">取消</button><button class="l2d-command l2d-primary" type="button" @click="confirm"><Download :size="17" />继续加载</button></div>
      </section>
    </div>
  </main>
</template>
