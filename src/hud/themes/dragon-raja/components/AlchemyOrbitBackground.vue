<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMotionScope } from '../../../shared/motion'

const props = withDefaults(defineProps<{
  orbitCount?: number
}>(), {
  orbitCount: 3,
})

const root = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const motion = useMotionScope({ root })
const orbitCount = computed(() => clamp(Math.round(Number(props.orbitCount) || 3), 3, 8))

const ringColors = ['#d7a95a', '#b8c6b9', '#efc778']
let visibilityHandler: (() => void) | null = null

interface RingDefinition {
  id: string
  radius: number
  color: string
  dash: string
  duration: number
  opacity: number
  strokeWidth: number
}

interface AlchemyProfile {
  ringCount: 2 | 3
  ringStart: number
  ringSpan: number
  ringDash: readonly string[]
  ringOpacity: number
  ringStrokeWidth: number
  constructionCount: number
  constructionRadius: number
  triangleRadius: number
  triangleRotation: number
  triangleScaleX: number
  triangleScaleY: number
  facetSides: number
  facetRadius: number
  facetRotation: number
  diamondRadius: number
  diamondRotation: number
  diamondScaleX: number
  diamondScaleY: number
  spokeCount: number
  spokeRotation: number
  motifCount: number
  motifRadius: number
  motifSize: number
  motifVariant: number
  sigilCount: number
  sigilRadius: number
  sigilSize: number
  orbitMarkerCount: number
  orbitMarkerRadius: number
  orbitMarkerSize: number
  coreRadius: number
  coreDiamondScaleX: number
  coreDiamondScaleY: number
  spokeLength: number
  pace: number
}

interface Point {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function regularPoints(
  radius: number,
  count: number,
  rotation = -Math.PI / 2,
  scaleX = 1,
  scaleY = 1,
): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / count
    return {
      x: 50 + Math.cos(angle) * radius * scaleX,
      y: 50 + Math.sin(angle) * radius * scaleY,
    }
  })
}

function pointString(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b) {
    const remainder = a % b
    a = b
    b = remainder
  }
  return a
}

function starPointString(points: Point[], step: number): string {
  const ordered: Point[] = []
  const visited = new Set<number>()
  let index = 0
  while (!visited.has(index)) {
    visited.add(index)
    ordered.push(points[index])
    index = (index + step) % points.length
  }
  return pointString(ordered)
}

const bloodlineProfile = computed<AlchemyProfile>(() => {
  const tier = orbitCount.value - 3
  return {
    ringCount: tier >= 3 ? 3 : 2,
    ringStart: 20 + tier * 1.15,
    ringSpan: 18 + tier * 1.7,
    ringDash: [
      ['1.4 2.6', '3.4 2.4'],
      ['1.6 2.3', '3.8 2.1'],
      ['1.8 2.1', '4.2 1.9'],
      ['2 1.9', '4.5 1.7'],
      ['2.2 1.7', '4.8 1.5'],
      ['2.4 1.5', '5.2 1.3'],
    ][tier],
    ringOpacity: 0.5 + tier * 0.025,
    ringStrokeWidth: 0.48 + tier * 0.035,
    constructionCount: 7 + tier,
    constructionRadius: 33 + tier * 1.45,
    triangleRadius: 29 + tier * 2.65,
    triangleRotation: -Math.PI / 2 + tier * 0.13,
    triangleScaleX: 0.78 + tier * 0.05,
    triangleScaleY: 1.14 - tier * 0.025,
    facetSides: 5 + tier,
    facetRadius: 19 + tier * 2.35,
    facetRotation: tier * 0.17,
    diamondRadius: 9.5 + tier * 1.35,
    diamondRotation: -Math.PI / 4 + tier * 0.11,
    diamondScaleX: 0.72 + tier * 0.075,
    diamondScaleY: 1.18 - tier * 0.035,
    spokeCount: 5 + tier,
    spokeRotation: -Math.PI / 2 + tier * 0.095,
    motifCount: 3 + tier,
    motifRadius: 42.5 + tier * 0.85,
    motifSize: 1.9 + tier * 0.12,
    motifVariant: tier % 3,
    sigilCount: 3 + tier,
    sigilRadius: 27 + tier * 1.1,
    sigilSize: 1.15 + tier * 0.08,
    orbitMarkerCount: 3 + tier,
    orbitMarkerRadius: 1.9 + tier * 0.18,
    orbitMarkerSize: 1.7 + tier * 0.1,
    coreRadius: 4.9 + tier * 0.68,
    coreDiamondScaleX: 0.72 + tier * 0.06,
    coreDiamondScaleY: 1.15 - tier * 0.025,
    spokeLength: 27 + tier * 2.15,
    pace: 0.86 + tier * 0.065,
  }
})

const orbits = computed<RingDefinition[]>(() => {
  const profile = bloodlineProfile.value
  const count = profile.ringCount
  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1)
    return {
      id: `ring-${index + 1}`,
      radius: profile.ringStart + progress * profile.ringSpan,
      color: ringColors[index % ringColors.length],
      dash: profile.ringDash[index] ?? profile.ringDash[profile.ringDash.length - 1] ?? '3 2',
      duration: (25 + index * 4) / profile.pace,
      opacity: index === 0 ? profile.ringOpacity : profile.ringOpacity + 0.08,
      strokeWidth: profile.ringStrokeWidth + index * 0.04,
    }
  })
})

const triangleUp = computed(() => regularPoints(
  bloodlineProfile.value.triangleRadius,
  3,
  bloodlineProfile.value.triangleRotation,
  bloodlineProfile.value.triangleScaleX,
  bloodlineProfile.value.triangleScaleY,
))
const triangleDown = computed(() => regularPoints(
  bloodlineProfile.value.triangleRadius,
  3,
  bloodlineProfile.value.triangleRotation + Math.PI,
  bloodlineProfile.value.triangleScaleY,
  bloodlineProfile.value.triangleScaleX,
))
const constructionPoints = computed(() => regularPoints(
  bloodlineProfile.value.constructionRadius,
  bloodlineProfile.value.constructionCount,
  -Math.PI / 2 + Math.PI / bloodlineProfile.value.constructionCount,
))
const facetPoints = computed(() => regularPoints(
  bloodlineProfile.value.facetRadius,
  bloodlineProfile.value.facetSides,
  bloodlineProfile.value.facetRotation,
))
const diamondPoints = computed(() => regularPoints(
  bloodlineProfile.value.diamondRadius,
  4,
  bloodlineProfile.value.diamondRotation,
  bloodlineProfile.value.diamondScaleX,
  bloodlineProfile.value.diamondScaleY,
))
const triangleUpString = computed(() => pointString(triangleUp.value))
const triangleDownString = computed(() => pointString(triangleDown.value))
const constructionStep = computed(() => {
  const count = bloodlineProfile.value.constructionCount
  for (let candidate = Math.floor(count / 2); candidate > 1; candidate -= 1) {
    if (greatestCommonDivisor(count, candidate) === 1) return candidate
  }
  return 1
})
const constructionStarString = computed(() => starPointString(constructionPoints.value, constructionStep.value))
const facetString = computed(() => pointString(facetPoints.value))
const diamondString = computed(() => pointString(diamondPoints.value))
const spokePath = computed(() => regularPoints(
  bloodlineProfile.value.spokeLength,
  bloodlineProfile.value.spokeCount,
  bloodlineProfile.value.spokeRotation,
)
  .map((point) => `M 50 50 L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
  .join(' '))
const perimeterMotifs = computed(() => regularPoints(bloodlineProfile.value.motifRadius, bloodlineProfile.value.motifCount).map((point, index) => {
  const angle = (360 / bloodlineProfile.value.motifCount) * index - 90
  return {
    id: `motif-${index + 1}`,
    transform: `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${angle})`,
  }
}))
const motifPath = computed(() => {
  const size = bloodlineProfile.value.motifSize
  if (bloodlineProfile.value.motifVariant === 1) {
    return `M 0 -${size} L ${size} 0 L 0 ${size} L -${size} 0 Z M 0 -${size * .42} L ${size * .42} 0 L 0 ${size * .42} L -${size * .42} 0 Z`
  }
  if (bloodlineProfile.value.motifVariant === 2) {
    return `M 0 -${size} A ${size} ${size} 0 1 1 0 ${size} A ${size} ${size} 0 1 1 0 -${size} Z M 0 -${size * .35} L ${size * .35} 0 L 0 ${size * .35} L -${size * .35} 0 Z`
  }
  return `M 0 -${size * 1.25} L ${size} ${size * .65} L -${size} ${size * .65} Z M 0 -${size * .45} L ${size * .36} ${size * .25} L -${size * .36} ${size * .25} Z`
})
const perimeterSigils = computed(() => {
  const profile = bloodlineProfile.value
  const colors = ['#d7a95a', '#efc778', '#b8c6b9']
  return regularPoints(profile.sigilRadius, profile.sigilCount, -Math.PI / 2 + Math.PI / profile.sigilCount).map((point, index) => ({
    id: `sigil-${index + 1}`,
    transform: `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${(360 / profile.sigilCount) * index - 90})`,
    color: colors[(index + profile.motifVariant) % colors.length],
    kind: (index + profile.motifVariant) % 3,
  }))
})
function sigilPath(kind: number): string {
  const size = bloodlineProfile.value.sigilSize
  if (kind === 1) return `M 0 -${size} L ${size} 0 L 0 ${size} L -${size} 0 Z M -${size * .45} 0 H ${size * .45}`
  if (kind === 2) return `M 0 -${size} L ${size * .72} ${size * .72} L -${size * .72} ${size * .72} Z M 0 -${size * .35} V ${size * .35}`
  return `M 0 -${size} A ${size} ${size} 0 0 1 ${size} 0 M 0 ${size} A ${size} ${size} 0 0 1 -${size} 0`
}
const orbitMarkers = computed(() => {
  const profile = bloodlineProfile.value
  const outerRadius = orbits.value[orbits.value.length - 1]?.radius ?? profile.ringStart + profile.ringSpan
  return regularPoints(outerRadius + profile.orbitMarkerRadius, profile.orbitMarkerCount).map((point, index) => {
    const angle = (360 / profile.orbitMarkerCount) * index - 90
    return {
      id: `orbit-marker-${index + 1}`,
      transform: `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${angle})`,
    }
  })
})
const constructionNodes = computed(() => constructionPoints.value.filter((_, index) => index % 2 === 0))

function syncAnimation(): void {
  const element = svg.value
  if (!element) return
  if (motion.reducedMotion.value || document.hidden) {
    element.pauseAnimations?.()
  } else {
    element.unpauseAnimations?.()
  }
}

onMounted(() => {
  visibilityHandler = syncAnimation
  document.addEventListener('visibilitychange', visibilityHandler)
  syncAnimation()
})

watch(() => motion.reducedMotion.value, syncAnimation)

onBeforeUnmount(() => {
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
  visibilityHandler = null
})
</script>

<template>
  <div ref="root" class="dr-radar__alchemy" data-animation="svg" :data-orbit-count="orbitCount" aria-hidden="true">
    <svg ref="svg" class="dr-radar__alchemy-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <g class="dr-radar__alchemy-disc" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle
          v-for="orbit in orbits"
          :key="orbit.id"
          cx="50"
          cy="50"
          :r="orbit.radius"
          :stroke="orbit.color"
          :stroke-dasharray="orbit.dash"
          :stroke-width="orbit.strokeWidth"
          :opacity="orbit.opacity"
        >
          <animate
            v-if="!motion.reducedMotion.value"
            attributeName="stroke-dashoffset"
            from="0"
            to="-20"
            :dur="`${orbit.duration}s`"
            repeatCount="indefinite"
          />
          <animate
            v-if="!motion.reducedMotion.value"
            attributeName="opacity"
            :values="`${orbit.opacity - .1};${orbit.opacity};${orbit.opacity - .1}`"
            :dur="`${6 + orbit.duration * .08}s`"
            repeatCount="indefinite"
          />
        </circle>

        <g class="dr-radar__alchemy-triangles">
          <polygon
            :points="constructionStarString"
            stroke="#b8c6b9"
            :stroke-width=".38 + (orbitCount - 3) * .025"
            :opacity=".46 + (orbitCount - 3) * .018"
          >
            <animateTransform
              v-if="!motion.reducedMotion.value"
              attributeName="transform"
              type="rotate"
              from="360 50 50"
              to="0 50 50"
            :dur="`${78 / bloodlineProfile.pace}s`"
              repeatCount="indefinite"
            />
          </polygon>
          <polygon :points="triangleUpString" stroke="#efc778" :stroke-width=".64 + (orbitCount - 3) * .04" :opacity=".7 + (orbitCount - 3) * .025">
            <animateTransform
              v-if="!motion.reducedMotion.value"
              attributeName="transform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              :dur="`${46 / bloodlineProfile.pace}s`"
              repeatCount="indefinite"
            />
          </polygon>
          <g stroke="#efc778" :stroke-width=".28 + (orbitCount - 3) * .015" :opacity=".4 + (orbitCount - 3) * .018">
            <line v-for="(point, index) in triangleUp" :key="`ray-up-${index}`" x1="50" y1="50" :x2="point.x" :y2="point.y" />
            <animateTransform
              v-if="!motion.reducedMotion.value"
              attributeName="transform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              :dur="`${46 / bloodlineProfile.pace}s`"
              repeatCount="indefinite"
            />
          </g>
          <polygon :points="triangleDownString" stroke="#b8c6b9" :stroke-width=".52 + (orbitCount - 3) * .035" :opacity=".58 + (orbitCount - 3) * .022">
            <animateTransform
              v-if="!motion.reducedMotion.value"
              attributeName="transform"
              type="rotate"
              from="360 50 50"
              to="0 50 50"
              :dur="`${58 / bloodlineProfile.pace}s`"
              repeatCount="indefinite"
            />
          </polygon>
          <g stroke="#b8c6b9" :stroke-width=".25 + (orbitCount - 3) * .012" :opacity=".34 + (orbitCount - 3) * .014">
            <line v-for="(point, index) in triangleDown" :key="`ray-down-${index}`" x1="50" y1="50" :x2="point.x" :y2="point.y" />
            <animateTransform
              v-if="!motion.reducedMotion.value"
              attributeName="transform"
              type="rotate"
              from="360 50 50"
              to="0 50 50"
              :dur="`${58 / bloodlineProfile.pace}s`"
              repeatCount="indefinite"
            />
          </g>
          <polygon :points="facetString" stroke="#b8c6b9" :stroke-width=".4 + (orbitCount - 3) * .032" stroke-dasharray="2.6 1.9" :opacity=".48 + (orbitCount - 3) * .024">
            <animateTransform
              v-if="!motion.reducedMotion.value"
              attributeName="transform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              :dur="`${63 / bloodlineProfile.pace}s`"
              repeatCount="indefinite"
            />
          </polygon>
          <polygon :points="diamondString" stroke="#d7a95a" :stroke-width=".36 + (orbitCount - 3) * .032" :opacity=".5 + (orbitCount - 3) * .024">
            <animateTransform
              v-if="!motion.reducedMotion.value"
              attributeName="transform"
              type="rotate"
              from="360 50 50"
              to="0 50 50"
              :dur="`${37 / bloodlineProfile.pace}s`"
              repeatCount="indefinite"
            />
          </polygon>
          <path :d="spokePath" stroke="#b8c6b9" :stroke-width=".2 + (orbitCount - 3) * .025" :opacity=".3 + (orbitCount - 3) * .018" stroke-dasharray="1.2 2.4" />
        </g>

        <g class="dr-radar__alchemy-orbit-markers" stroke="#d7a95a" fill="none" stroke-width=".56" opacity=".68">
          <path
            v-for="marker in orbitMarkers"
            :key="marker.id"
            :transform="marker.transform"
            :d="`M 0 -${bloodlineProfile.orbitMarkerSize} L 0 ${bloodlineProfile.orbitMarkerSize} M -${bloodlineProfile.orbitMarkerSize * .55} 0 H ${bloodlineProfile.orbitMarkerSize * .55}`"
          />
        </g>

        <g class="dr-radar__alchemy-sigils" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".7">
          <g
            v-for="sigil in perimeterSigils"
            :key="sigil.id"
            :transform="sigil.transform"
          >
            <path
              :stroke="sigil.color"
              :stroke-width=".48 + (orbitCount - 3) * .018"
              :d="sigilPath(sigil.kind)"
            >
              <animateTransform
                v-if="!motion.reducedMotion.value"
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                :dur="`${36 / bloodlineProfile.pace}s`"
                repeatCount="indefinite"
              />
            </path>
          </g>
        </g>

        <g class="dr-radar__alchemy-perimeter" stroke="#d7a95a" stroke-width=".48" opacity=".72">
          <path
            v-for="motif in perimeterMotifs"
            :key="motif.id"
            :transform="motif.transform"
            :d="motifPath"
          />
          <animateTransform
            v-if="!motion.reducedMotion.value"
            attributeName="transform"
            type="rotate"
            from="0 50 50"
            to="360 50 50"
            :dur="`${72 / bloodlineProfile.pace}s`"
            repeatCount="indefinite"
          />
        </g>

        <g class="dr-radar__alchemy-nodes" fill="#f1cf87" stroke="#211d1c" stroke-width=".3">
          <circle v-for="(point, index) in triangleUp" :key="`node-up-${index}`" :cx="point.x" :cy="point.y" :r="index === 0 ? 1.28 + (orbitCount - 3) * .08 : 1.02 + (orbitCount - 3) * .05" :opacity=".82 + (orbitCount - 3) * .018" />
          <animateTransform
            v-if="!motion.reducedMotion.value"
            attributeName="transform"
            type="rotate"
            from="0 50 50"
            to="360 50 50"
            :dur="`${46 / bloodlineProfile.pace}s`"
            repeatCount="indefinite"
          />
        </g>
        <g class="dr-radar__alchemy-nodes" fill="#cbd4c2" stroke="#211d1c" stroke-width=".3">
          <circle v-for="(point, index) in triangleDown" :key="`node-down-${index}`" :cx="point.x" :cy="point.y" :r="index === 0 ? 1.2 + (orbitCount - 3) * .075 : .96 + (orbitCount - 3) * .045" :opacity=".72 + (orbitCount - 3) * .018" />
          <animateTransform
            v-if="!motion.reducedMotion.value"
            attributeName="transform"
            type="rotate"
            from="360 50 50"
            to="0 50 50"
            :dur="`${58 / bloodlineProfile.pace}s`"
            repeatCount="indefinite"
          />
        </g>
        <g class="dr-radar__alchemy-construction-nodes" fill="#d7a95a" stroke="none" opacity=".48">
          <circle v-for="(point, index) in constructionNodes" :key="`construction-node-${index}`" :cx="point.x" :cy="point.y" :r=".62 + (orbitCount - 3) * .045" />
        </g>
      </g>

      <g class="dr-radar__alchemy-core" transform="translate(50 50)" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle :r="bloodlineProfile.coreRadius + 1.2" stroke="#d7a95a" :stroke-width=".5 + (orbitCount - 3) * .012" :opacity=".5 + (orbitCount - 3) * .02" stroke-dasharray="1.2 1.8">
          <animateTransform
            v-if="!motion.reducedMotion.value"
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            :dur="`${25 / bloodlineProfile.pace}s`"
            repeatCount="indefinite"
          />
        </circle>
        <circle :r="bloodlineProfile.coreRadius * .58" stroke="#efc778" :stroke-width=".62 + (orbitCount - 3) * .014" :opacity=".68 + (orbitCount - 3) * .02" />
        <circle :r="bloodlineProfile.coreRadius * .36" fill="#f1cf87" stroke="none" :opacity=".66 + (orbitCount - 3) * .018">
          <animate
            v-if="!motion.reducedMotion.value"
            attributeName="r"
            :values="`${bloodlineProfile.coreRadius * .36};${bloodlineProfile.coreRadius * .43};${bloodlineProfile.coreRadius * .36}`"
            dur="4.2s"
            repeatCount="indefinite"
          />
        </circle>
        <path :d="`M 0 -${bloodlineProfile.diamondRadius * .25 * bloodlineProfile.coreDiamondScaleY} L ${bloodlineProfile.diamondRadius * .25 * bloodlineProfile.coreDiamondScaleX} 0 L 0 ${bloodlineProfile.diamondRadius * .25 * bloodlineProfile.coreDiamondScaleY} L -${bloodlineProfile.diamondRadius * .25 * bloodlineProfile.coreDiamondScaleX} 0 Z`" stroke="#cbd4c2" :stroke-width=".54 + (orbitCount - 3) * .03" :opacity=".76 + (orbitCount - 3) * .02">
          <animateTransform
            v-if="!motion.reducedMotion.value"
            attributeName="transform"
            type="rotate"
            from="0"
            to="-360"
            :dur="`${17 / bloodlineProfile.pace}s`"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  </div>
</template>
