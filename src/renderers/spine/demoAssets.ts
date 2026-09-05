import type { SpineAssetConfig } from './spineTypes'

const demoSkeleton = JSON.stringify({
  skeleton: {
    hash: 'mmd-hud-demo',
    spine: '4.1.24',
    x: -128,
    y: 0,
    width: 256,
    height: 384,
    images: '',
  },
  bones: [
    { name: 'root' },
  ],
  slots: [
    { name: 'body', bone: 'root', attachment: 'body' },
  ],
  skins: [
    {
      name: 'default',
      attachments: {
        body: {
          body: {
            type: 'region',
            path: 'body',
            x: 0,
            y: 192,
            width: 256,
            height: 384,
          },
        },
      },
    },
  ],
  animations: {
    idle: {
      bones: {
        root: {
          rotate: [
            { value: -1.5 },
            { time: 0.8, value: 1.5 },
            { time: 1.6, value: -1.5 },
          ],
        },
      },
    },
  },
})

const demoAtlas = `demo.svg
size: 256,384
format: RGBA8888
filter: Linear,Linear
repeat: none
pma: false
body
bounds: 0,0,256,384
offsets: 0,0,256,384
rotate: false
index: -1
`

// A neutral, original tactical avatar used only to verify the renderer.
// It deliberately does not contain Nikke game artwork.
const demoTexture = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="384" viewBox="0 0 256 384">
  <defs>
    <linearGradient id="armor" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff9a3d"/>
      <stop offset="0.52" stop-color="#ff7417"/>
      <stop offset="1" stop-color="#a82f0b"/>
    </linearGradient>
    <linearGradient id="visor" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffd18a"/>
      <stop offset="1" stop-color="#ff7417"/>
    </linearGradient>
  </defs>
  <g stroke="#ffb15d" stroke-width="3" stroke-linejoin="round">
    <path fill="#17100d" d="M93 65 107 38h42l14 27-9 15h-52z"/>
    <path fill="url(#visor)" d="M104 61h48l-5 14h-38z"/>
    <path fill="#29160e" d="m108 82 40-1 22 27-13 44-58 1-13-44z"/>
    <path fill="url(#armor)" d="m107 95 42 0 12 20-14 26h-38l-14-26z"/>
    <path fill="#24130d" d="m96 111-23 26 8 14 32-17zM160 111l23 26-8 14-32-17z"/>
    <path fill="#ff7417" d="m97 142-17 56 18 5 17-54zM159 142l17 56-18 5-17-54z"/>
    <path fill="#1a1110" d="m89 201-10 87 25 0 11-85zM167 201l10 87-25 0-11-85z"/>
    <path fill="url(#armor)" d="m103 285-1 52h25l4-52zM153 285l1 52h-25l-4-52z"/>
    <path fill="#21120d" d="M72 291h34l-4 16H66zM150 291h34l6 16h-36z"/>
    <path fill="#ff8e35" d="m64 135-21 12 4 9 22-9zM192 135l21 12-4 9-22-9z"/>
    <path fill="#0e0b0b" d="m181 153 29-6 13 8-5 8-34-1z"/>
  </g>
  <g fill="none" stroke="#ffcf91" stroke-width="2" opacity=".9">
    <path d="M119 101h18M116 117h24M110 130h36M91 221h74M90 237h76M89 255h78"/>
  </g>
  <circle cx="128" cy="88" r="4" fill="#ffe1a8"/>
</svg>`

function textDataUri(value: string): string {
  return `data:text/plain;base64,${btoa(value)}`
}

function svgDataUri(value: string): string {
  return `data:image/svg+xml;base64,${btoa(value)}`
}

export const demoSpineConfig: SpineAssetConfig = {
  id: 'tactical-avatar-demo',
  label: 'TACTICAL AVATAR / SPINE 4.1',
  skeleton: 'demo.json',
  skeletonType: 'json',
  atlas: 'demo.atlas',
  animation: 'idle',
  loop: true,
  scale: 1,
  premultipliedAlpha: false,
  source: 'inline-demo',
  licenseNote: 'Original development fixture. Replace with assets you are licensed to use.',
  inline: {
    skeleton: textDataUri(demoSkeleton),
    atlas: textDataUri(demoAtlas),
    textures: {
      'demo.svg': svgDataUri(demoTexture),
    },
  },
}
