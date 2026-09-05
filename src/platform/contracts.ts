import type { PreviewEventName, PreviewEventPayload } from '../types'
import type { MmdSdk } from './sdk'

export type PlatformKind = 'mmd' | 'mock'

/** The smallest bridge HUD code needs from the host page. */
export type MmdPlatformAdapter = {
  kind: PlatformKind
  window: Window
  document: Document
  sdk: MmdSdk
  subscribe(event: PreviewEventName, callback: (payload?: PreviewEventPayload) => void): () => void
}

export function createMockPlatformAdapter(frameWindow: Window, sdk: MmdSdk): MmdPlatformAdapter {
  return {
    kind: 'mock',
    window: frameWindow,
    document: frameWindow.document,
    sdk,
    subscribe: (event, callback) => sdk.on(event, callback),
  }
}

export function createMmdPlatformAdapter(frameWindow: Window, sdk: MmdSdk): MmdPlatformAdapter {
  return {
    kind: 'mmd',
    window: frameWindow,
    document: frameWindow.document,
    sdk,
    subscribe: (event, callback) => sdk.on(event, callback),
  }
}
