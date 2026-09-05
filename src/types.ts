export type PreviewTheme = 'light' | 'dark'
export type StageMode = 'content' | 'full'

export type CardRule = {
  name?: string
  scriptName?: string
  findRegex: string
  replaceString: string
}

export type CardDefinition = {
  name: string
  statusbar: string
  beginning: string
  rules: CardRule[]
}

export type CardModule = Partial<{
  currentCard: CardDefinition
  name: string
  statusbar: string
  beginning: string
  rules: CardRule[]
  regexRules: CardRule[]
  regex_scripts: CardRule[]
}>

export type MessageRole = 'user' | 'ai'
export type MessageState = 'done' | 'streaming'

export type PreviewMessage = {
  id: string
  role: MessageRole
  content: string
  state: MessageState
  mounted: boolean
  generated?: boolean
}

export type PreviewLogKind = 'event' | 'sdk' | 'script' | 'error' | 'system'

export type PreviewLog = {
  id: number
  kind: PreviewLogKind
  label: string
  detail?: string
  time: string
}

export type PreviewEventName =
  | 'ready'
  | 'message:new'
  | 'message:done'
  | 'message:stream'
  | 'message:mount'
  | 'message:unmount'
  | 'input:change'
  | 'conversation:switch'
  | 'theme:change'
  | 'back'
  | 'stage:close'
  | 'dispose'

export type PreviewEventPayload = {
  id?: string
  role?: MessageRole
  content?: string
  state?: MessageState
  conversationId?: string
  theme?: PreviewTheme
}

export type SdkErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INVALID_ARGS'
  | 'HOST_DENIED'
  | 'NETWORK'
  | 'NOT_SUPPORTED'

export type SdkError = Error & { code: SdkErrorCode }

export type SdkEventCallback = (payload?: PreviewEventPayload) => void

export type PreviewBridge = {
  iframe: HTMLIFrameElement | null
  reset(): void
  toggleTheme(): void
  simulateReply(): void
  simulateMount(): void
  simulateUnmount(): void
  switchConversation(): void
  toggleStage(): void
  triggerBack(): void
  dispose(): void
}
