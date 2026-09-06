<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMotionScope } from '../../shared/motion'
import type { ActionResult } from '../../../contracts'
import { useHudContext } from '../../context'
import OpeningSurface from './components/OpeningSurface.vue'
import StorySurface from './components/StorySurface.vue'
import WelcomeSurface from './components/WelcomeSurface.vue'
import FeedbackToast from './components/FeedbackToast.vue'
import LocalMenu, { type LocalView } from './components/LocalMenu.vue'
import NativePanels from './components/NativePanels.vue'
import AlchemyOrbitBackground from './components/AlchemyOrbitBackground.vue'
import ForumFaultyTerminal from './components/ForumFaultyTerminal.vue'
import { useDerivedDossier, useDerivedStatus } from './useDerivedStatus'
import { resolveBloodlineOrbitCount } from './alchemyOrbit'

type Surface = 'welcome' | 'opening' | 'story' | 'settings'
const context = useHudContext()
const surface = ref<Surface>('welcome')
const mountedSurface = ref<Surface>('welcome')
const surfaceChanging = ref(false)
const openingPrepared = ref(false)
const shellRoot = ref<HTMLElement | null>(null)
const shellMotion = useMotionScope({ root: shellRoot })
const railRoot = ref<HTMLElement | null>(null)
const railCanvas = ref<HTMLCanvasElement | null>(null)
const railPanel = ref<HTMLElement | null>(null)
const railOpen = ref(false)
const localView = ref<LocalView | null>(null)
const feedback = ref<{ id: number; ok: boolean; message: string } | null>(null)
let feedbackId = 0
const openingDraft = ref('')
const refreshPending = ref(false)
const refreshConversationPending = ref(false)
const editPending = ref(false)
const statuses = useDerivedStatus(context.snapshot)
const dossier = useDerivedDossier(context.snapshot)
const changedStatusKeys = ref(new Set<string>())
let statusGeneration = 0
/* Right rail is a two-panel surface: the dossier, or the forum reached from its own button. */
const railView = ref<'dossier' | 'forum'>('dossier')
const railSwitching = ref(false)
const characterSlot = ref(0)
const optionDraft = ref('')
let railSwitchToken = 0

let railFrameId = 0
let railCleanup: (() => void) | null = null

function teardownRailMotion(): void {
  if (railFrameId) cancelAnimationFrame(railFrameId)
  railFrameId = 0
  railCleanup?.()
  railCleanup = null
}

function setupRailMotion(): void {
  teardownRailMotion()
  const root = railRoot.value
  const canvas = railCanvas.value
  if (!root || !canvas) return
  const initialRect = root.getBoundingClientRect()
  if (initialRect.width <= 0 || initialRect.height <= 0) return
  const context2d = canvas.getContext('2d')
  if (!context2d) return

  let width = 0
  let height = 0
  let lastTime = 0
  let dpr = 1
  let seed = 0x9e3779b9
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 4294967296
  }
  const particles = Array.from({ length: 68 }, () => ({
    x: random(),
    y: random(),
    size: 0.45 + random() * 1.8,
    speed: 0.012 + random() * 0.028,
    drift: 0.006 + random() * 0.016,
    phase: random() * Math.PI * 2,
    alpha: 0.2 + random() * 0.58,
    ember: random() > 0.56,
  }))

  const resize = () => {
    const rect = root.getBoundingClientRect()
    width = Math.max(1, rect.width)
    height = Math.max(1, rect.height)
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  observer?.observe(root)

  const reducedMotion = shellMotion.reducedMotion.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let running = true
  const schedule = () => {
    if (running && !reducedMotion && !document.hidden && !railFrameId) railFrameId = requestAnimationFrame(draw)
  }
  const handleVisibility = () => {
    if (document.hidden) {
      if (railFrameId) cancelAnimationFrame(railFrameId)
      railFrameId = 0
      return
    }
    lastTime = 0
    schedule()
  }
  const draw = (time: number) => {
    const delta = Math.min(48, lastTime ? time - lastTime : 16)
    lastTime = time
    context2d.clearRect(0, 0, width, height)
    context2d.fillStyle = 'rgba(17, 14, 16, .24)'
    context2d.fillRect(0, 0, width, height)
    context2d.globalCompositeOperation = 'lighter'
    const seconds = time / 1000
    for (const particle of particles) {
      if (!reducedMotion) {
        particle.y -= particle.speed * delta / 1000
        particle.x += Math.sin(seconds * particle.drift * 8 + particle.phase) * 0.00028 * delta
        if (particle.y < -0.04) particle.y = 1.04
        if (particle.x < -0.04) particle.x = 1.04
        if (particle.x > 1.04) particle.x = -0.04
      }
      const x = particle.x * width
      const y = particle.y * height
      const pulse = reducedMotion ? 1 : 0.76 + Math.sin(seconds * 1.4 + particle.phase) * 0.24
      context2d.fillStyle = particle.ember
        ? `rgba(213, 87, 49, ${particle.alpha * pulse})`
        : `rgba(215, 149, 45, ${particle.alpha * 0.72 * pulse})`
      context2d.beginPath()
      context2d.arc(x, y, particle.size, 0, Math.PI * 2)
      context2d.fill()
    }
    context2d.globalCompositeOperation = 'source-over'

    if (!reducedMotion) {
      railFrameId = 0
      schedule()
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)
  if (reducedMotion) draw(0)
  else schedule()
  railCleanup = () => {
    running = false
    observer?.disconnect()
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') railOpen.value = false
}

watch(mountedSurface, async (nextSurface) => {
  railOpen.value = false
  if (nextSurface !== 'story') {
    teardownRailMotion()
    return
  }
  await nextTick()
  setupRailMotion()
}, { flush: 'post' })

watch(railOpen, async (open) => {
  if (!open) {
    teardownRailMotion()
    return
  }
  await nextTick()
  setupRailMotion()
}, { flush: 'post' })

onMounted(() => window.addEventListener('keydown', handleWindowKeydown))
onBeforeUnmount(() => {
  teardownRailMotion()
  window.removeEventListener('keydown', handleWindowKeydown)
})

const activeCharacter = computed(() => dossier.value.characters[characterSlot.value] ?? null)

/* Bloodline is assistant-derived dossier data, so it controls only visual density and never gets
 * written back to the native Snapshot. C/B/A/S/SS/SSS map to density tiers three through eight. */
const alchemyOrbitCount = computed(() => resolveBloodlineOrbitCount(activeCharacter.value?.blood ?? ''))
/* The opening dossier and the action options share one channel into the composer's draft. */
const pendingDraft = computed(() => optionDraft.value || openingDraft.value)

function clearPendingDraft(): void {
  optionDraft.value = ''
  openingDraft.value = ''
}

/* A shrinking cast must not leave the pager pointing past the end of the list. */
watch(() => dossier.value.characters.length, (count) => {
  if (characterSlot.value >= count) characterSlot.value = 0
})

/* The forum panel is meaningless once the assistant stops sending forum markers. */
watch(() => dossier.value.forum, (forum) => {
  if (!forum && railView.value === 'forum') {
    railSwitchToken += 1
    railSwitching.value = false
    railView.value = 'dossier'
  }
})

function tweenRailPanel(
  target: HTMLElement,
  build: (timeline: ReturnType<typeof shellMotion.timeline>) => void,
): Promise<void> {
  if (shellMotion.reducedMotion.value) return Promise.resolve()
  return new Promise((resolve) => {
    const timeline = shellMotion.timeline({ onComplete: resolve, onInterrupt: resolve })
    build(timeline)
  })
}

async function switchRailView(nextView: 'dossier' | 'forum'): Promise<void> {
  if (nextView === railView.value || railSwitching.value || shellMotion.disposed.value) return
  if (nextView === 'forum' && !dossier.value.forum) return

  const token = ++railSwitchToken
  railSwitching.value = true
  const outgoing = railPanel.value
  if (outgoing) {
    await tweenRailPanel(outgoing, (timeline) => {
      timeline.to(outgoing, {
        autoAlpha: 0,
        x: nextView === 'forum' ? -22 : 22,
        scaleX: .985,
        duration: .24,
        ease: 'power2.in',
      })
    })
  }
  if (token !== railSwitchToken || shellMotion.disposed.value) return

  railView.value = nextView
  await nextTick()
  const incoming = railPanel.value
  if (incoming) {
    await tweenRailPanel(incoming, (timeline) => {
      timeline.fromTo(incoming, {
        autoAlpha: 0,
        x: nextView === 'forum' ? 26 : -26,
        clipPath: nextView === 'forum' ? 'inset(0 14% 0 0)' : 'inset(0 0 0 14%)',
      }, {
        autoAlpha: 1,
        x: 0,
        clipPath: 'inset(0 0% 0 0%)',
        duration: .42,
        ease: 'power3.out',
        clearProps: 'transform,clipPath,opacity,visibility',
      })
    })
  }
  if (token === railSwitchToken) railSwitching.value = false
}

/* Attribute rows in display order; blanks are dropped by the template rather than shown empty. */
const characterFields = computed(() => {
  const character = activeCharacter.value
  if (!character) return []
  return [
    { label: '身份', value: character.title },
    { label: '关系', value: character.relation },
    { label: '血统', value: character.blood },
    { label: '言灵', value: character.spirit },
    { label: '装备', value: character.equipment },
    { label: '特质', value: character.trait },
  ]
})

/* Options overwrite the draft rather than appending, and never send on their own. */
function chooseOption(text: string): void {
  optionDraft.value = text
  showMessage(true, '行动文本已写入输入框，确认后发送')
}

watch(statuses, (nextStatuses, previousStatuses) => {
  const previous = new Map(previousStatuses?.map((item) => [item.key, item.value]) ?? [])
  const changed = nextStatuses.filter((item) => previous.get(item.key) !== item.value).map((item) => item.key)
  if (!changed.length) return
  statusGeneration += 1
  const token = statusGeneration
  changedStatusKeys.value = new Set(changed)
  void shellMotion.delay(620).then((completed) => {
    if (completed && token === statusGeneration) changedStatusKeys.value = new Set()
  })
})

const characterName = computed(() => context.snapshot.value.character.name || '未知角色')
const connectionLabel = computed(() => context.connection.value.status === 'ready' ? 'FRAME ONLINE' : context.connection.value.status.toUpperCase())

function showMessage(ok: boolean, message: string): void {
  feedbackId += 1
  feedback.value = { id: feedbackId, ok, message }
}

function notify(result: ActionResult): void {
  showMessage(result.ok, result.ok ? '动作已提交，等待最新快照' : result.error?.message || '原生动作失败')
}

function dismissFeedback(id: number): void {
  if (feedback.value?.id === id) feedback.value = null
}

function requestSurface(nextSurface: Surface): void {
  if (nextSurface === surface.value || shellMotion.disposed.value) return
  surface.value = nextSurface
  if (mountedSurface.value === 'welcome' || mountedSurface.value === 'opening') {
    mountedSurface.value = nextSurface
    return
  }
  void transitionSurface(nextSurface)
}

function prepareOpening(): void {
  openingPrepared.value = true
}

async function transitionSurface(nextSurface: Surface): Promise<void> {
  const token = shellMotion.nextGeneration()
  surfaceChanging.value = true
  const current = shellRoot.value
  if (current && !shellMotion.reducedMotion.value) {
    shellMotion.timeline(undefined, (timeline) => {
      timeline.to(current, { autoAlpha: 0, y: nextSurface === 'settings' ? -12 : 12, duration: .28, ease: 'power2.in' })
    })
    const completed = await shellMotion.delay(280, token)
    if (!completed || !shellMotion.isCurrent(token)) return
  }
  mountedSurface.value = nextSurface
  await nextTick()
  if (!shellMotion.isCurrent(token)) return
  if (current && !shellMotion.reducedMotion.value) {
    shellMotion.timeline(undefined, (timeline) => {
      timeline.fromTo(current, { autoAlpha: 0, y: nextSurface === 'settings' ? 12 : -12 }, { autoAlpha: 1, y: 0, duration: .52, ease: 'expo.out' })
    })
  }
  surfaceChanging.value = false
}

function enterStory(): void {
  openingDraft.value = ''
  requestSurface('story')
}

function completeOpening(draft: string): void {
  openingDraft.value = draft
  requestSurface('story')
  showMessage(true, '开局档案已写入输入框，请确认后发送')
}

async function openNative(action: 'openModelSettings' | 'openConversationPanel' | 'openPersona' | 'openSupplement' | 'openChatSettings'): Promise<void> {
  const result = await context.invoke(action)
  notify(result)
}

async function refreshSnapshot(): Promise<void> {
  if (refreshPending.value) return
  refreshPending.value = true
  try {
    await context.refresh()
    showMessage(true, '已读取最新原生快照')
  } catch (error) {
    showMessage(false, error instanceof Error ? error.message : '读取原生快照失败')
  } finally {
    refreshPending.value = false
  }
}

async function refreshConversation(): Promise<void> {
  if (refreshConversationPending.value) return
  refreshConversationPending.value = true
  try {
    notify(await context.invoke('refreshConversation'))
  } finally {
    refreshConversationPending.value = false
  }
}

async function exit(): Promise<void> {
  const result = await context.invoke('exit')
  notify(result)
}

async function hide(): Promise<void> {
  await context.hideHud()
}

type LocalAction = 'archives' | 'persona' | 'supplement' | 'settings' | 'exit'

function openLocalView(view: LocalView): void {
  if (localView.value) return
  localView.value = view
}

function handleLocalAction(action: LocalAction): void {
  localView.value = null
  if (action === 'archives') void openNative('openConversationPanel')
  else if (action === 'persona') void openNative('openPersona')
  else if (action === 'supplement') void openNative('openSupplement')
  else if (action === 'settings') requestSurface('settings')
  else void exit()
}

async function rollback(messageId: string): Promise<void> {
  const result = await context.invoke('rollbackMessage', { messageId })
  notify(result)
}

async function edit(messageId: string): Promise<void> {
  if (editPending.value) return
  editPending.value = true
  try {
    const result = await context.invoke('openEditMessage', { messageId })
    notify(result)
  } finally {
    editPending.value = false
  }
}

</script>

<template>
  <main class="dragon-raja-hud">
    <!--
    THESIS: Story 是一张正在调度的舞台监督台；长篇叙事和角色状态是双主轴，工具只在后台候场。
    OWN-WORLD: 现实舞台监督的布面提示本、场记签、实体 cue 灯和深色演员谱；纸张、铜色、酒红与钴蓝制造节拍，不使用未来科技语汇。
    STORY: 访客在连续阅读面中跟随 Dragon Raja 场次，同时比较最多五名角色的状态，再提交下一步行动；原生面板仍是明确的镜像入口，AI 状态只读展示。
    FIRST VIEWPORT: 桌面是窄工具轨、宽叙事提示本和等权状态台；手机先给出五人演员谱与当前档案，再接入正文和行动输入，任何工具栏不遮挡内容。
    FORM: Stage-manager desk / responsive long-form workspace；仅重做 Story 的呈现层，保留现有 Host、Bridge、Protocol、iframe 与全部交互。
    FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
    -->
    <OpeningSurface
      v-if="mountedSurface === 'opening' || (mountedSurface === 'welcome' && openingPrepared)"
      :class="{ 'dr-opening--prepared': mountedSurface === 'welcome' }"
      @complete="completeOpening"
      @cancel="enterStory"
    />
    <WelcomeSurface v-if="mountedSurface === 'welcome'" @enter-start="prepareOpening" @enter="requestSurface('opening')" />
    <section
      v-if="mountedSurface !== 'welcome' && mountedSurface !== 'opening'"
      class="dr-shell"
      ref="shellRoot"
      :aria-busy="surfaceChanging"
    >

      <header class="dr-topbar">
        <button class="dr-brand" type="button" aria-label="返回故事" @click="requestSurface('story')">
          <span class="dr-brand__mark" aria-hidden="true"><i /></span>
          <span><strong>卡塞尔学院</strong><small>炼金叙事终端</small></span>
        </button>
        <div class="dr-character"><span class="dr-character__avatar">{{ characterName.slice(0, 1) }}</span><span><strong>{{ characterName }}</strong></span></div>
        <div class="dr-topbar__status" :title="`${connectionLabel} · 快照修订 ${context.snapshot.value.revision}`"><i :class="{ live: context.connection.value.status === 'ready' }" /><b>REV {{ context.snapshot.value.revision }}</b></div>
        <nav class="dr-primary-actions" aria-label="一级功能">
          <button type="button" :disabled="refreshConversationPending || !context.snapshot.value.capabilities.refreshConversation.available" @click="refreshConversation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" /></svg><strong>{{ refreshConversationPending ? '刷新中' : '刷新对话' }}</strong></button>
          <button type="button" class="dr-primary-actions__compact" @click="openLocalView('codex')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H5V4Zm14 0h-5v16a3 3 0 0 1 3-3h2V4Z" /></svg><strong>图鉴</strong></button>
          <button type="button" class="dr-primary-actions__compact" @click="openLocalView('map')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Zm5-2v14m6-12v14" /></svg><strong>打开地图</strong></button>
        </nav>
        <button class="dr-menu-trigger" type="button" @click="openLocalView('menu')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg><span>更多</span></button>
      </header>

      <div class="dr-shell__rule" />


      <section v-if="mountedSurface === 'story'" class="dr-workspace">
        <div class="dr-story-environment" aria-hidden="true"><div class="dr-story-environment__plate" /><div class="dr-story-environment__mask" /><div class="dr-story-environment__alchemy" /></div>
        <aside class="dr-sidebar" aria-label="故事二级导航">
          <div class="dr-sidebar__crest dr-sidebar__crest--seal" aria-hidden="true">
            <svg class="dr-crest-svg" viewBox="0 0 64 72" focusable="false">
              <path class="dr-crest-plate" d="M32 3 56 17v31L32 69 8 48V17Z" />
              <path class="dr-crest-shadow" d="m32 3 24 14-8 8-16-9Z" />
              <path class="dr-crest-negative" d="M32 13 18 24l7 2-9 8 11-2-5 17 10 10 10-10-5-17 11 2-9-8 7-2Zm0 12 5 8-5 7-5-7Z" />
              <path class="dr-crest-ember" d="m32 43 5 7-5 7-5-7Z" />
            </svg>
          </div>
          <nav>
            <button type="button" class="active" aria-current="page" @click="requestSurface('story')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h9a3 3 0 0 1 3 3v13H8a2 2 0 0 1-2-2V4Zm2 0v14a2 2 0 0 0-2-2h12M10 8h5M10 12h5" /></svg><strong>故事</strong></button>
            <button type="button" @click="openLocalView('status')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 7v5c0 4.2 2.7 7.6 7 9 4.3-1.4 7-4.8 7-9V7l-7-4Zm-3 9 2 2 4-5" /></svg><strong>判读</strong></button>
            <button type="button" @click="openLocalView('map')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Zm5-2v14m6-12v14" /></svg><strong>地图</strong><small>打开地图</small></button>
            <button type="button" @click="openLocalView('codex')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H5V4Zm14 0h-5v16a3 3 0 0 1 3-3h2V4Z" /></svg><strong>图鉴</strong></button>
            <button type="button" @click="openNative('openConversationPanel')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4V7Zm3-3h10v3H7V4Zm2 7h6m-6 4h4" /></svg><strong>档案</strong></button>
            <button type="button" @click="openLocalView('menu')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg><strong>更多</strong></button>
          </nav>
          <button class="dr-sidebar__hide" type="button" @click="hide">原生界面</button>
        </aside>
        <StorySurface :initial-draft="pendingDraft" :edit-pending="editPending" @draft-consumed="clearPendingDraft" @open-models="openNative('openModelSettings')" @edit="edit" @rollback="rollback" @feedback="showMessage" />
        <button
          class="dr-radar-toggle"
          type="button"
          :aria-expanded="railOpen"
          aria-controls="story-status-rail"
          @click="railOpen = true"
        >
          <span class="dr-radar-toggle__glyph" aria-hidden="true"><i /></span>
          <span><strong>{{ activeCharacter?.name || characterName }}</strong><small>STATUS / {{ dossier.characters.length.toString().padStart(2, '0') }}</small></span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7" /></svg>
        </button>
          <aside id="story-status-rail" ref="railRoot" class="dr-radar dr-radar--polish-ledger" :class="{ 'dr-radar--open': railOpen, 'dr-radar--forum': railView === 'forum' }" aria-label="状态栏">
            <AlchemyOrbitBackground :key="`alchemy-${alchemyOrbitCount}`" :orbit-count="alchemyOrbitCount" />
            <canvas ref="railCanvas" class="dr-radar__ash" aria-hidden="true" />
            <button class="dr-radar__close" type="button" aria-label="关闭状态栏" @click="railOpen = false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
            <section class="dr-cast-ledger" aria-labelledby="dr-cast-ledger-title-v1"><header><h2 id="dr-cast-ledger-title-v1">当前场次</h2><b>{{ dossier.characters.length.toString().padStart(2, '0') }}</b></header><p v-if="!dossier.characters.length" class="dr-cast-ledger__empty">暂无助手档案标记</p><div v-else class="dr-cast-list" role="list"><button v-for="(character, index) in dossier.characters" :key="character.name + index" type="button" class="dr-cast-row" :class="{ active: index === characterSlot }" :aria-current="index === characterSlot ? 'true' : undefined" @click="characterSlot = index"><i aria-hidden="true" /><span><strong>{{ character.name }}</strong><small>{{ character.title || '互动对象' }}</small></span><em>{{ character.relation || '待机' }}</em></button></div></section>
            <nav class="dr-rail-modes" aria-label="状态栏视图"><button type="button" :class="{ active: railView === 'dossier' }" :aria-pressed="railView === 'dossier'" :disabled="railSwitching" @click="switchRailView('dossier')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.8-4 3.1-6 7-6s6.2 2 7 6M4 4v4M2 6h4" /></svg><span><strong>角色档案</strong><small>{{ activeCharacter?.name || '等待档案' }}</small></span></button><button v-if="dossier.forum" type="button" :class="{ active: railView === 'forum' }" :aria-pressed="railView === 'forum'" :disabled="railSwitching" @click="switchRailView('forum')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Zm4 4h8m-8 3h5" /></svg><span><strong>守夜人论坛</strong><small>匿名频道 / 在线</small></span></button></nav>
            <section v-if="railView === 'dossier'" ref="railPanel" class="dr-status-card dr-status-card--derived" aria-labelledby="dr-status-derived-v1"><header><span id="dr-status-derived-v1">互动对象</span><span class="dr-dossier__meta"><b v-if="dossier.time">{{ dossier.time }}</b></span></header><p v-if="!activeCharacter" class="dr-dossier__empty">暂无助手档案标记</p><div v-else class="dr-dossier"><strong class="dr-dossier__name">{{ activeCharacter.name }}</strong><div v-if="activeCharacter.portraitUrl" class="dr-dossier__portrait" :style="{ backgroundImage: `url(${activeCharacter.portraitUrl})` }" role="img" :aria-label="`${activeCharacter.name} 立绘`" /><div v-else class="dr-dossier__portrait dr-dossier__portrait--empty" aria-hidden="true" /><dl class="dr-dossier__fields dr-dossier__fields--tiered"><template v-for="(field, index) in characterFields" :key="field.label"><div v-if="field.value" class="dr-dossier-field--tiered" :class="{ 'dr-dossier-field--primary': index === 2 || index === 3 }"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div></template></dl><p v-if="activeCharacter.description" class="dr-dossier__desc">{{ activeCharacter.description }}</p><div v-if="activeCharacter.characterLine" class="dr-dossier__line"><span>{{ activeCharacter.name }}</span><q>{{ activeCharacter.characterLine }}</q></div><div v-if="activeCharacter.playerLine" class="dr-dossier__line dr-dossier__line--player"><span>你</span><q>{{ activeCharacter.playerLine }}</q></div><p v-if="activeCharacter.profile" class="dr-dossier__profile">{{ activeCharacter.profile }}</p></div><div v-if="statuses.length" class="dr-sidebar__status"><dl><template v-for="item in statuses" :key="item.key"><dt :class="{ changed: changedStatusKeys.has(item.key) }" :title="item.key">{{ item.key }}</dt><dd :class="{ changed: changedStatusKeys.has(item.key) }" :title="item.value">{{ item.value }}</dd></template></dl></div><div v-if="dossier.options.length" class="dr-options"><span class="dr-options__title">可选行动</span><button v-for="option in dossier.options" :key="option.slot" type="button" @click="chooseOption(option.text)">{{ option.label }}</button></div><small>来自 assistant 文本，只读</small></section>
            <section v-else-if="dossier.forum" ref="railPanel" class="dr-status-card dr-status-card--derived dr-forum dr-forum--lead" aria-labelledby="dr-status-forum-v1"><ForumFaultyTerminal class="dr-forum__terminal" tint="#5cbd74" :brightness="1.05" /><div class="dr-forum__wash" aria-hidden="true" /><header class="dr-forum__header"><span><small>学院匿名中继</small><strong id="dr-status-forum-v1">守夜人夜间频道</strong></span><b class="dr-forum-lead__live"><i />实时接收</b></header><article v-if="dossier.forum.threadBody" class="dr-forum__thread dr-forum-lead__thread"><header><span>当前热帖</span><b v-if="dossier.forum.threadAuthor">{{ dossier.forum.threadAuthor }}</b></header><p>{{ dossier.forum.threadBody }}</p></article><ul v-if="dossier.forum.replies.length" class="dr-forum__replies dr-forum-lead__replies"><li v-for="reply in dossier.forum.replies" :key="reply.slot"><span>{{ reply.handle }}</span><p>{{ reply.text }}</p></li></ul><section v-if="dossier.forum.headlines.length" class="dr-forum-lead__index"><header><strong>频道索引</strong><small>{{ dossier.forum.headlines.length }} 条夜间记录</small></header><ol><li v-for="(headline, index) in dossier.forum.headlines" :key="index"><span>{{ String(index + 1).padStart(2, '0') }}</span>{{ headline }}</li></ol></section><small class="dr-forum__source">内容由当前叙事提取 · 只读</small></section>
          </aside>
      </section>


      <section v-if="mountedSurface !== 'story'" class="dr-settings"><header><button type="button" @click="requestSurface('story')">← 返回故事</button><div><h1>系统设置</h1><p>原生事实以最新 Snapshot 为准</p></div></header><div class="dr-settings__grid"><button type="button" @click="openNative('openPersona')"><span>人设</span><strong>用户人设</strong><small>称呼、身份与角色视角</small></button><button type="button" @click="openNative('openSupplement')"><span>设定</span><strong>补充设定</strong><small>管理世界注入位置和正文</small></button><button type="button" @click="openNative('openChatSettings')"><span>对话</span><strong>对话设置</strong><small>镜像当前 MMD 对话参数</small></button><button type="button" :disabled="refreshPending" @click="refreshSnapshot"><span>同步</span><strong>{{ refreshPending ? '读取中' : '刷新快照' }}</strong><small>只重新读取原生事实，不触发对话重载</small></button></div></section>
    </section>
    <LocalMenu v-if="localView" :initial-view="localView" :statuses="statuses" @close="localView = null" @settings="handleLocalAction('settings')" @archives="handleLocalAction('archives')" @persona="handleLocalAction('persona')" @supplement="handleLocalAction('supplement')" @exit="handleLocalAction('exit')" />
    <NativePanels @feedback="notify" />
    <FeedbackToast v-if="feedback" :key="feedback.id" :ok="feedback.ok" :message="feedback.message" @dismiss="dismissFeedback(feedback.id)" />
  </main>
</template>
