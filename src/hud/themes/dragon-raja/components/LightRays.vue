<template>
  <div ref="containerRef" :class="['dr-light-rays', className]" />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'

export type RaysOrigin =
  | 'top-center'
  | 'top-left'
  | 'top-right'
  | 'right'
  | 'left'
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'

interface LightRaysProps {
  raysOrigin?: RaysOrigin
  raysColor?: string
  raysSpeed?: number
  lightSpread?: number
  rayLength?: number
  pulsating?: boolean
  fadeDistance?: number
  saturation?: number
  followMouse?: boolean
  mouseInfluence?: number
  noiseAmount?: number
  distortion?: number
  className?: string
}

interface WebGLUniforms {
  iTime: { value: number }
  iResolution: { value: [number, number] }
  rayPos: { value: [number, number] }
  rayDir: { value: [number, number] }
  raysColor: { value: [number, number, number] }
  raysSpeed: { value: number }
  lightSpread: { value: number }
  rayLength: { value: number }
  pulsating: { value: number }
  fadeDistance: { value: number }
  saturation: { value: number }
  mousePos: { value: [number, number] }
  mouseInfluence: { value: number }
  noiseAmount: { value: number }
  distortion: { value: number }
}

const props = withDefaults(defineProps<LightRaysProps>(), {
  raysOrigin: 'top-center',
  raysColor: '#ffffff',
  raysSpeed: 1,
  lightSpread: 1,
  rayLength: 2,
  pulsating: false,
  fadeDistance: 1,
  saturation: 1,
  followMouse: true,
  mouseInfluence: .1,
  noiseAmount: 0,
  distortion: 0,
  className: '',
})

const emit = defineEmits<{
  failure: [error: Error]
  recovery: []
}>()

const containerRef = useTemplateRef<HTMLDivElement>('containerRef')
const renderer = ref<Renderer | null>(null)
const mesh = ref<Mesh | null>(null)
const uniforms = ref<WebGLUniforms | null>(null)
const isIntersecting = ref(false)
const isDocumentVisible = ref(!document.hidden)
const mouse = { x: .5, y: .5 }
const smoothMouse = { x: .5, y: .5 }
const reducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : {
      matches: false,
      addEventListener: undefined,
      removeEventListener: undefined,
    } as unknown as MediaQueryList
const devicePixelRatio = computed(() => Math.min(window.devicePixelRatio || 1, 1.5))
let animationFrame: number | null = null
let intersectionObserver: IntersectionObserver | null = null
let resizeObserver: ResizeObserver | null = null
let pointerFrame: number | null = null
let contextFailed = false
let disposed = false

const vertexShader = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`

const fragmentShader = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec2 rayPos;
uniform vec2 rayDir;
uniform vec3 raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2 mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);
  float distortedAngle = cosAngle
    + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  float fadeFalloff = clamp(
    (iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance),
    0.5,
    1.0
  );
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;
  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed))
      + (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0,
    1.0
  );
  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) * rayStrength(
    rayPos,
    finalRayDir,
    coord,
    36.2214,
    21.11349,
    1.5 * raysSpeed
  );
  vec4 rays2 = vec4(1.0) * rayStrength(
    rayPos,
    finalRayDir,
    coord,
    22.3991,
    18.0234,
    1.1 * raysSpeed
  );
  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= 1.0 - noiseAmount + noiseAmount * n;
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }
  fragColor.rgb *= raysColor;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return match
    ? [Number.parseInt(match[1]!, 16) / 255, Number.parseInt(match[2]!, 16) / 255, Number.parseInt(match[3]!, 16) / 255]
    : [1, 1, 1]
}

function getAnchorAndDirection(origin: RaysOrigin, width: number, height: number): {
  anchor: [number, number]
  direction: [number, number]
} {
  const outside = .2
  if (origin === 'top-left') return { anchor: [0, -outside * height], direction: [0, 1] }
  if (origin === 'top-right') return { anchor: [width, -outside * height], direction: [0, 1] }
  if (origin === 'left') return { anchor: [-outside * width, .5 * height], direction: [1, 0] }
  if (origin === 'right') return { anchor: [(1 + outside) * width, .5 * height], direction: [-1, 0] }
  if (origin === 'bottom-left') return { anchor: [0, (1 + outside) * height], direction: [0, -1] }
  if (origin === 'bottom-center') return { anchor: [.5 * width, (1 + outside) * height], direction: [0, -1] }
  if (origin === 'bottom-right') return { anchor: [width, (1 + outside) * height], direction: [0, -1] }
  return { anchor: [.5 * width, -outside * height], direction: [0, 1] }
}

function updatePlacement(): void {
  if (!containerRef.value || !renderer.value || !uniforms.value) return
  const width = Math.max(1, containerRef.value.clientWidth)
  const height = Math.max(1, containerRef.value.clientHeight)
  renderer.value.dpr = devicePixelRatio.value
  renderer.value.setSize(width, height)
  const pixelWidth = width * renderer.value.dpr
  const pixelHeight = height * renderer.value.dpr
  uniforms.value.iResolution.value = [pixelWidth, pixelHeight]
  const { anchor, direction } = getAnchorAndDirection(props.raysOrigin, pixelWidth, pixelHeight)
  uniforms.value.rayPos.value = anchor
  uniforms.value.rayDir.value = direction
  if (reducedMotion.matches) render(0)
}

function updateUniforms(): void {
  if (!uniforms.value) return
  uniforms.value.raysColor.value = hexToRgb(props.raysColor)
  uniforms.value.raysSpeed.value = props.raysSpeed
  uniforms.value.lightSpread.value = props.lightSpread
  uniforms.value.rayLength.value = props.rayLength
  uniforms.value.pulsating.value = props.pulsating ? 1 : 0
  uniforms.value.fadeDistance.value = props.fadeDistance
  uniforms.value.saturation.value = props.saturation
  uniforms.value.mouseInfluence.value = props.mouseInfluence
  uniforms.value.noiseAmount.value = props.noiseAmount
  uniforms.value.distortion.value = props.distortion
  updatePlacement()
}

function render(time: number): void {
  if (!renderer.value || !mesh.value || !uniforms.value || contextFailed) return
  uniforms.value.iTime.value = time * .001
  if (props.followMouse && props.mouseInfluence > 0) {
    const smoothing = .92
    smoothMouse.x = smoothMouse.x * smoothing + mouse.x * (1 - smoothing)
    smoothMouse.y = smoothMouse.y * smoothing + mouse.y * (1 - smoothing)
    uniforms.value.mousePos.value = [smoothMouse.x, smoothMouse.y]
  }
  renderer.value.render({ scene: mesh.value })
}

function stop(): void {
  if (animationFrame === null) return
  cancelAnimationFrame(animationFrame)
  animationFrame = null
}

function start(): void {
  stop()
  if (!isIntersecting.value || !isDocumentVisible.value || contextFailed) return
  if (reducedMotion.matches) {
    render(0)
    return
  }
  const loop = (time: number): void => {
    try {
      render(time)
      animationFrame = requestAnimationFrame(loop)
    } catch (error) {
      stop()
      emit('failure', error instanceof Error ? error : new Error(String(error)))
    }
  }
  animationFrame = requestAnimationFrame(loop)
}

function destroyRenderer(releaseContext: boolean): void {
  stop()
  const gl = renderer.value?.gl
  if (gl) {
    gl.canvas.removeEventListener('webglcontextlost', handleContextLost)
    gl.canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    if (releaseContext) gl.getExtension('WEBGL_lose_context')?.loseContext()
    gl.canvas.remove()
  }
  renderer.value = null
  mesh.value = null
  uniforms.value = null
}

function handleContextLost(event: Event): void {
  event.preventDefault()
  if (disposed || contextFailed) return
  contextFailed = true
  stop()
  const detail = (event as WebGLContextEvent).statusMessage || 'The LightRays WebGL context was lost.'
  emit('failure', new Error(detail))
}

function handleContextRestored(): void {
  if (disposed) return
  contextFailed = false
  updatePlacement()
  start()
  emit('recovery')
}

async function initialize(): Promise<void> {
  if (!containerRef.value || renderer.value || disposed) return
  await nextTick()
  if (!containerRef.value || renderer.value || disposed) return

  try {
    const nextRenderer = new Renderer({
      dpr: devicePixelRatio.value,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    })
    const gl = nextRenderer.gl
    gl.canvas.style.width = '100%'
    gl.canvas.style.height = '100%'
    gl.canvas.addEventListener('webglcontextlost', handleContextLost)
    gl.canvas.addEventListener('webglcontextrestored', handleContextRestored)
    containerRef.value.replaceChildren(gl.canvas)

    const nextUniforms: WebGLUniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(props.raysColor) },
      raysSpeed: { value: props.raysSpeed },
      lightSpread: { value: props.lightSpread },
      rayLength: { value: props.rayLength },
      pulsating: { value: props.pulsating ? 1 : 0 },
      fadeDistance: { value: props.fadeDistance },
      saturation: { value: props.saturation },
      mousePos: { value: [.5, .5] },
      mouseInfluence: { value: props.mouseInfluence },
      noiseAmount: { value: props.noiseAmount },
      distortion: { value: props.distortion },
    }
    const geometry = new Triangle(gl)
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: nextUniforms,
    })
    renderer.value = nextRenderer
    uniforms.value = nextUniforms
    mesh.value = new Mesh(gl, { geometry, program })
    contextFailed = false
    updatePlacement()
    start()
  } catch (error) {
    destroyRenderer(true)
    emit('failure', error instanceof Error ? error : new Error(String(error)))
  }
}

function handlePointerMove(event: PointerEvent): void {
  if (!props.followMouse || pointerFrame !== null || !containerRef.value) return
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = null
    const bounds = containerRef.value?.getBoundingClientRect()
    if (!bounds?.width || !bounds.height) return
    mouse.x = (event.clientX - bounds.left) / bounds.width
    mouse.y = (event.clientY - bounds.top) / bounds.height
  })
}

function handleVisibility(): void {
  isDocumentVisible.value = !document.hidden
  start()
}

function handleMotionPreference(): void {
  start()
}

watch(isIntersecting, (visible) => {
  if (visible) void initialize().then(start)
  else stop()
})

watch(
  () => [
    props.raysOrigin,
    props.raysColor,
    props.raysSpeed,
    props.lightSpread,
    props.rayLength,
    props.pulsating,
    props.fadeDistance,
    props.saturation,
    props.mouseInfluence,
    props.noiseAmount,
    props.distortion,
  ],
  updateUniforms,
  { flush: 'post' },
)

onMounted(() => {
  if (!containerRef.value) return
  if (typeof IntersectionObserver === 'undefined') {
    isIntersecting.value = true
  } else {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting.value = Boolean(entry?.isIntersecting)
    }, { threshold: .01, rootMargin: '50px' })
    intersectionObserver.observe(containerRef.value)
  }
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updatePlacement)
    resizeObserver.observe(containerRef.value)
  }
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  document.addEventListener('visibilitychange', handleVisibility)
  reducedMotion.addEventListener?.('change', handleMotionPreference)
})

onBeforeUnmount(() => {
  disposed = true
  intersectionObserver?.disconnect()
  resizeObserver?.disconnect()
  window.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('visibilitychange', handleVisibility)
  reducedMotion.removeEventListener?.('change', handleMotionPreference)
  if (pointerFrame !== null) cancelAnimationFrame(pointerFrame)
  destroyRenderer(true)
})
</script>

<style scoped>
.dr-light-rays {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.dr-light-rays :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
