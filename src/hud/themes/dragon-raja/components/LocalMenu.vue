<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useMotionScope } from '../../../shared/motion'
import { LOCAL_CODEX_PREVIEW, LOCAL_MAP_PREVIEW } from '../worldData'
import type { DerivedStatus } from '../types'

export type LocalView = 'menu' | 'status' | 'codex' | 'map'
type MenuAction = 'close' | 'settings' | 'archives' | 'persona' | 'supplement' | 'exit'

const props = withDefaults(defineProps<{
  statuses: readonly DerivedStatus[]
  initialView?: LocalView
}>(), {
  initialView: 'menu',
})
const emit = defineEmits<{
  close: []
  settings: []
  archives: []
  persona: []
  supplement: []
  exit: []
}>()
const view = ref<LocalView>(props.initialView)
const leaving = ref(false)
const pendingAction = ref<MenuAction | null>(null)
const root = ref<HTMLElement | null>(null)
const dialog = ref<HTMLElement | null>(null)
const motion = useMotionScope({ root })
let restoreFocus: HTMLElement | null = null

const menuItems = computed(() => [
  { label: '管理存档', detail: '切换 MMD 原生会话', action: 'archives' as const },
  { label: '用户人设', detail: '调整当前角色视角', action: 'persona' as const },
  { label: '补充设定', detail: '修改世界注入位置', action: 'supplement' as const },
  { label: '系统设置', detail: 'HUD 和 MMD 设置镜像', action: 'settings' as const },
  { label: '退出角色卡', detail: '返回 MMD 上一层界面', action: 'exit' as const },
])

const viewTitle = computed(() => ({
  status: 'AI 判读',
  codex: '图鉴档案',
  map: '学院地图',
}[view.value as 'status' | 'codex' | 'map'] || '档案与设置'))

function focusables(): HTMLElement[] {
  if (!dialog.value) return []
  return [...dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
}

function contentSelector(targetView: LocalView = view.value): string {
  if (targetView === 'menu') return '.dr-menu__panel nav button'
  if (targetView === 'status') return '.dr-status-screen__item'
  if (targetView === 'codex') return '.dr-codex-grid article'
  return '.dr-map__node'
}

function animateEntry(): void {
  if (motion.reducedMotion.value) return
  if (view.value === 'menu') {
    motion.timeline(undefined, (timeline) => {
      timeline
        .fromTo('.dr-menu__scrim', { autoAlpha: 0 }, { autoAlpha: 1, duration: .28, ease: 'power2.out' }, 0)
        .fromTo('.dr-menu__underlay--far', { xPercent: 104 }, { xPercent: 0, duration: .48, ease: 'expo.out' }, .02)
        .fromTo('.dr-menu__underlay--near', { xPercent: 104 }, { xPercent: 0, duration: .52, ease: 'expo.out' }, .06)
        .fromTo('.dr-menu__panel', { xPercent: 104 }, { xPercent: 0, duration: .56, ease: 'expo.out' }, .1)
        .fromTo(contentSelector(), { autoAlpha: 0, x: 22 }, { autoAlpha: 1, x: 0, duration: .32, stagger: .045, ease: 'power2.out' }, .28)
    })
    return
  }
  motion.timeline(undefined, (timeline) => {
    timeline
      .fromTo(dialog.value, { autoAlpha: 0, scale: .985 }, { autoAlpha: 1, scale: 1, duration: .38, ease: 'expo.out' })
      .fromTo(contentSelector(), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .3, stagger: .055, ease: 'power2.out' }, .12)
  })
}

onMounted(async () => {
  restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  animateEntry()
  await nextTick()
  focusables()[0]?.focus()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (restoreFocus?.isConnected) restoreFocus.focus()
})

function emitAction(action: MenuAction): void {
  if (action === 'close') emit('close')
  else if (action === 'settings') emit('settings')
  else if (action === 'archives') emit('archives')
  else if (action === 'persona') emit('persona')
  else if (action === 'supplement') emit('supplement')
  else emit('exit')
}

function closeOverlay(action: MenuAction = 'close'): void {
  if (leaving.value) return
  leaving.value = true
  pendingAction.value = action
  const token = motion.nextGeneration()
  if (motion.reducedMotion.value) {
    emitAction(action)
    return
  }

  const closingMenu = view.value === 'menu'
  motion.timeline(undefined, (timeline) => {
    if (closingMenu) {
      timeline
        .to(contentSelector(), { autoAlpha: 0, x: 18, duration: .18, stagger: { each: .025, from: 'end' }, ease: 'power2.in' }, 0)
        .to('.dr-menu__panel', { xPercent: 104, duration: .42, ease: 'power3.in' }, .1)
        .to('.dr-menu__underlay--near', { xPercent: 104, duration: .38, ease: 'power3.in' }, .15)
        .to('.dr-menu__underlay--far', { xPercent: 104, duration: .35, ease: 'power3.in' }, .19)
        .to('.dr-menu__scrim', { autoAlpha: 0, duration: .28, ease: 'power2.in' }, .18)
    } else {
      timeline
        .to(contentSelector(), { autoAlpha: 0, y: -8, duration: .18, stagger: { each: .025, from: 'end' }, ease: 'power2.in' })
        .to(dialog.value, { autoAlpha: 0, scale: .985, duration: .32, ease: 'power2.in' }, .08)
    }
  })

  void motion.delay(closingMenu ? 560 : 420, token).then((completed) => {
    if (completed && motion.isCurrent(token) && pendingAction.value === action) emitAction(action)
  })
}

async function changeView(nextView: LocalView): Promise<void> {
  if (leaving.value || view.value === nextView) return
  const token = motion.nextGeneration()
  if (!motion.reducedMotion.value) {
    motion.timeline(undefined, (timeline) => {
      timeline.to(dialog.value, { autoAlpha: 0, y: -10, duration: .2, ease: 'power2.in' })
    })
    const left = await motion.delay(200, token)
    if (!left || !motion.isCurrent(token)) return
  }
  view.value = nextView
  await nextTick()
  if (!motion.isCurrent(token)) return
  if (!motion.reducedMotion.value) {
    motion.timeline(undefined, (timeline) => {
      timeline
        .fromTo(dialog.value, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .38, ease: 'expo.out' })
        .fromTo(contentSelector(nextView), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .3, stagger: .055, ease: 'power2.out' }, .12)
    })
  }
  focusables()[0]?.focus()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeOverlay()
    return
  }
  if (event.key !== 'Tab') return
  const items = focusables()
  if (!items.length) return
  const first = items[0]!
  const last = items[items.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <section ref="root" class="dr-menu-layer">
    <section v-if="view === 'menu'" ref="dialog" class="dr-menu" role="dialog" aria-modal="true" aria-label="档案与设置">
      <button class="dr-menu__scrim" type="button" aria-label="关闭菜单" @click="closeOverlay()" />
      <div class="dr-menu__underlay dr-menu__underlay--far" aria-hidden="true" />
      <div class="dr-menu__underlay dr-menu__underlay--near" aria-hidden="true" />
      <aside class="dr-menu__panel dr-menu-palette--night">
          <header><div><span>学院低频入口</span><h2>档案与设置</h2></div><button type="button" aria-label="关闭" @click="closeOverlay()"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
          <nav><button v-for="(item, index) in menuItems" :key="item.action" type="button" :class="{ danger: item.action === 'exit' }" :disabled="leaving" @click="closeOverlay(item.action)"><small>{{ String(index + 1).padStart(2, '0') }}</small><span><strong>{{ item.label }}</strong><em>{{ item.detail }}</em></span><b>↗</b></button></nav>
          <footer><span>低频控制</span><strong>{{ statuses.length }} 条判读已同步</strong></footer>
      </aside>
    </section>
    <section v-else ref="dialog" class="dr-local-screen" role="dialog" aria-modal="true" :aria-label="viewTitle">
      <header><button type="button" @click="closeOverlay()">← 返回故事</button><div><span>学院本地资料 · 预览</span><h2>{{ viewTitle }}</h2></div><button type="button" @click="closeOverlay()">关闭</button></header>
      <div v-if="view === 'status'" class="dr-status-screen">
        <div class="dr-status-screen__intro"><span>AI TEXT DERIVATION</span><h3>助手文本中的临时判读</h3><p>仅解析 assistant 消息里的 [A=B] 标记；后出现的值覆盖旧值，不写回原生 Snapshot。</p></div>
        <div v-if="!statuses.length" class="dr-status-screen__empty">暂无可显示的助手文本标记。</div>
        <div v-else class="dr-status-screen__list"><article v-for="item in statuses" :key="item.key" class="dr-status-screen__item"><span>{{ item.key }}</span><strong>{{ item.value }}</strong><small>AI 派生 · 只读</small></article></div>
      </div>
      <div v-else-if="view === 'codex'" class="dr-codex-grid"><article v-for="(entry, index) in LOCAL_CODEX_PREVIEW" :key="entry.label" :class="{ locked: entry.state !== '已登记' }"><div class="dr-codex-grid__art" :style="{ '--dr-codex-index': index }" aria-hidden="true" /><span>{{ entry.kind }}</span><h3>{{ entry.label }}</h3><p>{{ entry.state === '已登记' ? '内置世界条目已准备，后续 AI 标记会继续扩展记录。' : '尚未从叙事中发现该条目。' }}</p><strong>{{ entry.state }}</strong></article></div>
      <div v-else class="dr-map"><div class="dr-map__grid" /><button v-for="node in LOCAL_MAP_PREVIEW" :key="node.label" type="button" class="dr-map__node" :class="{ active: node.active }" :style="{ left: `${node.x}%`, top: `${node.y}%` }"><i /><strong>{{ node.label }}</strong><small>{{ node.note }}</small></button></div>
    </section>
  </section>
</template>
