<script setup lang="ts">
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  tint?: string
  brightness?: number
  speed?: number
}>(), {
  tint: '#4f9b69',
  brightness: 1.55,
  speed: .34,
})

const root = ref<HTMLDivElement | null>(null)
let renderer: Renderer | null = null
let mesh: Mesh | null = null
let program: Program | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let frameId = 0
let visible = true
let disposed = false
let startedAt = 0

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`

// Adapted from Vue Bits Faulty Terminal for a tall status rail. Cell density is derived
// from the rendered pixel size so the field does not stretch into oversized rows.
const fragmentShader = `
precision mediump float;
varying vec2 vUv;
uniform float iTime;
uniform vec2 iResolution;
uniform vec3 uTint;
uniform float uBrightness;

float time;

float hash21(vec2 p) {
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2;
}

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  p *= 1.1;
  f += amp * noise(p);
  p = rotate2d(time * 0.02) * p * 2.0;
  amp *= 0.454545;
  f += amp * noise(p);
  p = rotate2d(time * 0.08) * p * 2.0;
  amp *= 0.454545;
  f += amp * noise(p);
  return f;
}

float pattern(vec2 p) {
  vec2 q = vec2(fbm(p + 1.0), fbm(rotate2d(0.1 * time) * p + 1.0));
  vec2 r = vec2(fbm(rotate2d(0.1) * q), fbm(q));
  return fbm(p + r);
}

float digit(vec2 p) {
  vec2 grid = max(floor(iResolution / vec2(11.0, 16.0)), vec2(18.0, 24.0));
  vec2 gridPoint = p * grid;
  vec2 cellId = floor(gridPoint);
  vec2 samplePoint = cellId * vec2(0.052, 0.067);
  float intensity = pattern(samplePoint) * 1.32 - 0.055;
  intensity += (hash21(cellId + floor(time * 2.0)) - 0.42) * 0.13;
  float dropout = step(0.075, hash21(cellId * vec2(5.73, 9.41) + floor(time * 0.28)));
  vec2 cell = fract(gridPoint) * 1.28;
  float x = fract(cell.x * 5.0);
  float y = fract((1.0 - cell.y) * 5.0);
  float i = floor((1.0 - cell.y) * 5.0) - 2.0;
  float j = floor(cell.x * 5.0) - 2.0;
  float threshold = (i * i + j * j) * 0.0625;
  float on = step(0.1, intensity - threshold);
  float mask = step(0.0, cell.x) * step(cell.x, 1.0) * step(0.0, cell.y) * step(cell.y, 1.0);
  return mask * on * dropout * (0.2 + y * 0.8) * (0.75 + x * 0.25);
}

float burst(float a, float b, float c) {
  return step(c, sin(iTime + a * cos(iTime * b)));
}

float displace(vec2 p) {
  float y = p.y - mod(iTime * 0.22, 1.0);
  float windowMask = 1.0 / (1.0 + 180.0 * y * y);
  float pixels = sin(p.y * 31.0 + iTime) * 5.0 * burst(4.0, 2.0, 0.8)
    * (0.7 + 0.3 * cos(iTime * 60.0)) * windowMask;
  return pixels / max(iResolution.x, 1.0);
}

float field(vec2 p) {
  p.x += displace(p);
  float center = digit(p);
  vec2 off = 1.35 / max(iResolution, vec2(1.0));
  float halo = digit(p + vec2(-off.x, 0.0)) + digit(p + vec2(off.x, 0.0))
    + digit(p + vec2(0.0, -off.y)) + digit(p + vec2(0.0, off.y));
  float scan = 0.84 + 0.16 * step(0.48, fract(gl_FragCoord.y * 0.25));
  return (center * 0.92 + halo * 0.055) * scan;
}

void main() {
  time = iTime * 0.333333;
  vec2 uv = vUv;
  float row = floor(gl_FragCoord.y * 0.5);
  float rowJitter = (hash21(vec2(row, floor(iTime * 9.0))) - 0.5)
    * step(0.965, hash21(vec2(floor(iTime * 4.0), row)));
  uv.x += rowJitter * 7.0 / max(iResolution.x, 1.0);
  float signal = pow(max(field(uv), 0.0), 0.78);
  float grain = (hash21(gl_FragCoord.xy + iTime) - 0.5) * 0.026;
  float verticalBand = 0.92 + 0.08 * sin(gl_FragCoord.y * 0.045 + iTime * 1.7);
  float edge = smoothstep(0.0, 0.055, uv.x) * smoothstep(0.0, 0.055, 1.0 - uv.x);
  vec3 color = max(vec3(0.0), uTint * (signal * 1.18 + grain) * uBrightness);
  gl_FragColor = vec4(color * verticalBand * edge, 1.0);
}`

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return [79 / 255, 155 / 255, 105 / 255]
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ]
}

function resize(): void {
  const container = root.value
  if (!container || !renderer || !program) return
  const width = Math.max(1, container.clientWidth)
  const height = Math.max(1, container.clientHeight)
  renderer.setSize(width, height)
  program.uniforms.iResolution.value = [width, height]
}

function stop(): void {
  if (!frameId) return
  cancelAnimationFrame(frameId)
  frameId = 0
}

function render(time: number): void {
  if (!renderer || !mesh || !program) return
  if (!startedAt) startedAt = time
  program.uniforms.iTime.value = (time - startedAt) * .001 * props.speed
  renderer.render({ scene: mesh })
}

function start(): void {
  stop()
  if (disposed || !visible || document.hidden || !renderer) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    alpha: false,
    antialias: false,
    dpr: Math.min(window.devicePixelRatio || 1, 1.5),
    powerPreference: 'low-power',
  })
  const gl = renderer.gl
  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: [1, 1] },
    uTint: { value: hexToRgb(props.tint) },
    uBrightness: { value: props.brightness },
  }
  program = new Program(gl, { vertex: vertexShader, fragment: fragmentShader, uniforms })
  mesh = new Mesh(gl, { geometry: new Triangle(gl), program })
  container.replaceChildren(gl.canvas)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  if (typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      start()
    }, { threshold: .01 })
    intersectionObserver.observe(container)
  }
  document.addEventListener('visibilitychange', handleVisibility)
  resize()
  start()
})

onBeforeUnmount(() => {
  disposed = true
  stop()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  document.removeEventListener('visibilitychange', handleVisibility)
  const canvas = renderer?.gl.canvas
  renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext()
  canvas?.remove()
  renderer = null
  mesh = null
  program = null
})
</script>

<template>
  <div ref="root" class="dr-forum-terminal" aria-hidden="true" />
</template>

<style scoped>
.dr-forum-terminal,
.dr-forum-terminal :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
