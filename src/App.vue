<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import currentCardModule from './card/currentCard'
import { createPreviewRuntime, MockMmdRuntime } from './app/createPreviewRuntime'
import type { CardDefinition, CardModule, PreviewLog } from './types'

const card = shallowRef<CardDefinition>(currentCardModule)
const previewFrame = ref<HTMLIFrameElement | null>(null)
const runtime = shallowRef<MockMmdRuntime | null>(null)
const logs = ref<PreviewLog[]>([])
const activeTab = ref<'preview' | 'logs'>('preview')
const frameReady = ref(false)
const lastEvent = ref('尚未启动')
let logId = 0

const statusText = computed(() => frameReady.value ? '本地 Host 已连接' : '正在启动模拟页面')
const eventCount = computed(() => logs.value.filter((log) => log.kind === 'event').length)

function addLog(log: Omit<PreviewLog, 'id' | 'time'>): void {
  logs.value.unshift({
    id: ++logId,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    ...log,
  })
  if (logs.value.length > 120) logs.value.length = 120
}

function onEvent(name: Parameters<NonNullable<MockMmdRuntime['sdk']['__emitEvent']>>[0], payload?: Parameters<NonNullable<MockMmdRuntime['sdk']['__emitEvent']>>[1]): void {
  lastEvent.value = name
  addLog({
    kind: 'event',
    label: name,
    detail: payload ? JSON.stringify(payload) : undefined,
  })
}

function onFrameLoad(): void {
  const frameWindow = previewFrame.value?.contentWindow
  if (!frameWindow) return
  runtime.value?.dispose()
  runtime.value = createPreviewRuntime(frameWindow, { onLog: addLog, onEvent })
  runtime.value.mount(card.value)
  frameReady.value = true
  addLog({ kind: 'system', label: '模拟 MMD 页面已启动', detail: `角色卡：${card.value.name}` })
}

function resetPreview(): void {
  runtime.value?.reset()
  addLog({ kind: 'system', label: '预览已重置' })
}

function toggleTheme(): void {
  runtime.value?.toggleTheme()
}

function simulateReply(): void {
  runtime.value?.simulateReply()
}

function simulateMount(): void {
  runtime.value?.simulateMount()
}

function simulateUnmount(): void {
  runtime.value?.simulateUnmount()
}

function switchConversation(): void {
  runtime.value?.switchConversation()
}

function toggleStage(): void {
  runtime.value?.toggleStage()
}

function triggerBack(): void {
  runtime.value?.triggerBack()
}

function clearLogs(): void {
  logs.value = []
}

const frameSrcdoc = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <style>
      :root { --chat-bg:#eef2f7; --chat-surface:#ffffff; --chat-text:#172033; --chat-text-muted:#667085; --chat-border:#d7dee8; --chat-accent:#2563eb; --chat-bubble-user-bg:#dbeafe; --chat-bubble-ai-bg:#ffffff; --chat-bubble-text:#172033; --chat-viewport-height:100%; }
      :root[data-theme="dark"] { --chat-bg:#111827; --chat-surface:#1f2937; --chat-text:#edf2f7; --chat-text-muted:#9aa7b8; --chat-border:#334155; --chat-accent:#7cc0ff; --chat-bubble-user-bg:#164e63; --chat-bubble-ai-bg:#1f2937; --chat-bubble-text:#edf2f7; }
      * { box-sizing:border-box; }
      body { overflow:hidden; }
      [data-chat="root"] { display:grid; grid-template-rows:auto auto minmax(0,1fr) auto; width:100%; height:100%; background:var(--chat-bg); color:var(--chat-text); }
      [data-chat="header"] { display:flex; align-items:center; gap:12px; min-height:58px; padding:10px 14px; border-bottom:1px solid var(--chat-border); background:var(--chat-surface); }
      [data-chat="header"] button, [data-chat="send"], [data-chat="message-actions"] button { border:1px solid var(--chat-border); border-radius:6px; padding:6px 9px; color:var(--chat-text); background:transparent; cursor:pointer; }
      [data-chat="header-title"] { display:flex; align-items:center; gap:8px; min-width:0; flex:1; }
      [data-chat="header-title"] strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      [data-chat="header-actions"] { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
      .mock-avatar { display:grid; place-items:center; width:30px; height:30px; border-radius:50%; color:#fff; background:var(--chat-accent); font-weight:700; }
      [data-slot="statusbar"] { min-height:0; }
      [data-chat="messages"] { min-height:0; overflow:auto; padding:16px max(14px, calc((100% - 760px) / 2)); }
      [data-chat="list"] { display:grid; gap:14px; }
      [data-chat="message"] { max-width:min(90%, 640px); padding:12px 14px; border:1px solid var(--chat-border); border-radius:12px; color:var(--chat-bubble-text); background:var(--chat-bubble-ai-bg); box-shadow:0 1px 2px rgb(15 23 42 / 6%); }
      [data-chat="message"][data-from="user"] { margin-left:auto; background:var(--chat-bubble-user-bg); }
      [data-chat="message-body"] { line-height:1.65; overflow-wrap:anywhere; }
      [data-chat="message-body"] img { max-width:100%; }
      [data-chat="message-actions"] { display:flex; gap:6px; margin-top:10px; }
      [data-chat="message-actions"]:empty { display:none; }
      .mock-placeholder { color:var(--chat-text-muted); font-style:italic; }
      [data-chat="author-stage"] { position:absolute; inset:0; z-index:2000; display:none; padding:0; overflow:hidden; background:var(--chat-bg); }
      [data-chat="author-stage"][data-mode="full"] { z-index:3000; }
      [data-chat="composer"] { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:8px; align-items:end; padding:10px 14px; border-top:1px solid var(--chat-border); background:var(--chat-surface); }
      [data-slot="toolbar"] { color:var(--chat-text-muted); font-size:12px; }
      [data-chat="input"] textarea { display:block; width:100%; min-height:42px; max-height:140px; resize:vertical; border:1px solid var(--chat-border); border-radius:7px; padding:10px; color:var(--chat-text); background:var(--chat-bg); font:inherit; }
      [data-chat="send"] { min-height:42px; color:#fff; border-color:var(--chat-accent); background:var(--chat-accent); }
      @media (max-width: 640px) { [data-chat="header"] { align-items:flex-start; flex-wrap:wrap; } [data-chat="header-actions"] { width:100%; justify-content:flex-start; } [data-chat="composer"] { grid-template-columns:1fr auto; } [data-slot="toolbar"] { display:none; } }
    </style>
  </head>
  <body></body>
</html>`

onMounted(async () => {
  await nextTick()
  if (previewFrame.value) previewFrame.value.srcdoc = frameSrcdoc
})

onBeforeUnmount(() => {
  runtime.value?.dispose()
})

if (import.meta.hot) {
  import.meta.hot.accept('./card/currentCard.ts', (module) => {
    const next = module as (CardModule & { default?: CardDefinition }) | undefined
    const nextCard = next?.currentCard ?? next?.default
    if (!nextCard) return
    card.value = normalizeCardModule(nextCard)
    runtime.value?.loadCard(card.value)
    addLog({ kind: 'system', label: '角色卡源码已热更新', detail: card.value.name })
  })
}

function normalizeCardModule(module: CardDefinition | CardModule): CardDefinition {
  if ('rules' in module && Array.isArray(module.rules)) return {
    name: module.name ?? '本地测试角色',
    statusbar: module.statusbar ?? '',
    beginning: module.beginning ?? '',
    rules: module.rules,
  }
  const source = module as CardModule
  return {
    name: source.name ?? '本地测试角色',
    statusbar: source.statusbar ?? '',
    beginning: source.beginning ?? '',
    rules: source.regexRules ?? source.regex_scripts ?? [],
  }
}
</script>

<template>
  <main class="host-app">
    <header class="host-header">
      <div class="host-brand">
        <span class="host-mark">M</span>
        <div>
          <h1>MMD 本地 Host</h1>
          <p>新版角色卡接口预览</p>
        </div>
      </div>
      <div class="host-status" :class="{ 'host-status--ready': frameReady }">
        <span class="status-dot" />
        <span>{{ statusText }}</span>
        <span class="status-divider" />
        <span>最近事件：{{ lastEvent }}</span>
      </div>
    </header>

    <section class="host-workspace">
      <aside class="host-panel host-panel--controls">
        <div class="panel-heading">
          <div>
            <h2>开发控制</h2>
            <p>直接编辑 <code>src/card/currentCard.ts</code></p>
          </div>
          <span class="panel-badge">HMR</span>
        </div>

        <section class="control-group">
          <h3>页面状态</h3>
          <div class="control-grid">
            <button type="button" @click="resetPreview">重置预览</button>
            <button type="button" @click="toggleTheme">切换主题</button>
            <button type="button" @click="toggleStage">切换舞台</button>
            <button type="button" @click="triggerBack">模拟返回</button>
          </div>
        </section>

        <section class="control-group">
          <h3>消息生命周期</h3>
          <div class="control-grid">
            <button type="button" @click="simulateReply">模拟 AI 回复</button>
            <button type="button" @click="simulateUnmount">卸载消息</button>
            <button type="button" @click="simulateMount">重新挂载</button>
            <button type="button" @click="switchConversation">切换会话</button>
          </div>
        </section>

        <section class="source-summary">
          <span class="source-summary__label">当前卡片</span>
          <strong>{{ card.name }}</strong>
          <span>{{ card.rules.length }} 条规则 · {{ card.rules.filter(rule => /&lt;script\b/i.test(rule.replaceString)).length }} 条脚本规则</span>
        </section>

        <div class="panel-note">
          <strong>使用方式</strong>
          <p>编辑卡片源码后，角色卡样式、规则和脚本会在右侧模拟页面中自动重载。</p>
        </div>
      </aside>

      <section class="preview-panel">
        <div class="preview-toolbar">
          <div class="preview-tabs">
            <button type="button" :class="{ active: activeTab === 'preview' }" @click="activeTab = 'preview'">聊天预览</button>
            <button type="button" :class="{ active: activeTab === 'logs' }" @click="activeTab = 'logs'">事件日志 <span>{{ eventCount }}</span></button>
          </div>
          <button class="clear-button" type="button" @click="clearLogs">清空日志</button>
        </div>
        <div v-show="activeTab === 'preview'" class="preview-stage">
          <iframe ref="previewFrame" title="MMD 本地模拟页面" @load="onFrameLoad" />
        </div>
        <div v-show="activeTab === 'logs'" class="log-list" aria-live="polite">
          <div v-if="!logs.length" class="log-empty">暂无日志</div>
          <article v-for="log in logs" :key="log.id" class="log-row" :class="`log-row--${log.kind}`">
            <time>{{ log.time }}</time>
            <strong>{{ log.label }}</strong>
            <span v-if="log.detail">{{ log.detail }}</span>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>
