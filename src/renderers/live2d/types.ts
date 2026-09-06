export type Live2DCatalogEntry = {
  id: string
  name: string
  packagePaths: string[]
  estimatedBytes: number
  motionCount: number
  textureCount: number
}

export type Live2DAssets = { baseUrl: string; catalog: Live2DCatalogEntry[] }
export type Live2DPacket = {
  version: 1
  id: string
  settings: { FileReferences: { Textures: string[] }; [key: string]: unknown }
  files: Record<string, { encoding: 'base64'; data: string } | { encoding: 'json'; data: unknown }>
}
export type Live2DPlayer = {
  motions: Array<{ label: string; group: string; index: number }>
  expressions: string[]
  play(group: string, index: number): Promise<boolean>
  expression(name?: string): Promise<boolean>
  setPaused(paused: boolean): void
  setZoom(zoom: number): void
  resetCamera(): void
  dispose(): void
}

declare global {
  interface Window {
    __MMD_LIVE2D_PACKAGES__?: Record<string, Live2DPacket>
    __MMD_LIVE2D_PARTS__?: Record<string, string[]>
    __MMD_LIVE2D_ASSETS_OVERRIDE__?: Live2DAssets
  }
}
