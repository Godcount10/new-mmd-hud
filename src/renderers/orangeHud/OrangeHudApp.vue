<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { HudFeatureContext } from '../../features/types'
import type { HudState } from '../../core/hudStore'
import type { GameState } from '../../domain/gameStore'
import SpineViewport from '../spine/SpineViewport.vue'
import { demoSpineConfig } from '../spine/demoAssets'
import type { SpineAssetConfig } from '../spine/spineTypes'

const FALLBACK_XP = 68
const FALLBACK_ENERGY = 82

const props = defineProps<{
  context: HudFeatureContext
}>()

const spineConfig: SpineAssetConfig = props.context.window.__MMD_SPINE_ASSET__ ?? demoSpineConfig

const hudState = ref<HudState>(props.context.store.getState())
const gameState = ref<GameState>(props.context.domain.getState())
const lastEvent = ref('READY')

const xp = computed(() => clampPercent(gameState.value.variables.xp, FALLBACK_XP))
const energy = computed(() => clampPercent(gameState.value.variables.energy, FALLBACK_ENERGY))
const phase = computed(() => gameState.value.phase.toUpperCase())
const mission = computed(() => typeof gameState.value.variables.mission === 'string'
  ? gameState.value.variables.mission
  : '建立第一条 HUD 指令')
const sector = computed(() => typeof gameState.value.variables.sector === 'string'
  ? gameState.value.variables.sector
  : 'STAGE / 01')
const messageCount = computed(() => hudState.value.messages.length)
const phaseActionLabel = computed(() => gameState.value.phase === 'running' ? 'PAUSE SYSTEM' : 'START SYSTEM')

const eventCleanups: Array<() => void> = []

function closeStage(): void {
  props.context.platform.sdk.stage.close()
}

function togglePhase(): void {
  const currentPhase = gameState.value.phase
  props.context.domain.dispatch({
    type: 'phase:set',
    phase: currentPhase === 'running' ? 'paused' : 'running',
  })
  lastEvent.value = currentPhase === 'running' ? 'SYSTEM PAUSED' : 'SYSTEM STARTED'
}

function syncXp(): void {
  props.context.domain.dispatch({
    type: 'variable:set',
    key: 'xp',
    value: Math.min(100, xp.value + 10),
  })
  props.context.domain.dispatch({ type: 'tick' })
  lastEvent.value = 'SYNC +10'
}

onMounted(() => {
  eventCleanups.push(props.context.events.on('ready', () => { lastEvent.value = 'READY' }))
  eventCleanups.push(props.context.events.on('message:new', () => { lastEvent.value = 'MESSAGE NEW' }))
  eventCleanups.push(props.context.events.on('message:done', () => { lastEvent.value = 'MESSAGE DONE' }))
  eventCleanups.push(props.context.events.on('message:stream', () => { lastEvent.value = 'STREAMING' }))
  eventCleanups.push(props.context.events.on('theme:change', () => { lastEvent.value = 'THEME CHANGED' }))
  eventCleanups.push(props.context.events.on('stage:close', () => { lastEvent.value = 'STAGE CLOSED' }))
  eventCleanups.push(props.context.store.subscribe((state) => { hudState.value = state }))
  eventCleanups.push(props.context.domain.subscribe((state) => { gameState.value = state }))
})

onBeforeUnmount(() => {
  for (const cleanup of eventCleanups.splice(0)) cleanup()
})

function clampPercent(value: unknown, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(100, Math.round(number)))
}
</script>

<template>
  <div
    data-hud="overlay"
    :data-phase="gameState.phase"
    :data-stage-visible="String(hudState.stage.visible)"
  >
    <div class="orange-hud__scanline" aria-hidden="true"></div>

    <header class="orange-hud__topbar">
      <div class="orange-hud__brand">
        <span class="orange-hud__brand-mark">M</span>
        <div>
          <span class="orange-hud__overline">MMD / STAGE CONTROL</span>
          <strong>ORANGE//CORE</strong>
        </div>
      </div>
      <div class="orange-hud__session">
        <span class="orange-hud__pulse" aria-hidden="true"></span>
        <span>SESSION LINKED</span>
        <span class="orange-hud__session-divider"></span>
        <span>{{ hudState.theme.toUpperCase() }}</span>
      </div>
      <button class="orange-hud__close" type="button" data-hud-action="close" @click="closeStage">CLOSE STAGE</button>
    </header>

    <div class="orange-hud__body">
      <nav class="orange-hud__rail" aria-label="HUD sections">
        <button class="orange-hud__rail-button orange-hud__rail-button--active" type="button">CORE</button>
        <button class="orange-hud__rail-button" type="button">QUEST</button>
        <button class="orange-hud__rail-button" type="button">LOG</button>
        <div class="orange-hud__rail-spacer"></div>
        <span class="orange-hud__rail-version">HUD / 01</span>
      </nav>

      <main class="orange-hud__main">
        <div class="orange-hud__main-heading">
          <div>
            <span class="orange-hud__overline">TACTICAL OVERLAY</span>
            <h1>CONTROL THE MOMENT</h1>
          </div>
          <div class="orange-hud__phase">
            <span>PHASE</span>
            <strong>{{ phase }}</strong>
          </div>
        </div>

        <section class="orange-hud__core-panel" aria-label="Core status">
          <div class="orange-hud__core-panel-header">
            <span>CORE STATUS</span>
            <span class="orange-hud__code">X-01 / LIVE</span>
          </div>
          <div class="orange-hud__core-grid">
            <div class="orange-hud__core-orbit" aria-hidden="true">
              <span class="orange-hud__orbit-ring orange-hud__orbit-ring--outer"></span>
              <span class="orange-hud__orbit-ring orange-hud__orbit-ring--inner"></span>
              <span class="orange-hud__orbit-dot"></span>
              <strong>01</strong>
            </div>
            <div class="orange-hud__readout">
              <span class="orange-hud__overline">ACTIVE OBJECTIVE</span>
              <strong>{{ mission }}</strong>
              <p>舞台覆盖已建立。状态、任务与消息生命周期现在由同一套运行时驱动。</p>
              <div class="orange-hud__readout-meta">
                <span><i></i> SECTOR <b>{{ sector }}</b></span>
                <span><i></i> MSG <b>{{ String(messageCount).padStart(2, '0') }}</b></span>
              </div>
            </div>
          </div>
          <div class="orange-hud__meter-list">
            <div class="orange-hud__meter-row">
              <div class="orange-hud__meter-label"><span>SYNC XP</span><strong>{{ xp }}%</strong></div>
              <div class="orange-hud__meter"><span :style="{ transform: `scaleX(${xp / 100})` }"></span></div>
            </div>
            <div class="orange-hud__meter-row">
              <div class="orange-hud__meter-label"><span>ENERGY</span><strong>{{ energy }}%</strong></div>
              <div class="orange-hud__meter orange-hud__meter--muted"><span :style="{ transform: `scaleX(${energy / 100})` }"></span></div>
            </div>
          </div>
        </section>

        <section class="orange-hud__command-panel" aria-label="Command feed">
          <div class="orange-hud__command-heading"><span>COMMAND FEED</span><span class="orange-hud__live-label">LIVE</span></div>
          <div class="orange-hud__command-line"><span class="orange-hud__command-marker">&gt;</span><span>SYSTEM READY / LAST EVENT:</span><strong>{{ lastEvent }}</strong></div>
          <div class="orange-hud__command-line orange-hud__command-line--dim"><span class="orange-hud__command-marker">&gt;</span><span>PLATFORM ADAPTER / {{ context.platform.kind.toUpperCase() }} MMD</span><span>CONNECTED</span></div>
        </section>
      </main>

      <aside class="orange-hud__side">
        <section class="orange-hud__spine-panel" aria-label="Spine character">
          <div class="orange-hud__side-heading">
            <span>TACTICAL ASSET</span>
            <span>SPINE 4.1</span>
          </div>
          <SpineViewport
            :config="spineConfig"
            :host-document="props.context.document"
            :host-window="props.context.window"
          />
          <p class="orange-hud__spine-note">{{ spineConfig.licenseNote }}</p>
        </section>
        <div class="orange-hud__side-heading"><span>MISSION BOARD</span><span>03</span></div>
        <div class="orange-hud__mission orange-hud__mission--active">
          <span class="orange-hud__mission-index">01</span>
          <div><strong>STAGE OVERRIDE</strong><span>保持 HUD 在舞台层运行</span></div>
          <span class="orange-hud__mission-state">ACTIVE</span>
        </div>
        <div class="orange-hud__mission">
          <span class="orange-hud__mission-index">02</span>
          <div><strong>SYNC SIGNAL</strong><span>等待下一条 AI 消息</span></div>
          <span class="orange-hud__mission-state">READY</span>
        </div>
        <div class="orange-hud__mission">
          <span class="orange-hud__mission-index">03</span>
          <div><strong>LOADOUT</strong><span>功能模块可随时挂载</span></div>
          <span class="orange-hud__mission-state">LOCKED</span>
        </div>
        <div class="orange-hud__side-note"><span class="orange-hud__overline">RUNTIME NOTE</span><p>HUD 关闭后舞台 DOM 不会被销毁。</p></div>
      </aside>
    </div>

    <footer class="orange-hud__footer">
      <div class="orange-hud__footer-status"><span class="orange-hud__pulse" aria-hidden="true"></span><span>OVERLAY ONLINE</span><span class="orange-hud__footer-separator"></span><span>EVENT STREAM: <b>{{ lastEvent }}</b></span></div>
      <div class="orange-hud__actions">
        <button type="button" data-hud-action="phase" @click="togglePhase">{{ phaseActionLabel }}</button>
        <button type="button" data-hud-action="sync" @click="syncXp">SYNC +10</button>
      </div>
    </footer>
  </div>
</template>
