import { computed, provide, ref, type Ref } from 'vue'
import type { HudFeatureContext } from '../../features/types'
import type { PreviewEventName, PreviewEventPayload } from '../../types'
import type { MmdSdk } from '../../platform/sdk'
import type { ActionResult, BridgeEvent, ChatMessage, ChatSnapshot, NativeAction } from '../../contracts'
import { HUD_CONTEXT_KEY, type HudContext } from '../../hud/context'

const SUPPORTED = new Set<NativeAction>(['sendMessage', 'setInputText', 'submitEditMessage', 'exit'])

function capabilities(): ChatSnapshot['capabilities'] {
  return new Proxy({}, { get: (_target, action: NativeAction) => ({
    available: SUPPORTED.has(action),
    reason: SUPPORTED.has(action) ? undefined : '新版 SDK 尚未开放此原生能力，当前显示为占位。',
  }) }) as ChatSnapshot['capabilities']
}

function mapMessage(message: ReturnType<HudFeatureContext['store']['getState']>['messages'][number], index: number): ChatMessage {
  return {
    id: message.id,
    role: message.role === 'ai' ? 'assistant' : 'user',
    index,
    text: message.content,
    html: message.content,
    streaming: message.state === 'streaming',
    capabilities: {
      copy: false, edit: false, delete: false, regenerate: false, rollback: false,
      startNewStory: false, previousBranch: false, nextBranch: false,
    },
  }
}

function snapshotOf(context: HudFeatureContext): ChatSnapshot {
  const state = context.store.getState()
  const role = context.platform.sdk.role.get()
  return {
    revision: Date.now(),
    character: { id: null, name: role.name, avatar: role.avatarUrl },
    messages: state.messages.map(mapMessage),
    generation: { status: state.messages.some(message => message.state === 'streaming') ? 'streaming' : 'idle', messageId: null },
    connection: { status: 'connected', error: null },
    editPanel: { open: false, messageId: null, text: '', transforms: [] },
    sharePanel: { open: false, title: '', subtitle: '', link: '' },
    modelPanel: { open: false, title: '模型选择', filters: [], models: [], activeFilterId: null, selectedModelId: null },
    modelConfiguration: { open: false, title: '模型设置', modelName: '', energyCost: null, energyLabel: '', controls: [] },
    moreMenu: { open: false, items: [] },
    conversationPanel: { open: false, title: '管理存档', conversations: [], currentConversationId: state.conversationId },
    personaPanel: { open: false, title: '用户人设', modes: [], currentModeId: null, name: '', maxLength: 64, nameDisabled: true, genderChoices: [], selectedGenderId: null, identity: '', identityMaxLength: 2000, identityDisabled: true, restriction: '' },
    supplementPanel: { open: false, title: '补充设定', text: '', maxLength: 2000, positionId: null, positionLabel: '', picker: { open: false, choices: [], pendingChoiceId: null } },
    instructionSelector: { open: false, empty: true, revision: '', instructions: [] },
    chatSettings: { open: false, title: '对话设置', empty: true, controls: [] },
    capabilities: capabilities(),
  }
}

function failure(action: NativeAction, message = '新版 SDK 尚未开放此原生能力，当前显示为占位。'): ActionResult {
  return { ok: false, action, error: { code: 'NOT_AVAILABLE', message } }
}

async function invoke(context: HudFeatureContext, action: NativeAction, payload: unknown): Promise<ActionResult> {
  const sdk: MmdSdk = context.platform.sdk
  if (!SUPPORTED.has(action)) return failure(action)
  try {
    if (action === 'sendMessage') { await sdk.message.send((payload as { text: string }).text); return { ok: true, action } }
    if (action === 'setInputText') { sdk.input.set((payload as { text: string }).text); return { ok: true, action } }
    if (action === 'submitEditMessage') {
      const value = payload as { messageId: string; text: string }
      await sdk.message.edit(value.messageId, value.text)
      return { ok: true, action }
    }
    if (action === 'exit') { sdk.stage.close(); return { ok: true, action } }
  } catch (error) {
    return failure(action, error instanceof Error ? error.message : String(error))
  }
  return failure(action)
}

export function createDragonRajaContext(context: HudFeatureContext): HudContext {
  const snapshot = ref(snapshotOf(context)) as Ref<ChatSnapshot>
  const connection = ref({ status: 'ready' as const, error: null })
  const listeners = new Set<(event: BridgeEvent) => void>()
  const cleanups: Array<() => void> = []
  const sync = (name: PreviewEventName, payload?: PreviewEventPayload): void => {
    snapshot.value = snapshotOf(context)
    const event: BridgeEvent = name === 'ready'
      ? { type: 'ready', snapshot: snapshot.value }
      : name === 'message:done'
        ? { type: 'generation-finished', snapshot: snapshot.value, messageId: payload?.id ?? null }
        : name === 'message:stream'
          ? { type: 'generation-streaming', snapshot: snapshot.value, messageId: payload?.id ?? '' }
          : { type: 'snapshot', snapshot: snapshot.value }
    listeners.forEach(listener => listener(event))
  }
  const value: HudContext = {
    snapshot: computed(() => snapshot.value),
    connection: computed(() => connection.value),
    invoke: (action, payload) => invoke(context, action, payload) as Promise<ActionResult<any>>,
    refresh: async () => { sync('ready'); return snapshot.value },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    hideHud: async () => context.platform.sdk.stage.close(),
    destroyHud: async () => context.platform.sdk.stage.close(),
  }
  for (const event of ['ready', 'message:new', 'message:done', 'message:stream', 'conversation:switch', 'theme:change', 'stage:close'] as PreviewEventName[]) {
    cleanups.push(context.events.on(event, payload => sync(event, payload)))
  }
  context.onCleanup(() => cleanups.splice(0).forEach(cleanup => cleanup()))
  return value
}

export function provideDragonRajaContext(value: HudContext): void {
  provide(HUD_CONTEXT_KEY, value)
}
