<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ActionResult, NativeAction } from '../../../../contracts'
import { useHudContext } from '../../../context'
import { useMotionScope } from '../../../shared/motion'

type NativePanel = 'instruction' | 'edit' | 'model-config' | 'models' | 'archives' | 'persona' | 'supplement' | 'chat-settings'

const emit = defineEmits<{ feedback: [result: ActionResult] }>()
const context = useHudContext()
const snapshot = context.snapshot
const pending = ref<NativeAction | null>(null)
const editDraft = ref('')
const personaName = ref('')
const personaIdentity = ref('')
const supplementDraft = ref('')
const layerRoot = ref<HTMLElement | null>(null)
const panelRoot = ref<HTMLElement | null>(null)
const displayedPanel = ref<NativePanel | null>(null)
const leaving = ref(false)
const switching = ref(false)
const motion = useMotionScope({ root: layerRoot })
let restoreFocus: HTMLElement | null = null

const panel = computed<NativePanel | null>(() => {
  if (snapshot.value.instructionSelector.open) return 'instruction'
  if (snapshot.value.editPanel.open) return 'edit'
  if (snapshot.value.modelConfiguration.open) return 'model-config'
  if (snapshot.value.modelPanel.open) return 'models'
  if (snapshot.value.conversationPanel.open) return 'archives'
  if (snapshot.value.personaPanel.open) return 'persona'
  if (snapshot.value.supplementPanel.open) return 'supplement'
  if (snapshot.value.chatSettings.open) return 'chat-settings'
  return null
})

watch(panel, async (dialog) => {
  const token = motion.nextGeneration()

  if (dialog) {
    const wasLeaving = leaving.value
    const previousPanel = displayedPanel.value
    if (!previousPanel) {
      restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    leaving.value = false

    if (previousPanel && previousPanel !== dialog && !wasLeaving) {
      switching.value = true
      const currentPanel = panelRoot.value
      if (currentPanel && !motion.reducedMotion.value) {
        motion.timeline(undefined, (timeline) => {
          timeline.to(currentPanel.querySelectorAll('.dr-native-panel__header > *, .dr-native-panel__body > *, .dr-native-panel__footer > *'), {
            autoAlpha: 0,
            x: -18,
            duration: .2,
            stagger: { each: .018, from: 'end' },
            ease: 'power2.in',
          })
        })
        const left = await motion.delay(220, token)
        if (!left || !motion.isCurrent(token) || panel.value !== dialog) return
      }

      displayedPanel.value = dialog
      await nextTick()
      if (!motion.isCurrent(token) || panel.value !== dialog) return
      const nextPanel = panelRoot.value
      if (nextPanel && !motion.reducedMotion.value) {
        motion.timeline(undefined, (timeline) => {
          timeline.fromTo(
            nextPanel.querySelectorAll('.dr-native-panel__header > *, .dr-native-panel__body > *, .dr-native-panel__footer > *'),
            { autoAlpha: 0, x: 18 },
            { autoAlpha: 1, x: 0, duration: .3, stagger: .03, ease: 'expo.out' },
          )
        })
      }
      switching.value = false
      panelRoot.value?.focus()
      return
    }

    displayedPanel.value = dialog
    await nextTick()
    if (!motion.isCurrent(token) || panel.value !== dialog) return
    panelRoot.value?.focus()
    if (!previousPanel || wasLeaving) {
      if (!motion.reducedMotion.value) {
        motion.timeline(undefined, (timeline) => {
          timeline
            .fromTo('.dr-native-layer__scrim', { autoAlpha: wasLeaving ? 1 : 0 }, { autoAlpha: 1, duration: .25, ease: 'power2.out' }, 0)
            .fromTo('.dr-native-panel', { autoAlpha: 0, y: 22, scale: .98, clipPath: 'inset(0 0 100% 0)' }, { autoAlpha: 1, y: 0, scale: 1, clipPath: 'inset(0)', duration: .42, ease: 'expo.out' }, .05)
            .fromTo('.dr-native-panel__header > *, .dr-native-panel__body > *, .dr-native-panel__footer > *', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .3, stagger: .035, ease: 'power2.out' }, .2)
        })
      }
    }
    switching.value = false
    return
  }

  switching.value = false
  if (!displayedPanel.value || leaving.value) return
  leaving.value = true
  if (motion.reducedMotion.value) {
    displayedPanel.value = null
    leaving.value = false
    if (restoreFocus?.isConnected) restoreFocus.focus()
    restoreFocus = null
    return
  }
  motion.timeline(undefined, (timeline) => {
    timeline
      .to('.dr-native-panel__header > *, .dr-native-panel__body > *, .dr-native-panel__footer > *', { autoAlpha: 0, y: -8, duration: .2, stagger: { each: .02, from: 'end' }, ease: 'power2.in' }, 0)
      .to('.dr-native-panel', { autoAlpha: 0, y: 20, scale: .98, clipPath: 'inset(0 0 100% 0)', duration: .38, ease: 'power3.in' }, .08)
      .to('.dr-native-layer__scrim', { autoAlpha: 0, duration: .28, ease: 'power2.in' }, .12)
  })
  void motion.delay(440, token).then((completed) => {
    if (!completed || !motion.isCurrent(token) || panel.value) return
    displayedPanel.value = null
    leaving.value = false
    if (restoreFocus?.isConnected) restoreFocus.focus()
    restoreFocus = null
  })
})

watch(() => snapshot.value.editPanel, (value, previous) => {
  if (value.open && (!previous?.open || value.messageId !== previous.messageId)) editDraft.value = value.text
  else if (value.open && pending.value !== 'setEditText' && pending.value !== 'applyEditTransform' && value.text !== previous?.text) editDraft.value = value.text
}, { immediate: true })
watch(() => snapshot.value.personaPanel, (value, previous) => {
  if (value.open && (!previous?.open || value.currentModeId !== previous.currentModeId)) {
    personaName.value = value.name
    personaIdentity.value = value.identity
  }
}, { immediate: true })
watch(() => snapshot.value.supplementPanel, (value, previous) => {
  if (value.open && !previous?.open) supplementDraft.value = value.text
}, { immediate: true })

async function run<A extends NativeAction>(action: A, operation: () => Promise<ActionResult>): Promise<ActionResult> {
  if (pending.value) return { ok: false, action, error: { code: 'NOT_AVAILABLE', message: '另一项原生操作仍在执行' } }
  pending.value = action
  try {
    const result = await operation()
    emit('feedback', result)
    return result
  } finally {
    pending.value = null
  }
}

function close(): void {
  if (panel.value === 'instruction') void run('closePromptSelector', () => context.invoke('closePromptSelector'))
  else if (panel.value === 'edit') void run('cancelEditMessage', () => context.invoke('cancelEditMessage'))
  else if (panel.value === 'model-config') void run('closeModelConfiguration', () => context.invoke('closeModelConfiguration'))
  else if (panel.value === 'models') void run('closeModelSettings', () => context.invoke('closeModelSettings'))
  else if (panel.value === 'archives') void run('closeConversationPanel', () => context.invoke('closeConversationPanel'))
  else if (panel.value === 'persona') void run('closePersona', () => context.invoke('closePersona'))
  else if (panel.value === 'supplement' && !snapshot.value.supplementPanel.picker.open) void run('closeSupplement', () => context.invoke('closeSupplement'))
  else if (panel.value === 'chat-settings') void run('closeChatSettings', () => context.invoke('closeChatSettings'))
}

function handleKeydown(event: KeyboardEvent): void {
  if (!displayedPanel.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !panelRoot.value) return
  const focusable = [...panelRoot.value.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
  if (!focusable.length) {
    event.preventDefault()
    panelRoot.value.focus()
    return
  }
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  if (panel.value) {
    displayedPanel.value = panel.value
    if (!restoreFocus) {
      restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    void nextTick(() => panelRoot.value?.focus())
  }
  window.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (restoreFocus?.isConnected) restoreFocus.focus()
})

async function applyTransform(transformId: string): Promise<void> {
  const synced = await run('setEditText', () => context.invoke('setEditText', { text: editDraft.value }))
  if (!synced.ok) return
  const result = await run('applyEditTransform', () => context.invoke('applyEditTransform', { transformId }))
  if (result.ok && typeof result.data === 'object' && result.data !== null && 'text' in result.data && typeof result.data.text === 'string') editDraft.value = result.data.text
}

function submitEdit(): void {
  const messageId = snapshot.value.editPanel.messageId
  if (!messageId) return
  void run('submitEditMessage', () => context.invoke('submitEditMessage', { messageId, text: editDraft.value }))
}

function selectConversation(conversationId: string): void {
  const conversation = snapshot.value.conversationPanel.conversations.find((item) => item.id === conversationId)
  if (!conversation) return
  void run('selectConversation', () => context.invoke('selectConversation', {
    conversationId: conversation.id,
    fingerprint: conversation.fingerprint,
    index: conversation.index,
  }))
}

function submitPersona(): void {
  void run('submitPersona', () => context.invoke('submitPersona', { name: personaName.value, identity: personaIdentity.value }))
}

async function openModelConfiguration(modelId: string): Promise<void> {
  await run('openModelConfiguration', () => context.invoke('openModelConfiguration', { modelId }))
}

function submitModelConfiguration(): void {
  void run('submitModelConfiguration', () => context.invoke('submitModelConfiguration'))
}

function openChatSettingsAction(): void {
  void run('openPromptSelector', () => context.invoke('openPromptSelector'))
}

function applyInstruction(instructionId: string): void {
  const instruction = snapshot.value.instructionSelector.instructions.find((item) => item.id === instructionId)
  if (!instruction) return
  void run('applyInstruction', () => context.invoke('applyInstruction', {
    instructionId: instruction.id,
    revision: snapshot.value.instructionSelector.revision,
    fingerprint: instruction.fingerprint,
    label: instruction.label,
    index: instruction.index,
  }))
}

async function chooseSupplementPosition(choiceId: string): Promise<void> {
  if (!snapshot.value.supplementPanel.picker.open) {
    const opened = await run('openSupplementPositionPicker', () => context.invoke('openSupplementPositionPicker'))
    if (!opened.ok) return
  }
  await run('setSupplementPosition', () => context.invoke('setSupplementPosition', { choiceId }))
}
</script>

<template>
  <section v-if="displayedPanel" ref="layerRoot" class="dr-native-layer" role="dialog" aria-modal="true" :aria-label="displayedPanel" :aria-busy="leaving || switching">
    <button class="dr-native-layer__scrim" type="button" tabindex="-1" aria-label="关闭原生镜像" @click="close" />
    <div ref="panelRoot" class="dr-native-panel" :data-panel="displayedPanel" tabindex="-1">
      <header class="dr-native-panel__header">
        <div><span>MMD NATIVE MIRROR</span><h2 v-if="displayedPanel === 'instruction'">选择快捷指令</h2><h2 v-else-if="displayedPanel === 'edit'">编辑消息</h2><h2 v-else-if="displayedPanel === 'model-config'">{{ snapshot.modelConfiguration.title || '模型设置' }}</h2><h2 v-else-if="displayedPanel === 'models'">{{ snapshot.modelPanel.title || '模型选择' }}</h2><h2 v-else-if="displayedPanel === 'archives'">{{ snapshot.conversationPanel.title || '管理存档' }}</h2><h2 v-else-if="displayedPanel === 'persona'">{{ snapshot.personaPanel.title || '用户人设' }}</h2><h2 v-else-if="displayedPanel === 'supplement'">{{ snapshot.supplementPanel.title || '补充设定' }}</h2><h2 v-else>{{ snapshot.chatSettings.title || '对话设置' }}</h2></div>
        <button type="button" :disabled="pending !== null || (displayedPanel === 'supplement' && snapshot.supplementPanel.picker.open)" @click="close"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </header>

      <main v-if="displayedPanel === 'instruction'" class="dr-native-panel__body dr-native-list">
        <button v-for="instruction in snapshot.instructionSelector.instructions" :key="instruction.id" type="button" class="dr-instruction-row" :disabled="pending !== null" @click="applyInstruction(instruction.id)"><small>{{ String(instruction.index + 1).padStart(2, '0') }}</small><strong>{{ instruction.label }}</strong><span>应用到原生输入框 ↗</span></button>
        <p v-if="snapshot.instructionSelector.empty || !snapshot.instructionSelector.instructions.length" class="dr-native-empty">当前没有可用的原生快捷指令。</p>
      </main>

      <main v-else-if="displayedPanel === 'edit'" class="dr-native-panel__body dr-native-edit">
        <code>{{ snapshot.editPanel.messageId }}</code>
        <textarea v-model="editDraft" autofocus spellcheck="false" @keydown.ctrl.enter.prevent="submitEdit" />
        <nav v-if="snapshot.editPanel.transforms.length"><button v-for="tool in snapshot.editPanel.transforms" :key="tool.id" type="button" :disabled="pending !== null" @click="applyTransform(tool.id)">{{ tool.label }}</button></nav>
      </main>

      <main v-else-if="displayedPanel === 'models'" class="dr-native-panel__body">
        <nav class="dr-native-pills"><button v-for="filter in snapshot.modelPanel.filters" :key="filter.id" type="button" :class="{ active: filter.active }" :disabled="pending !== null" @click="run('selectModelFilter', () => context.invoke('selectModelFilter', { filterId: filter.id }))">{{ filter.label }}</button></nav>
        <div class="dr-native-list"><article v-for="model in snapshot.modelPanel.models" :key="model.id" :class="{ active: model.selected }"><button type="button" :disabled="pending !== null" @click="run('selectModel', () => context.invoke('selectModel', { modelId: model.id }))"><strong>{{ model.name }}</strong><span>{{ model.description || '暂无说明' }}</span><small>{{ model.batteryLabel }}<template v-if="model.permission"> · {{ model.permission }}</template><template v-if="model.successRate"> · {{ model.successRate }}</template></small></button><button type="button" :disabled="pending !== null" @click="openModelConfiguration(model.id)">参数</button></article></div>
      </main>

      <main v-else-if="displayedPanel === 'model-config'" class="dr-native-panel__body">
        <div class="dr-native-summary"><span>{{ snapshot.modelConfiguration.modelName }}</span><strong>{{ snapshot.modelConfiguration.energyLabel }}</strong></div>
        <section v-for="control in snapshot.modelConfiguration.controls" :key="control.id" class="dr-native-control"><header><div><strong>{{ control.label }}</strong><small>{{ control.description }}</small></div><button v-if="control.type === 'toggle'" type="button" :class="{ active: control.value === true }" :disabled="pending !== null" @click="run('setModelSetting', () => context.invoke('setModelSetting', { controlId: control.id }))">{{ control.value === true ? '开启' : '关闭' }}</button></header><div v-if="control.type === 'choice'" class="dr-native-pills"><button v-for="choice in control.choices" :key="choice.id" type="button" :class="{ active: choice.selected }" :disabled="pending !== null" @click="run('setModelSetting', () => context.invoke('setModelSetting', { controlId: control.id, choiceId: choice.id }))">{{ choice.label }}</button></div></section>
      </main>

      <main v-else-if="displayedPanel === 'archives'" class="dr-native-panel__body dr-native-list"><button v-for="conversation in snapshot.conversationPanel.conversations" :key="conversation.id" type="button" :class="['dr-archive-row', { active: conversation.current }]" :disabled="pending !== null" @click="selectConversation(conversation.id)"><span class="dr-archive-row__avatar" :style="conversation.avatar ? { backgroundImage: `url(${conversation.avatar})` } : undefined">{{ conversation.avatar ? '' : conversation.title.slice(0, 1) }}</span><span><strong>{{ conversation.title }}</strong><small>{{ conversation.preview || '暂无会话预览' }}</small></span><em>{{ conversation.current ? '当前' : '载入' }}</em></button><p v-if="!snapshot.conversationPanel.conversations.length" class="dr-native-empty">原生会话列表暂时为空。</p></main>

      <main v-else-if="displayedPanel === 'persona'" class="dr-native-panel__body dr-native-form">
        <nav class="dr-native-pills"><button v-for="mode in snapshot.personaPanel.modes" :key="mode.id" type="button" :class="{ active: mode.selected }" :disabled="pending !== null || mode.disabled" @click="run('setPersonaMode', () => context.invoke('setPersonaMode', { modeId: mode.id }))">{{ mode.label }}</button></nav>
        <label><span>称呼</span><input v-model="personaName" type="text" :maxlength="snapshot.personaPanel.maxLength || 20" :disabled="pending !== null || snapshot.personaPanel.nameDisabled"></label>
        <div v-if="snapshot.personaPanel.genderChoices.length"><span>性别</span><nav class="dr-native-pills"><button v-for="gender in snapshot.personaPanel.genderChoices" :key="gender.id" type="button" :class="{ active: gender.selected }" :disabled="pending !== null || gender.disabled" @click="run('setPersonaGender', () => context.invoke('setPersonaGender', { genderId: gender.id }))">{{ gender.label }}</button></nav></div>
        <label><span>我是谁</span><textarea v-model="personaIdentity" :maxlength="snapshot.personaPanel.identityMaxLength || 500" :disabled="pending !== null || snapshot.personaPanel.identityDisabled" /></label>
        <p v-if="snapshot.personaPanel.restriction" class="dr-native-warning">{{ snapshot.personaPanel.restriction }}</p>
      </main>

      <main v-else-if="displayedPanel === 'supplement'" class="dr-native-panel__body dr-native-form">
        <div class="dr-native-summary"><span>当前注入位置</span><strong>{{ snapshot.supplementPanel.positionLabel }}</strong></div>
        <nav class="dr-native-pills"><button v-for="choice in snapshot.supplementPanel.picker.choices" :key="choice.id" type="button" :class="{ active: choice.selected }" :disabled="pending !== null" @click="chooseSupplementPosition(choice.id)">{{ choice.label }}</button><button v-if="!snapshot.supplementPanel.picker.open" type="button" :disabled="pending !== null" @click="run('openSupplementPositionPicker', () => context.invoke('openSupplementPositionPicker'))">修改位置</button></nav>
        <label><span>补充正文</span><textarea v-model="supplementDraft" :maxlength="snapshot.supplementPanel.maxLength || 1000" /></label>
        <div v-if="snapshot.supplementPanel.picker.open" class="dr-native-inline-actions"><button type="button" :disabled="pending !== null" @click="run('cancelSupplementPosition', () => context.invoke('cancelSupplementPosition'))">取消位置修改</button><button type="button" :disabled="pending !== null" @click="run('confirmSupplementPosition', () => context.invoke('confirmSupplementPosition'))">确认位置</button></div>
      </main>

      <main v-else class="dr-native-panel__body">
        <section v-for="control in snapshot.chatSettings.controls" :key="control.id" class="dr-native-control" :class="{ collapsed: control.collapsed }"><header><div><strong>{{ control.label }}</strong><small>{{ control.description }}</small></div><span>{{ control.collapsed ? '由原生界面折叠' : 'Snapshot 只读' }}</span></header><div class="dr-native-pills"><span v-for="option in control.options" :key="option.id" :class="{ active: option.selected }">{{ option.label }}</span></div></section>
        <p v-if="snapshot.chatSettings.empty" class="dr-native-empty">当前原生页面没有返回可配置项目。</p>
        <button class="dr-native-command" type="button" :disabled="pending !== null || !snapshot.capabilities.openPromptSelector.available" @click="openChatSettingsAction">选择快捷指令 <span>单独镜像原生指令栏 ↗</span></button>
      </main>

      <footer class="dr-native-panel__footer">
        <span>所有值以最新 Snapshot 为准；动作结果不会覆盖原生事实。</span>
        <button v-if="displayedPanel === 'instruction'" type="button" :disabled="pending !== null" @click="close">返回设置</button>
        <button v-else-if="displayedPanel === 'edit'" type="button" :disabled="pending !== null" @click="submitEdit">保存修改</button>
        <button v-else-if="displayedPanel === 'model-config'" type="button" :disabled="pending !== null" @click="submitModelConfiguration">保存参数</button>
        <button v-else-if="displayedPanel === 'archives'" type="button" :disabled="pending !== null" @click="run('createConversation', () => context.invoke('createConversation'))">创建新存档</button>
        <button v-else-if="displayedPanel === 'persona'" type="button" :disabled="pending !== null" @click="submitPersona">保存人设</button>
        <button v-else-if="displayedPanel === 'supplement'" type="button" :disabled="pending !== null || snapshot.supplementPanel.picker.open" @click="run('submitSupplement', () => context.invoke('submitSupplement', { text: supplementDraft }))">保存补充设定</button>
        <button v-else-if="displayedPanel === 'chat-settings'" type="button" :disabled="pending !== null" @click="run('submitChatSettings', () => context.invoke('submitChatSettings'))">确认设置</button>
      </footer>
    </div>
  </section>
</template>
