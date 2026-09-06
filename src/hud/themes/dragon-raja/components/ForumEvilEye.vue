<script setup lang="ts">
import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  color?: string
}>(), {
  color: '#7b5d54',
})

const root = ref<HTMLDivElement | null>(null)
let renderer: Renderer | null = null
let program: Program | null = null
let mesh: Mesh | null = null
let resizeObserver: ResizeObserver | null = null
let frameId = 0
let disposed = false
const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`

// Vue Bits supplies the animated iris language; this rail-specific shader adds real upper
// and lower lid curves so the ornament is an eye rather than a stretched circular field.
const fragmentShader = `
precision highp float;
uniform float uTime;
uniform vec3 uResolution;
uniform sampler2D uNoiseTexture;
uniform vec2 uMouse;
uniform vec3 uEyeColor;

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
  p.y += 0.015;
  float time = uTime * 0.72;
  float aa = 2.4 / max(uResolution.y, 1.0);

  // Independent eyelid curves produce pointed canthi and a slightly heavier upper lid.
  float nx = abs(p.x) / 1.48;
  float lidBase = pow(max(0.0, 1.0 - nx * nx), 0.62);
  float living = 1.0 + sin(time * 0.9) * 0.018;
  float upper = 0.48 * lidBase * living + 0.025 * (1.0 - nx) - 0.018 * p.x;
  float lower = -0.37 * lidBase * living - 0.018 * (1.0 - nx) - 0.008 * p.x;
  float lidDistance = min(upper - p.y, p.y - lower);
  float canthus = 1.0 - smoothstep(0.965, 1.015, nx);
  float eyeMask = smoothstep(-aa, aa, lidDistance) * canthus;
  float lidLine = exp(-abs(lidDistance) * 23.0) * (1.0 - smoothstep(0.86, 1.02, nx));
  float outerGlow = exp(-max(-lidDistance, 0.0) * 13.0)
    * (1.0 - eyeMask) * (1.0 - smoothstep(0.78, 1.06, nx));

  // The iris remains circular in physical pixel space; only the lids crop it.
  vec2 irisUv = p - uMouse;
  float irisRadius = length(irisUv);
  float irisMask = (1.0 - smoothstep(0.49, 0.53, irisRadius)) * eyeMask;
  float irisAngle = atan(irisUv.y, irisUv.x) / 6.2831853 + 0.5;
  vec2 polar = vec2(irisAngle, irisRadius * 1.8 - time * 0.035);
  float noiseA = texture2D(uNoiseTexture, polar * vec2(1.0, 1.7)).r;
  float noiseB = texture2D(uNoiseTexture, polar * vec2(2.0, 2.8) + vec2(time * 0.018, 0.0)).r;
  float rays = 0.5 + 0.5 * sin(irisAngle * 150.796 + noiseA * 5.0 + time * 1.2);
  float irisBody = smoothstep(0.52, 0.46, irisRadius) * smoothstep(0.11, 0.22, irisRadius);
  irisBody *= mix(0.42, 1.0, rays) * mix(0.72, 1.18, noiseB) * eyeMask;
  float irisRim = (smoothstep(0.54, 0.49, irisRadius) - smoothstep(0.48, 0.43, irisRadius)) * eyeMask;

  // A separate vertical pupil prevents the entire effect from reading as an ellipse.
  float pupilShape = length(vec2(irisUv.x / 0.075, irisUv.y / 0.34));
  float pupil = (1.0 - smoothstep(0.86, 1.06, pupilShape)) * irisMask;
  float glint = 1.0 - smoothstep(0.025, 0.072, length(irisUv - vec2(-0.13, 0.16)));
  glint *= irisMask * 0.52;

  float scleraTexture = 0.12 + noiseA * 0.055;
  vec3 color = uEyeColor * scleraTexture * eyeMask;
  color += uEyeColor * (irisBody * 1.95 + irisRim * 1.35);
  color *= 1.0 - pupil * 0.96;
  color += mix(uEyeColor, vec3(0.94, 0.82, 0.72), 0.58) * glint;
  color += uEyeColor * (lidLine * 1.42 + outerGlow * 0.36);
  float alpha = clamp(eyeMask * 0.78 + irisMask * 0.22 + lidLine * 0.52 + outerGlow * 0.2, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}`

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return [123 / 255, 93 / 255, 84 / 255]
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ]
}

function createNoise(size = 128): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  let seed = 0x6d2b79f5
  for (let index = 0; index < size * size; index += 1) {
    seed = Math.imul(seed ^ (seed >>> 15), seed | 1)
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61)
    const value = ((seed ^ (seed >>> 14)) >>> 24) & 255
    const offset = index * 4
    data[offset] = value
    data[offset + 1] = value
    data[offset + 2] = value
    data[offset + 3] = 255
  }
  return data
}

function resize(): void {
  const container = root.value
  if (!container || !renderer || !program) return
  renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight))
  program.uniforms.uResolution.value = [renderer.gl.canvas.width, renderer.gl.canvas.height, renderer.gl.canvas.width / renderer.gl.canvas.height]
}

function handlePointer(event: PointerEvent): void {
  const bounds = root.value?.getBoundingClientRect()
  if (!bounds?.width || !bounds.height) return
  const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  const normalizedY = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1)
  pointer.targetX = Math.max(-1, Math.min(1, normalizedX)) * .045
  pointer.targetY = Math.max(-1, Math.min(1, normalizedY)) * .024
}

function stop(): void {
  if (!frameId) return
  cancelAnimationFrame(frameId)
  frameId = 0
}

function start(): void {
  stop()
  if (disposed || document.hidden || !renderer || !mesh || !program) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const render = (time: number): void => {
    if (!renderer || !mesh || !program) return
    pointer.x += (pointer.targetX - pointer.x) * .045
    pointer.y += (pointer.targetY - pointer.y) * .045
    program.uniforms.uMouse.value = [pointer.x, pointer.y]
    program.uniforms.uTime.value = time * .001
    renderer.render({ scene: mesh })
  }
  if (reduced) {
    render(0)
    return
  }
  const loop = (time: number): void => {
    render(time)
    frameId = requestAnimationFrame(loop)
  }
  frameId = requestAnimationFrame(loop)
}

function handleVisibility(): void {
  start()
}

onMounted(() => {
  const container = root.value
  if (!container) return
  renderer = new Renderer({
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    dpr: Math.min(window.devicePixelRatio || 1, 1.5),
    powerPreference: 'low-power',
  })
  const gl = renderer.gl
  gl.clearColor(0, 0, 0, 0)
  const noiseTexture = new Texture(gl, {
    image: createNoise(),
    width: 128,
    height: 128,
    generateMipmaps: false,
    flipY: false,
  })
  noiseTexture.minFilter = gl.LINEAR
  noiseTexture.magFilter = gl.LINEAR
  noiseTexture.wrapS = gl.REPEAT
  noiseTexture.wrapT = gl.REPEAT
  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: [1, 1, 1] },
    uNoiseTexture: { value: noiseTexture },
    uMouse: { value: [0, 0] },
    uEyeColor: { value: hexToRgb(props.color) },
  }
  program = new Program(gl, { vertex: vertexShader, fragment: fragmentShader, uniforms, transparent: true })
  mesh = new Mesh(gl, { geometry: new Triangle(gl), program })
  container.replaceChildren(gl.canvas)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  window.addEventListener('pointermove', handlePointer, { passive: true })
  document.addEventListener('visibilitychange', handleVisibility)
  resize()
  start()
})

onBeforeUnmount(() => {
  disposed = true
  stop()
  resizeObserver?.disconnect()
  window.removeEventListener('pointermove', handlePointer)
  document.removeEventListener('visibilitychange', handleVisibility)
  const canvas = renderer?.gl.canvas
  renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext()
  canvas?.remove()
  renderer = null
  program = null
  mesh = null
})
</script>

<template>
  <div ref="root" class="dr-forum-eye" aria-hidden="true" />
</template>

<style scoped>
.dr-forum-eye,
.dr-forum-eye :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
