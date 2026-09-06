<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ChatMessage } from '../../../../contracts'
import { useHudContext } from '../../../context'
import { useMotionScope } from '../../../shared/motion'
import { sanitizeMessageHtml } from '../sanitizeMessageHtml'

const props = withDefaults(defineProps<{ initialDraft?: string; editPending?: boolean }>(), { initialDraft: '', editPending: false })
const emit = defineEmits<{
  openModels: []
  edit: [messageId: string]
  rollback: [messageId: string]
  feedback: [ok: boolean, message: string]
  draftConsumed: []
}>()
const { snapshot, invoke } = useHudContext()
const draft = ref('')
const sending = ref(false)
const root = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)
const motion = useMotionScope({ root })
const sanitizedCache = new Map<string, { source: string; output: string }>()
const seenMessageIds = new Set<string>()
const completedMessageIds = new Set<string>()
const freshMessageIds = ref(new Set<string>())
const historyReplacing = ref(false)
const openActionsId = ref<string | null>(null)
let freshGeneration = 0
let historyGeneration = 0
let seeded = false
let lastConsumedDraft = ''

const currentModel = computed(() => snapshot.value.modelPanel.models.find((model) => model.selected)?.name || '选择模型')
const generationCopy = computed(() => {
  const status = snapshot.value.generation.status
  if (status === 'starting') return { code: 'CALIBRATING', title: '正在建立叙事回路', detail: '原生生成即将开始' }
  if (status === 'streaming') return { code: 'WRITING', title: '事件记录写入中', detail: '当前回复来自原生快照' }
  if (status === 'stopping') return { code: 'STOPPING', title: '正在停止生成', detail: '等待原生状态确认' }
  if (status === 'error') return { code: 'ERROR', title: '叙事回路异常', detail: '请检查原生界面或重新尝试' }
  return { code: 'STANDBY', title: '机密线路已封存', detail: '等待下一次行动提交' }
})
const sendCapabilityReason = computed(() => snapshot.value.capabilities.sendMessage.reason || '当前原生界面无法发送消息')

function roleLabel(message: ChatMessage): string {
  if (message.role === 'assistant') return snapshot.value.character.name || '未知角色'
  if (message.role === 'user') return '你的行动'
  return '系统事件'
}

function html(message: ChatMessage): string {
  const source = message.html || message.text
  const cached = sanitizedCache.get(message.id)
  if (cached?.source === source) return cached.output
  // Dossier markers are stripped from assistant prose only; a reader's own brackets stay verbatim.
  const output = sanitizeMessageHtml(source, message.role === 'assistant')
  sanitizedCache.set(message.id, { source, output })
  return output
}

async function send(): Promise<void> {
  const text = draft.value.trim()
  if (!text || sending.value || !snapshot.value.capabilities.sendMessage.available) return
  sending.value = true
  try {
    const result = await invoke('sendMessage', { text })
    emit('feedback', result.ok, result.ok ? '行动已送入叙事频道' : result.error?.message || '消息发送失败')
    if (result.ok) {
      draft.value = ''
      emit('draftConsumed')
    }
  } finally {
    sending.value = false
  }
}

function editMessage(messageId: string): void {
  if (props.editPending) return
  closeActions()
  emit('edit', messageId)
}

function rollbackMessage(messageId: string): void {
  closeActions()
  emit('rollback', messageId)
}

/* One menu open at a time; the trigger keeps focus so Escape can return to it. */
function toggleActions(messageId: string): void {
  openActionsId.value = openActionsId.value === messageId ? null : messageId
}

function closeActions(): void {
  openActionsId.value = null
}

function closeActionsAndRefocus(messageId: string): void {
  if (openActionsId.value !== messageId) return
  closeActions()
  const trigger = list.value?.querySelector<HTMLElement>(`${messageSelector(messageId)} .dr-message__actions-trigger`)
  trigger?.focus()
}

/* Touch taps also fire pointerleave, so only a real mouse should dismiss on leave. */
function leaveActions(messageId: string, event: PointerEvent): void {
  if (openActionsId.value !== messageId || event.pointerType !== 'mouse') return
  closeActions()
}

/* Keyboard exit: close once focus leaves the footer entirely. */
function blurActions(messageId: string, event: FocusEvent): void {
  if (openActionsId.value !== messageId) return
  const footer = event.currentTarget as HTMLElement | null
  const next = event.relatedTarget as Node | null
  if (footer && next && footer.contains(next)) return
  closeActions()
}

function nearBottom(): boolean {
  const node = list.value
  return !node || node.scrollHeight - node.scrollTop - node.clientHeight < 120
}

function messageSelector(id: string): string {
  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(id)
    : id.replace(/["\\]/g, '\\$&')
  return `[data-message-id="${escaped}"]`
}

function scrollToBottom(behavior: ScrollBehavior): void {
  const node = list.value
  if (!node) return
  if (typeof node.scrollTo === 'function') node.scrollTo({ top: node.scrollHeight, behavior })
  else node.scrollTop = node.scrollHeight
}

function animateNewMessages(messages: readonly ChatMessage[], ids: readonly string[]): void {
  if (motion.reducedMotion.value || !ids.length) return
  motion.timeline(undefined, (timeline) => {
    ids.forEach((id, index) => {
      const message = messages.find((candidate) => candidate.id === id)
      const target = list.value?.querySelector<HTMLElement>(messageSelector(id))
      if (!message || !target) return
      const x = message.role === 'user' ? 28 : -28
      const at = index * .08
      timeline
        .fromTo(target, { autoAlpha: 0, x, clipPath: 'inset(0 0 100% 0)' }, { autoAlpha: 1, x: 0, clipPath: 'inset(0)', duration: .48, ease: 'expo.out' }, at)
        .fromTo(target.querySelectorAll('header, .dr-message__body, footer'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .3, stagger: .04, ease: 'power2.out' }, at + .14)
    })
  })
}

function animateHistoryReplacement(): void {
  const node = list.value
  if (!node || motion.reducedMotion.value) return
  motion.timeline(undefined, (timeline) => {
    timeline.fromTo(node, { autoAlpha: .72, y: 8 }, { autoAlpha: 1, y: 0, duration: .32, ease: 'power2.out' })
  })
}

watch(() => props.initialDraft, (value, oldValue) => {
  // 忽略空字符串的变化，防止清空时触发不必要的更新
  if (!value) return
  // 忽略相同值的重复触发
  if (value === oldValue || value === lastConsumedDraft) return
  lastConsumedDraft = value
  draft.value = value
}, { immediate: true })

watch(() => snapshot.value.messages, async (messages, previousMessages) => {
  sanitizedCache.forEach((_value, id) => {
    if (!messages.some((message) => message.id === id)) sanitizedCache.delete(id)
  })
  if (openActionsId.value && !messages.some((message) => message.id === openActionsId.value)) closeActions()
  const previousIds = new Set(previousMessages?.map((message) => message.id) ?? [])
  const nextIds = new Set(messages.map((message) => message.id))
  const replacedHistory = seeded
    && previousIds.size > 0
    && nextIds.size > 0
    && snapshot.value.generation.status === 'idle'
    && ![...nextIds].some((id) => previousIds.has(id))

  if (replacedHistory) {
    seenMessageIds.clear()
    completedMessageIds.clear()
    messages.forEach((message) => seenMessageIds.add(message.id))
    freshGeneration += 1
    freshMessageIds.value = new Set()
    historyGeneration += 1
    const token = historyGeneration
    historyReplacing.value = true
    await nextTick()
    if (token !== historyGeneration || motion.disposed.value) return
    animateHistoryReplacement()
    scrollToBottom('auto')
    void motion.delay(360).then((completed) => {
      if (completed && token === historyGeneration) historyReplacing.value = false
    })
    return
  }

  for (const id of seenMessageIds) {
    if (!nextIds.has(id)) {
      seenMessageIds.delete(id)
      completedMessageIds.delete(id)
    }
  }
  if (!seeded) {
    messages.forEach((message) => seenMessageIds.add(message.id))
    seeded = true
    await nextTick()
    scrollToBottom('auto')
    return
  }

  const added = messages.filter((message) => !seenMessageIds.has(message.id)).map((message) => message.id)
  added.forEach((id) => seenMessageIds.add(id))
  freshMessageIds.value = new Set(added)
  const shouldFollow = nearBottom()
  await nextTick()
  animateNewMessages(messages, added)
  if (added.length) {
    freshGeneration += 1
    const token = freshGeneration
    void motion.delay(620).then((completed) => {
      if (completed && token === freshGeneration) freshMessageIds.value = new Set()
    })
  }
  if (shouldFollow) scrollToBottom(motion.reducedMotion.value ? 'auto' : 'smooth')
}, { immediate: true })

watch(() => snapshot.value.generation, async (generation, previous) => {
  if (!previous || previous.status === 'idle' || generation.status !== 'idle' || !previous.messageId) return
  if (completedMessageIds.has(previous.messageId)) return
  completedMessageIds.add(previous.messageId)
  await nextTick()
  if (motion.reducedMotion.value) return
  const target = list.value?.querySelector<HTMLElement>(messageSelector(previous.messageId))
  if (!target) return
  motion.timeline(undefined, (timeline) => {
    timeline
      .fromTo(target, { filter: 'brightness(1.45)' }, { filter: 'brightness(1)', duration: .42, ease: 'power2.out' })
      .fromTo(target.querySelector('.dr-message__body'), { x: -5 }, { x: 0, duration: .3, ease: 'power2.out' }, 0)
  })
})
</script>

<template>
  <section ref="root" class="dr-story" aria-label="Dragon Raja 对话频道">
    <header class="dr-story__header">
      <div class="dr-story__identity">
        <h1>{{ snapshot.character.name || '未知角色' }}</h1>
        <p>连续叙事记录 · 角色状态沿场次脊线更新</p>
      </div>
      <div class="dr-story__channel">
        <span class="dr-story__signal" :data-state="snapshot.connection.status"><i />{{ snapshot.connection.status === 'connected' ? '已连接' : '重新连接中' }}</span>
        <strong v-if="generationCopy.code !== 'STANDBY'" :data-state="snapshot.generation.status">{{ generationCopy.title }}</strong>
      </div>
    </header>

    <div ref="list" class="dr-story__messages" :class="{ 'dr-story__messages--replacing': historyReplacing }" aria-live="polite">
      <div v-if="!snapshot.messages.length" class="dr-story__empty"><strong>频道静默</strong><p>第一条角色消息抵达后，叙事会在这里展开。</p></div>
      <article v-for="message in snapshot.messages" :key="message.id" class="dr-message dr-message--chapter" :class="[`dr-message--${message.role}`, { 'dr-message--fresh': freshMessageIds.has(message.id), 'dr-message--streaming': message.streaming }]" :data-message-id="message.id">
        <i class="dr-message__chapter-rule" aria-hidden="true" />
        <header><span><strong>{{ roleLabel(message) }}</strong></span><time v-if="message.role === 'system'">事件</time></header>
        <div class="dr-message__body" v-html="html(message)" />
        <div v-if="message.streaming" class="dr-message__stream"><i />正在写入原生回复</div>
        <!-- Pointer users get dismiss-on-leave; keyboard and touch still rely on the click toggle,
             Escape, and focusout, so the menu is never unreachable without a mouse. -->
        <footer v-if="message.capabilities.edit || message.capabilities.rollback" @keydown.esc.stop.prevent="closeActionsAndRefocus(message.id)" @pointerleave="leaveActions(message.id, $event)" @focusout="blurActions(message.id, $event)">
          <button type="button" class="dr-message__actions-trigger" :aria-expanded="openActionsId === message.id" aria-haspopup="true" :aria-label="`这条消息的操作：${roleLabel(message)}`" @click="toggleActions(message.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></svg></button>
          <div v-if="openActionsId === message.id" class="dr-message__actions">
            <button v-if="message.capabilities.edit" type="button" :disabled="editPending || !snapshot.capabilities.openEditMessage.available" @click="editMessage(message.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 6.5 3 3" /></svg>编辑</button>
            <button v-if="message.capabilities.rollback" type="button" :disabled="editPending || !snapshot.capabilities.rollbackMessage.available" @click="rollbackMessage(message.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /></svg>从这里回溯</button>
          </div>
        </footer>
      </article>
    </div>

    <form class="dr-composer" @submit.prevent="send">
      <div class="dr-composer__calibration" aria-hidden="true"><span /><i /><i /><i /></div>
      <button type="button" class="dr-composer__model" :disabled="!snapshot.capabilities.openModelSettings.available" :title="snapshot.capabilities.openModelSettings.reason" @click="emit('openModels')"><strong>{{ currentModel }}</strong><small>原生模型</small></button>
      <label><span class="dr-visually-hidden">输入行动</span><textarea v-model="draft" maxlength="2000" rows="1" placeholder="记录下一步行动或回复……" :aria-describedby="!snapshot.capabilities.sendMessage.available ? 'dr-send-capability' : undefined" @keydown.ctrl.enter.prevent="send" /></label>
      <button type="submit" class="dr-composer__send" :disabled="sending || !draft.trim() || !snapshot.capabilities.sendMessage.available"><strong>{{ sending ? '同步中' : '提交行动' }}</strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11" /></svg></button>
      <p v-if="!snapshot.capabilities.sendMessage.available" id="dr-send-capability" class="dr-composer__reason">{{ sendCapabilityReason }}</p>
    </form>
  </section>
</template>
