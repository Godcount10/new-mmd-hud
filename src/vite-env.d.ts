/// <reference types="vite/client" />

declare module '@hud-instance' {
  export const instance: import('./instances/types').HudInstance
}

declare const __HUD_INSTANCE__: string
declare const __DRAGON_RAJA_MEDIA__: import('./hud/themes/dragon-raja/media').DragonRajaMediaManifest
