import { compileCard, renderMessage, type CompiledCard } from './cardRuntime'
import { createMockSdk, type MockSdk } from './mockSdk'
import { HudRuntime } from '../hud/runtime'
import { createMockPlatformAdapter } from '../platform/contracts'
import type { HudFeature } from '../features/types'
import type { HudRenderer } from '../renderers/types'
import type { CardDefinition, PreviewEventName, PreviewEventPayload, PreviewLog, PreviewMessage, PreviewTheme, StageMode } from '../types'

export type RuntimeOptions = {
  onLog(log: Omit<PreviewLog, 'id' | 'time'>): void
  onEvent(name: PreviewEventName, payload?: PreviewEventPayload): void
}

export class MockMmdRuntime {
  readonly sdk: MockSdk
  readonly hud: HudRuntime
  private readonly frameWindow: Window
  private readonly frameDocument: Document
  private readonly options: RuntimeOptions
  private card: CompiledCard | null = null
  private root!: HTMLElement
  private statusbar!: HTMLElement
  private messageList!: HTMLElement
  private input!: HTMLTextAreaElement
  private composer!: HTMLElement
  private stage!: HTMLElement
  private messages: PreviewMessage[] = []
  private streamTimer = 0
  private messageSequence = 0
  private conversationIndex = 1
  private theme: PreviewTheme = 'dark'
  private currentScope: HTMLElement | null = null
  private originalQuerySelector: ((selectors: string) => Element | null) | null = null
  private originalQuerySelectorAll: ((selectors: string) => NodeListOf<Element>) | null = null

  constructor(frameWindow: Window, options: RuntimeOptions) {
    this.frameWindow = frameWindow
    this.frameDocument = frameWindow.document
    this.options = options
    this.sdk = createMockSdk({
      getInput: () => this.input?.value ?? '',
      setInput: (value) => this.setInput(value),
      setComposerVisible: (visible) => this.setComposerVisible(visible),
      isComposerVisible: () => this.composer?.style.display !== 'none',
      sendMessage: (text) => this.sendMessage(text),
      editMessage: (id, text) => this.editMessage(id, text),
      getStage: () => this.stage ?? null,
      openStage: (mode) => this.openStage(mode),
      closeStage: () => this.closeStage(),
      isStageVisible: () => this.stage?.style.display !== 'none',
      getRole: () => ({ name: this.card?.definition.name ?? '本地角色', avatarUrl: '' }),
      getUser: () => ({ nickname: '本地玩家', avatarUrl: '' }),
      debugLog: (...args) => this.logSdk(args),
      onLog: options.onLog,
      onEvent: options.onEvent,
    })
    ;(this.frameWindow as Window & { sdk?: MockSdk }).sdk = this.sdk
    this.hud = new HudRuntime({ platform: createMockPlatformAdapter(frameWindow, this.sdk) })
    this.hud.mount()
    this.installScopedDocument()
  }

  registerFeature(feature: HudFeature): () => void {
    return this.hud.registerFeature(feature)
  }

  registerRenderer(renderer: HudRenderer): () => void {
    return this.hud.registerRenderer(renderer)
  }

  mount(cardDefinition: CardDefinition): void {
    this.createNativeShell()
    this.resetMessages(cardDefinition.beginning)
    this.loadCard(cardDefinition)
  }

  loadCard(cardDefinition: CardDefinition): void {
    this.frameWindow.clearInterval(this.streamTimer)
    this.streamTimer = 0
    this.card = compileCard(cardDefinition)
    if (this.messages[0] && this.messages[0].role === 'ai' && !this.messages[0].generated) {
      this.messages[0].content = cardDefinition.beginning
    }
    const title = this.root?.querySelector<HTMLElement>('[data-chat="header-title"] strong')
    if (title) title.textContent = cardDefinition.name
    for (const warning of this.card.warnings) this.options.onLog({ kind: 'error', label: '规则警告', detail: warning })
    this.sdk.__resetEvents()
    this.hud.dispose()
    this.hud.mount()
    this.installStyles(this.card.styles)
    this.statusbar.innerHTML = this.card.statusbarHtml
    this.messages.forEach((message) => this.renderMessage(message, false))
    this.runCardScripts(this.card.scripts)
    this.dispatch('ready')
  }

  reset(): void {
    if (!this.card) return
    this.createNativeShell()
    this.resetMessages(this.card.definition.beginning)
    this.loadCard(this.card.definition)
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark'
    this.root.dataset.theme = this.theme
    this.hud.store.setTheme(this.theme)
    this.dispatch('theme:change', { theme: this.theme })
  }

  simulateReply(): void {
    void this.sendMessage('这是由本地 Host 模拟的用户消息。')
  }

  simulateMount(): void {
    const message = this.messages.find((candidate) => !candidate.mounted)
    if (!message) return this.options.onLog({ kind: 'system', label: '没有可重新挂载的消息' })
    this.renderMessage(message, true)
  }

  simulateUnmount(): void {
    const message = [...this.messages].reverse().find((candidate) => candidate.mounted)
    if (!message) return this.options.onLog({ kind: 'system', label: '没有可卸载的消息' })
    const node = this.findMessageNode(message.id)
    node?.remove()
    message.mounted = false
    this.hud.store.updateMessage(message.id, { mounted: false })
    this.dispatch('message:unmount', this.payloadFor(message), node ?? undefined)
  }

  switchConversation(): void {
    this.conversationIndex += 1
    this.messages = []
    this.messageList.replaceChildren()
    this.closeStageFromPlatform()
    this.hud.store.setConversation(`local-${this.conversationIndex}`)
    this.hud.store.resetMessages()
    this.addMessage({
      id: this.nextId(),
      role: 'ai',
      content: `会话 ${this.conversationIndex} 已切换。卡片脚本不会重新执行。`,
      state: 'done',
      mounted: false,
    })
    this.dispatch('conversation:switch', { conversationId: `local-${this.conversationIndex}` })
  }

  toggleStage(): void {
    if (this.stage.style.display === 'none') this.openStage('full')
    else this.closeStage()
  }

  triggerBack(): void {
    if (this.stage.style.display !== 'none') this.closeStageFromPlatform()
    this.dispatch('back')
  }

  dispose(): void {
    this.frameWindow.clearInterval(this.streamTimer)
    this.streamTimer = 0
    this.dispatch('dispose')
    this.hud.dispose()
    this.frameDocument.head.querySelectorAll('[data-card-style]').forEach((element) => element.remove())
    this.frameDocument.body.replaceChildren()
    this.restoreScopedDocument()
  }

  private createNativeShell(): void {
    this.frameWindow.clearInterval(this.streamTimer)
    this.hud.store.setInput('')
    this.hud.store.setComposerVisible(true)
    this.hud.store.setStage(false, 'content')
    this.hud.store.setTheme(this.theme)
    this.frameDocument.documentElement.dataset.theme = this.theme
    this.frameDocument.documentElement.style.cssText = 'width:100%;height:100%;background:var(--chat-bg)'
    this.frameDocument.body.style.cssText = 'width:100%;height:100%;margin:0;overflow:hidden;background:var(--chat-bg);color:var(--chat-text);font-family:system-ui,sans-serif'
    this.frameDocument.body.replaceChildren()

    this.root = this.frameDocument.createElement('main')
    this.root.dataset.chat = 'root'
    this.root.dataset.theme = this.theme
    this.root.dataset.composer = 'open'

    const header = this.frameDocument.createElement('header')
    header.dataset.chat = 'header'
    header.innerHTML = '<button data-chat="header-back" type="button">返回</button><div data-chat="header-title"><span class="mock-avatar">M</span><strong></strong></div><div data-chat="header-actions"><button type="button">评论</button><button type="button">分享</button><button type="button">收藏</button><button type="button">同步</button></div>'
    header.querySelector('strong')!.textContent = this.card?.definition.name ?? '本地角色'
    header.querySelector('[data-chat="header-back"]')?.addEventListener('click', () => this.triggerBack())

    this.statusbar = this.frameDocument.createElement('section')
    this.statusbar.dataset.slot = 'statusbar'

    const messages = this.frameDocument.createElement('section')
    messages.dataset.chat = 'messages'
    this.messageList = this.frameDocument.createElement('div')
    this.messageList.dataset.chat = 'list'
    messages.appendChild(this.messageList)

    const left = this.frameDocument.createElement('aside')
    left.dataset.slot = 'left'
    const right = this.frameDocument.createElement('aside')
    right.dataset.slot = 'right'

    this.stage = this.frameDocument.createElement('section')
    this.stage.dataset.chat = 'author-stage'
    this.stage.style.display = 'none'

    this.composer = this.frameDocument.createElement('footer')
    this.composer.dataset.chat = 'composer'
    const toolbar = this.frameDocument.createElement('div')
    toolbar.dataset.slot = 'toolbar'
    toolbar.innerHTML = '<span>本地输入区</span>'
    const inputWrap = this.frameDocument.createElement('label')
    inputWrap.dataset.chat = 'input'
    this.input = this.frameDocument.createElement('textarea')
    this.input.placeholder = '输入测试消息'
    this.input.addEventListener('input', () => this.dispatch('input:change'))
    inputWrap.appendChild(this.input)
    const send = this.frameDocument.createElement('button')
    send.dataset.chat = 'send'
    send.type = 'button'
    send.textContent = '发送'
    send.addEventListener('click', () => void this.sendMessage().catch((error) => this.reportAsyncError('发送消息失败', error)))
    this.composer.append(toolbar, inputWrap, send)

    this.root.append(header, this.statusbar, messages, left, right, this.stage, this.composer)
    this.frameDocument.body.appendChild(this.root)
  }

  private resetMessages(beginning: string): void {
    this.messages = []
    this.messageSequence = 0
    this.messageList.replaceChildren()
    this.hud.store.resetMessages()
    this.hud.store.setConversation(`local-${this.conversationIndex}`)
    this.addMessage({ id: this.nextId(), role: 'ai', content: beginning, state: 'done', mounted: false })
  }

  private addMessage(message: PreviewMessage): void {
    this.messages.push(message)
    this.renderMessage(message, true)
  }

  private renderMessage(message: PreviewMessage, emitMount: boolean): void {
    if (!this.card || !this.messageList) return
    const existing = this.findMessageNode(message.id)
    existing?.remove()
    const frame = this.frameDocument.createElement('article')
    frame.dataset.chat = 'message-frame'
    const node = this.frameDocument.createElement('div')
    node.dataset.chat = 'message'
    node.dataset.from = message.role
    node.dataset.state = message.state
    node.dataset.msgId = message.id
    const body = this.frameDocument.createElement('div')
    body.dataset.chat = 'message-body'
    body.innerHTML = message.state === 'streaming' && !message.content
      ? '<span class="mock-placeholder">消息生成中</span>'
      : renderMessage(message.content, this.card.definition.rules)
    const extra = this.frameDocument.createElement('div')
    extra.dataset.slot = 'message-extra'
    const actions = this.frameDocument.createElement('div')
    actions.dataset.chat = 'message-actions'
    if (message.role === 'ai' && message.state === 'done') {
      const edit = this.frameDocument.createElement('button')
      edit.type = 'button'
      edit.textContent = '编辑'
      edit.addEventListener('click', () => void this.editMessage(message.id, `${message.content}（已编辑）`).catch((error) => this.reportAsyncError('编辑消息失败', error)))
      actions.appendChild(edit)
    }
    node.append(body, extra, actions)
    frame.appendChild(node)
    this.messageList.appendChild(frame)
    message.mounted = true
    this.hud.store.upsertMessage(message)
    if (emitMount) this.dispatch('message:mount', this.payloadFor(message), node)
  }

  private findMessageNode(id: string): HTMLElement | null {
    return this.messageList?.querySelector<HTMLElement>(`[data-chat="message"][data-msg-id="${escapeSelector(id)}"]`) ?? null
  }

  private async sendMessage(text?: string): Promise<void> {
    const content = (text ?? this.input.value).trim()
    if (!content) throw this.sdkError('INVALID_ARGS', '不能发送空消息')
    this.setInput('')
    this.addMessage({ id: this.nextId(), role: 'user', content, state: 'done', mounted: false })

    const generated: PreviewMessage = {
      id: this.nextId(),
      role: 'ai',
      content: '',
      state: 'streaming',
      mounted: false,
      generated: true,
    }
    this.messages.push(generated)
    this.hud.store.upsertMessage(generated)
    this.renderMessage(generated, true)
    this.dispatch('message:new', this.payloadFor(generated))

    const reply = `收到“${content}”。这是本地 Host 模拟的流式 AI 回复，用来验证 message:stream、message:done 和消息气泡重绘。`
    let cursor = 0
    await new Promise<void>((resolve) => {
      this.streamTimer = this.frameWindow.setInterval(() => {
        cursor += 1
        generated.content = reply.slice(0, cursor)
        this.hud.store.updateMessage(generated.id, { content: generated.content })
        this.updateMessageBody(generated)
        this.dispatch('message:stream', this.payloadFor(generated))
        if (cursor >= reply.length) {
          this.frameWindow.clearInterval(this.streamTimer)
          this.streamTimer = 0
          generated.state = 'done'
          this.hud.store.updateMessage(generated.id, { state: 'done' })
          this.updateMessageBody(generated)
          this.dispatch('message:done', this.payloadFor(generated))
          resolve()
        }
      }, 28)
    })
  }

  private async editMessage(id: string, text: string): Promise<void> {
    const message = this.messages.find((candidate) => candidate.id === id)
    if (!message) throw this.sdkError('INVALID_ARGS', '没有找到可编辑的消息')
    message.content = text
    this.hud.store.updateMessage(message.id, { content: text })
    this.updateMessageBody(message)
  }

  private updateMessageBody(message: PreviewMessage): void {
    const node = this.findMessageNode(message.id)
    const body = node?.querySelector<HTMLElement>('[data-chat="message-body"]')
    if (!body || !this.card) return
    node!.dataset.state = message.state
    body.innerHTML = message.state === 'streaming' && !message.content
      ? '<span class="mock-placeholder">消息生成中</span>'
      : renderMessage(message.content, this.card.definition.rules)
  }

  private setInput(value: string): void {
    if (!this.input) return
    this.input.value = value
    this.hud.store.setInput(value)
    this.dispatch('input:change')
  }

  private setComposerVisible(visible: boolean): void {
    this.composer.style.display = visible ? '' : 'none'
    this.root.dataset.composer = visible ? 'open' : 'closed'
    this.hud.store.setComposerVisible(visible)
  }

  private openStage(mode: StageMode): void {
    this.stage.style.display = 'block'
    this.stage.dataset.mode = mode
    this.stage.className = `mock-stage mock-stage--${mode}`
    this.hud.store.setStage(true, mode)
  }

  private closeStage(): void {
    this.stage.style.display = 'none'
    this.hud.store.setStage(false, (this.stage.dataset.mode as StageMode | undefined) ?? 'content')
  }

  private closeStageFromPlatform(): void {
    if (this.stage.style.display === 'none') return
    this.closeStage()
    this.dispatch('stage:close')
  }

  private dispatch(name: PreviewEventName, payload?: PreviewEventPayload, scope?: HTMLElement): void {
    if (name === 'message:mount' || name === 'message:unmount') {
      this.withScope(scope ?? null, () => this.emitFromSdk(name, payload))
    } else {
      this.emitFromSdk(name, payload)
    }
  }

  private emitFromSdk(name: PreviewEventName, payload?: PreviewEventPayload): void {
    this.sdk.__emitEvent(name, payload)
  }

  private runCardScripts(scripts: string[]): void {
    for (const script of scripts) {
      try {
        ;(this.frameWindow as Window & { eval(source: string): unknown }).eval(script)
        this.options.onLog({ kind: 'script', label: '角色卡脚本已执行' })
      } catch (error) {
        this.options.onLog({ kind: 'error', label: '角色卡脚本异常', detail: error instanceof Error ? error.stack ?? error.message : String(error) })
      }
    }
  }

  private installStyles(styles: string[]): void {
    this.frameDocument.head.querySelectorAll('[data-card-style]').forEach((element) => element.remove())
    for (const css of styles) {
      const style = this.frameDocument.createElement('style')
      style.dataset.cardStyle = 'true'
      style.textContent = css
      this.frameDocument.head.appendChild(style)
    }
  }

  private installScopedDocument(): void {
    const document = this.frameDocument as Document & { querySelector: Document['querySelector']; querySelectorAll: Document['querySelectorAll'] }
    this.originalQuerySelector = document.querySelector.bind(document)
    this.originalQuerySelectorAll = document.querySelectorAll.bind(document)
    document.querySelector = ((selectors: string) => {
      const scope = this.currentScope
      if (scope?.matches(selectors)) return scope
      return scope?.querySelector(selectors) ?? this.originalQuerySelector!(selectors)
    }) as Document['querySelector']
    document.querySelectorAll = ((selectors: string) => this.currentScope?.querySelectorAll(selectors) ?? this.originalQuerySelectorAll!(selectors)) as Document['querySelectorAll']
  }

  private restoreScopedDocument(): void {
    const document = this.frameDocument as Document & { querySelector: Document['querySelector']; querySelectorAll: Document['querySelectorAll'] }
    if (this.originalQuerySelector) document.querySelector = this.originalQuerySelector as Document['querySelector']
    if (this.originalQuerySelectorAll) document.querySelectorAll = this.originalQuerySelectorAll as Document['querySelectorAll']
    this.originalQuerySelector = null
    this.originalQuerySelectorAll = null
    this.currentScope = null
  }

  private withScope<T>(scope: HTMLElement | null, callback: () => T): T {
    const previous = this.currentScope
    this.currentScope = scope
    try { return callback() } finally { this.currentScope = previous }
  }

  private payloadFor(message: PreviewMessage): PreviewEventPayload {
    return { id: message.id, role: message.role, content: message.content, state: message.state }
  }

  private nextId(): string {
    this.messageSequence += 1
    return `local-msg-${this.messageSequence}`
  }

  private logSdk(args: unknown[]): void {
    this.options.onLog({ kind: 'sdk', label: 'sdk.debug.log', detail: args.map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ') })
  }

  private reportAsyncError(label: string, error: unknown): void {
    this.options.onLog({ kind: 'error', label, detail: error instanceof Error ? error.message : String(error) })
  }

  private sdkError(code: 'INVALID_ARGS' | 'NOT_SUPPORTED', message: string): Error {
    const error = new Error(message) as Error & { code: string }
    error.code = code
    return error
  }
}

function escapeSelector(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)
}
