<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { useMotionScope } from '../../../shared/motion'
import { DRAGON_RAJA_MEDIA } from '../media'
import {
  OPENING_BLOODLINE_RATINGS,
  OPENING_BLOODLINE_STABILITIES,
  OPENING_COARSE_TIERS,
  OPENING_GENDER_OPTIONS,
  OPENING_GROUPS,
  OPENING_IDENTITY_OPTIONS,
  OPENING_SPIRIT_CATEGORIES,
  OPENING_SPIRIT_OPTIONS,
  type OpeningCoarseTier,
  type OpeningSpiritCategory,
} from '../worldData'
import type { OpeningChoiceGroup, OpeningSelection } from '../types'

type DragonStepId = 'profile' | 'tier' | 'bloodline' | 'spirit'
type DragonStep = { id: DragonStepId; title: string; instruction: string }

const DRAGON_STEPS: readonly DragonStep[] = [
  { id: 'profile', title: '基础人设', instruction: '先写下角色的可识别信息，再决定他从哪一层世界进入卡塞尔。' },
  { id: 'tier', title: '阶层选择', instruction: '根据上一页的粗略阶层，选择一个具体身份；它会改变故事的起点与可用资源。' },
  { id: 'bloodline', title: '血统评级', instruction: '觉醒者需要记录血统评级、稳定性和言灵所属分类；未觉醒者暂不作出判定。' },
  { id: 'spirit', title: '言灵选择', instruction: '从当前分类中挑选最多三个言灵。未觉醒者保留未知，等待故事揭示答案。' },
]

const props = withDefaults(defineProps<{ groups?: readonly OpeningChoiceGroup[] }>(), { groups: () => OPENING_GROUPS })
const emit = defineEmits<{ complete: [draft: string]; cancel: [] }>()
const root = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const motion = useMotionScope({ root })
const activeGroup = ref(0)
const transitioning = ref(false)

/* Custom groups remain supported for local callers; the shipped surface uses four Dragon steps. */
const dragonFlow = computed(() => props.groups === OPENING_GROUPS || (props.groups.length === 5 && props.groups[0]?.id === 'tier' && props.groups[1]?.id === 'bloodline-rating'))
const groups = computed(() => props.groups)
const steps = computed<readonly (DragonStep | OpeningChoiceGroup)[]>(() => dragonFlow.value ? DRAGON_STEPS : groups.value)
const activeStep = computed(() => steps.value[activeGroup.value]!)
const group = computed(() => groups.value[activeGroup.value]!)

const profile = ref<{ name: string; gender: typeof OPENING_GENDER_OPTIONS[number]; age: number; coarseTier: OpeningCoarseTier | ''; awakened: boolean }>({ name: '', gender: '不公开', age: 18, coarseTier: '', awakened: false })
const dragonSelection = ref<{ identityId: string; bloodlineRating: string; bloodlineStability: string; spiritCategory: OpeningSpiritCategory | ''; spiritIds: string[] }>({ identityId: '', bloodlineRating: '', bloodlineStability: '', spiritCategory: '', spiritIds: [] })
const skippedDragonSteps = ref<ReadonlySet<DragonStepId>>(new Set())
const selected = ref<Record<string, readonly string[]>>({})

const selectedOptions = computed(() => selected.value[group.value?.id ?? ''] ?? [])
const multiple = computed(() => !dragonFlow.value && group.value.selectionMode === 'multiple' && !isForcedSingleGroup(group.value))
const minimum = computed(() => dragonFlow.value ? 0 : minimumSelections(group.value))
const maximum = computed(() => dragonFlow.value ? 3 : maximumSelections(group.value))
const currentChoices = computed(() => dragonFlow.value ? [] : group.value.options)
const denseChoices = computed(() => dragonFlow.value ? activeGroup.value === 1 || activeGroup.value === 3 : group.value.options.length > 6)
const extensiveChoices = computed(() => !dragonFlow.value && group.value.options.length > 12)
const selectedDragonIdentity = computed(() => OPENING_IDENTITY_OPTIONS.find((item) => item.id === dragonSelection.value.identityId) ?? null)
const selectedDragonSpirits = computed(() => OPENING_SPIRIT_OPTIONS.filter((item) => dragonSelection.value.spiritIds.includes(item.id)))
const bloodlineRatingIndex = computed<number>({
  get: () => {
    const index = (OPENING_BLOODLINE_RATINGS as readonly string[]).indexOf(dragonSelection.value.bloodlineRating)
    return index >= 0 ? index : 0
  },
  set: (value: number) => {
    const index = Math.min(OPENING_BLOODLINE_RATINGS.length - 1, Math.max(0, Math.round(Number(value))))
    dragonSelection.value.bloodlineRating = OPENING_BLOODLINE_RATINGS[index] ?? ''
  },
})
const bloodlineStabilityIndex = computed<number>({
  get: () => {
    const index = (OPENING_BLOODLINE_STABILITIES as readonly string[]).indexOf(dragonSelection.value.bloodlineStability)
    return index >= 0 ? index : 0
  },
  set: (value: number) => {
    const index = Math.min(OPENING_BLOODLINE_STABILITIES.length - 1, Math.max(0, Math.round(Number(value))))
    dragonSelection.value.bloodlineStability = OPENING_BLOODLINE_STABILITIES[index] ?? ''
  },
})
const availableIdentityOptions = computed(() => OPENING_IDENTITY_OPTIONS.filter((item) => item.tier === profile.value.coarseTier))
const availableSpiritOptions = computed(() => OPENING_SPIRIT_OPTIONS.filter((item) => item.category === dragonSelection.value.spiritCategory))
const selections = computed<OpeningSelection[]>(() => groups.value.flatMap((item) => {
  const options = selected.value[item.id] ?? []
  return options.length ? [{ groupId: item.id, groupTitle: item.title, option: options.join('、') }] : []
}))
const completedGroups = computed(() => steps.value.filter((item) => isStepComplete(item)).length)
const complete = computed(() => completedGroups.value === steps.value.length)
const remaining = computed(() => steps.value.length - completedGroups.value)
const progressStyle = computed(() => ({ '--dr-opening-progress-scale': String(steps.value.length ? completedGroups.value / steps.value.length : 0), '--dr-opening-step-count': String(Math.max(steps.value.length, 1)) }))

function minimumSelections(item: OpeningChoiceGroup): number {
  if (item.selectionMode !== 'multiple' || isForcedSingleGroup(item)) return 1
  return Math.min(item.options.length, Math.max(0, item.minSelections ?? 1))
}

function maximumSelections(item: OpeningChoiceGroup): number {
  if (item.selectionMode !== 'multiple' || isForcedSingleGroup(item)) return 1
  return Math.min(item.options.length, Math.max(minimumSelections(item), item.maxSelections ?? item.options.length))
}

function isForcedSingleGroup(item: OpeningChoiceGroup): boolean {
  return /(?:阶层|tier)/i.test(`${item.id} ${item.title}`)
}

function groupOptions(item: OpeningChoiceGroup): readonly string[] {
  return selected.value[item.id] ?? []
}

function isGroupComplete(item: OpeningChoiceGroup): boolean {
  return groupOptions(item).length >= minimumSelections(item)
}

function dragonStepComplete(id: DragonStepId): boolean {
  if (id === 'profile') return Boolean(profile.value.coarseTier)
  if (id === 'tier') return Boolean(selectedDragonIdentity.value)
  if (!profile.value.awakened) return skippedDragonSteps.value.has(id)
  if (id === 'bloodline') return Boolean(dragonSelection.value.bloodlineRating && dragonSelection.value.bloodlineStability && dragonSelection.value.spiritCategory)
  return true
}

function canSkipDragonStep(item: DragonStep | OpeningChoiceGroup): boolean {
  if (!dragonFlow.value || profile.value.awakened) return false
  const id = (item as DragonStep).id
  return id === 'bloodline' || id === 'spirit'
}

function isStepComplete(item: DragonStep | OpeningChoiceGroup): boolean {
  return dragonFlow.value ? dragonStepComplete((item as DragonStep).id) : isGroupComplete(item as OpeningChoiceGroup)
}

function isOptionSelected(option: string): boolean {
  return selectedOptions.value.includes(option)
}

function optionLabel(option: string): string {
  const separator = option.indexOf('：')
  return separator >= 0 ? option.slice(0, separator) : option
}

function optionDescription(option: string): string {
  const separator = option.indexOf('：')
  return separator >= 0 ? option.slice(separator + 1) : ''
}

function optionDisabled(option: string): boolean {
  return transitioning.value || (multiple.value && selectedOptions.value.length >= maximum.value && !isOptionSelected(option))
}

function dragonOptionDisabled(id: string): boolean {
  return transitioning.value || (activeStep.value.id === 'spirit' && dragonSelection.value.spiritIds.length >= 3 && !dragonSelection.value.spiritIds.includes(id))
}

function stepOptions(item: DragonStep | OpeningChoiceGroup): readonly string[] {
  if (!dragonFlow.value) return groupOptions(item as OpeningChoiceGroup)
  const id = (item as DragonStep).id
  if (id === 'profile') {
    if (!profile.value.coarseTier) return []
    const identity = profile.value.name.trim() || '未命名'
    return [`${identity} · ${profile.value.gender} · ${profile.value.age}岁 · ${profile.value.coarseTier} · ${profile.value.awakened ? '已觉醒' : '未觉醒'}`]
  }
  if (id === 'tier') return selectedDragonIdentity.value ? [selectedDragonIdentity.value.label] : []
  if (id === 'bloodline') return profile.value.awakened ? [dragonSelection.value.bloodlineRating, dragonSelection.value.bloodlineStability, dragonSelection.value.spiritCategory].filter(Boolean) : ['你还未觉醒，一切皆有可能']
  return profile.value.awakened ? selectedDragonSpirits.value.map((item) => item.label) : ['你还未觉醒，一切皆有可能']
}

function stepStatus(item: DragonStep | OpeningChoiceGroup, index: number): string {
  if (dragonFlow.value) {
    const id = (item as DragonStep).id
    if ((id === 'bloodline' || id === 'spirit') && !profile.value.awakened) return '未觉醒 · 跳过'
    if (isStepComplete(item)) return id === 'spirit' && selectedDragonSpirits.value.length ? `已录入 ${selectedDragonSpirits.value.length} 项` : '已录入'
    if (id === 'bloodline') return `${stepOptions(item).length} / 3 项`
    return index === activeGroup.value ? '审查中' : '待定'
  }
  const legacy = item as OpeningChoiceGroup
  const count = groupOptions(legacy).length
  if (isGroupComplete(legacy)) return legacy.selectionMode === 'multiple' && !isForcedSingleGroup(legacy) ? `已录入 ${count} 项` : '已录入'
  if (count) return `${count} / ${minimumSelections(legacy)} 项`
  return index === activeGroup.value ? '审查中' : '待定'
}

function emberStyle(index: number): Record<string, string> {
  return { '--ember-x': `${(index * 47 + 9) % 100}%`, '--ember-delay': `${-(index % 7) * .83}s`, '--ember-duration': `${5.8 + (index % 5) * .78}s`, '--ember-drift': `${((index * 31) % 90) - 45}px`, '--ember-size': `${2 + (index % 3)}px` }
}

function clearStampStyles(element: Element | null): void {
  if (!(element instanceof HTMLElement)) return
  gsap.killTweensOf(element)
  element.style.removeProperty('opacity')
  element.style.removeProperty('visibility')
  element.style.removeProperty('transform')
}

function animateSelectedStamp(): void {
  if (motion.reducedMotion.value) return
  motion.timeline(undefined, (timeline) => timeline.fromTo('.dr-opening__choices button.selected .dr-opening__stamp', { autoAlpha: 0, scale: 1.55, rotation: -16 }, { autoAlpha: 1, scale: 1, rotation: -7, duration: .24, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }))
}

function clearUnselectedStamps(previousStamps: readonly Element[]): void {
  for (const stamp of previousStamps) {
    const button = stamp.closest('button')
    if (button && !button.classList.contains('selected')) clearStampStyles(stamp)
  }
}

function animateSelectionAfterUpdate(previousStamps: readonly Element[], shouldAnimate: boolean): void {
  void nextTick().then(() => {
    clearUnselectedStamps(previousStamps)
    if (shouldAnimate) animateSelectedStamp()
  })
}

function animateEntry(): void {
  if (motion.reducedMotion.value || !root.value) return
  motion.timeline(undefined, (timeline) => {
    timeline
      .fromTo('.dr-opening__file', { autoAlpha: .28, scaleX: .975, scaleY: .94 }, { autoAlpha: 1, scaleX: 1, scaleY: 1, duration: .5, ease: 'expo.out' }, .04)
      .fromTo('.dr-opening__top', { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: .32, ease: 'power3.out' }, .14)
      .fromTo('.dr-opening__steps button', { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: .28, stagger: .035, ease: 'power2.out' }, .2)
      .fromTo('.dr-opening__prompt > *, .dr-opening__choices button, .dr-opening__profile-fields > *, .dr-opening__notice', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .34, stagger: .035, ease: 'power3.out' }, .27)
      .fromTo('.dr-opening__record > *', { autoAlpha: 0, x: 10 }, { autoAlpha: 1, x: 0, duration: .3, stagger: .04, ease: 'power2.out' }, .3)
  })
}

async function goToGroup(nextGroup: number): Promise<void> {
  if (transitioning.value || nextGroup === activeGroup.value || nextGroup < 0 || nextGroup >= steps.value.length) return
  const previousGroup = activeGroup.value
  transitioning.value = true
  const token = motion.nextGeneration()
  const node = content.value
  if (node && !motion.reducedMotion.value) {
    motion.timeline(undefined, (timeline) => timeline.to(node, { autoAlpha: 0, x: nextGroup > previousGroup ? -28 : 28, clipPath: nextGroup > previousGroup ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)', duration: .2, ease: 'power2.in' }))
    const left = await motion.delay(200, token)
    if (!left || !motion.isCurrent(token)) {
      transitioning.value = false
      return
    }
  }
  activeGroup.value = nextGroup
  await nextTick()
  if (!motion.isCurrent(token)) {
    transitioning.value = false
    return
  }
  if (node && !motion.reducedMotion.value) {
    motion.timeline(undefined, (timeline) => timeline
      .fromTo(node, { autoAlpha: 0, x: nextGroup > previousGroup ? 32 : -32, clipPath: nextGroup > previousGroup ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' }, { autoAlpha: 1, x: 0, clipPath: 'inset(0)', duration: .48, ease: 'expo.out' }, 0)
      .fromTo('.dr-opening__choices button, .dr-opening__profile-fields > *, .dr-opening__notice', { autoAlpha: 0, x: nextGroup > previousGroup ? 20 : -20 }, { autoAlpha: 1, x: 0, duration: .36, stagger: .045, ease: 'power2.out' }, .09))
  }
  transitioning.value = false
}

async function select(option: string): Promise<void> {
  if (transitioning.value) return
  const previousStamps = root.value ? [...root.value.querySelectorAll('.dr-opening__stamp')] : []
  if (multiple.value) {
    const current = [...selectedOptions.value]
    const next = current.includes(option) ? current.filter((item) => item !== option) : current.length < maximum.value ? [...current, option] : current
    selected.value = { ...selected.value, [group.value.id]: next }
    await nextTick()
    clearUnselectedStamps(previousStamps)
    if (!current.includes(option) && next.includes(option)) animateSelectedStamp()
    return
  }
  const wasSelected = selectedOptions.value.includes(option)
  selected.value = { ...selected.value, [group.value.id]: wasSelected ? [] : [option] }
  await nextTick()
  clearUnselectedStamps(previousStamps)
  if (!wasSelected) animateSelectedStamp()
}

function selectCoarseTier(value: OpeningCoarseTier): void {
  const previousStamps = root.value ? [...root.value.querySelectorAll('.dr-opening__stamp')] : []
  const wasSelected = profile.value.coarseTier === value
  profile.value.coarseTier = profile.value.coarseTier === value ? '' : value
  const identity = selectedDragonIdentity.value
  if (identity && (profile.value.coarseTier === '' || identity.tier !== profile.value.coarseTier)) dragonSelection.value.identityId = ''
  void nextTick().then(() => {
    clearUnselectedStamps(previousStamps)
    if (!wasSelected) animateSelectedStamp()
  })
}

function selectIdentity(id: string): void {
  if (transitioning.value) return
  const previousStamps = root.value ? [...root.value.querySelectorAll('.dr-opening__stamp')] : []
  const wasSelected = dragonSelection.value.identityId === id
  dragonSelection.value.identityId = wasSelected ? '' : id
  animateSelectionAfterUpdate(previousStamps, !wasSelected)
}

function selectSpiritCategory(value: OpeningSpiritCategory): void {
  if (transitioning.value) return
  const previousStamps = root.value ? [...root.value.querySelectorAll('.dr-opening__stamp')] : []
  const wasSelected = dragonSelection.value.spiritCategory === value
  dragonSelection.value.spiritCategory = wasSelected ? '' : value
  const allowed = new Set(OPENING_SPIRIT_OPTIONS.filter((item) => item.category === value).map((item) => item.id))
  dragonSelection.value.spiritIds = wasSelected ? [] : dragonSelection.value.spiritIds.filter((id) => allowed.has(id))
  animateSelectionAfterUpdate(previousStamps, !wasSelected)
}

function toggleSpirit(id: string): void {
  if (transitioning.value) return
  const previousStamps = root.value ? [...root.value.querySelectorAll('.dr-opening__stamp')] : []
  const current = dragonSelection.value.spiritIds
  const wasSelected = current.includes(id)
  dragonSelection.value.spiritIds = wasSelected ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current
  animateSelectionAfterUpdate(previousStamps, !wasSelected)
}

function selectGender(value: typeof OPENING_GENDER_OPTIONS[number]): void {
  if (transitioning.value || profile.value.gender === value) return
  profile.value.gender = value
}

function selectAwakened(value: boolean): void {
  if (transitioning.value || profile.value.awakened === value) return
  profile.value.awakened = value
}

async function continueGroup(): Promise<void> {
  if (transitioning.value || (!isStepComplete(activeStep.value) && !canSkipDragonStep(activeStep.value))) return
  if (canSkipDragonStep(activeStep.value)) {
    const id = (activeStep.value as DragonStep).id
    skippedDragonSteps.value = new Set([...skippedDragonSteps.value, id])
  }
  if (activeGroup.value < steps.value.length - 1) {
    await goToGroup(activeGroup.value + 1)
    return
  }
  await nextTick()
  root.value?.querySelector<HTMLButtonElement>('.dr-opening__record > footer > button')?.focus()
}

function dragonDraft(): string {
  const name = profile.value.name.trim() || '未命名角色'
  const identity = selectedDragonIdentity.value?.label || '待定身份'
  const awakening = profile.value.awakened ? '是' : '否'
  const bloodline = profile.value.awakened ? `血统评级：${dragonSelection.value.bloodlineRating}；稳定性：${dragonSelection.value.bloodlineStability}；言灵分类：${dragonSelection.value.spiritCategory}` : '血统评级：你还未觉醒，一切皆有可能；言灵：你还未觉醒，一切皆有可能'
  const spirits = profile.value.awakened ? (selectedDragonSpirits.value.length ? selectedDragonSpirits.value.map((item) => item.label).join('、') : '暂未选择') : '未觉醒，暂不选择'
  return `我的 Dragon Raja 开局档案：姓名：${name}；性别：${profile.value.gender}；年龄：${profile.value.age}岁；粗略阶层：${profile.value.coarseTier}；具体身份：${identity}；是否已觉醒：${awakening}；${bloodline}；言灵：${spirits}。请根据这份档案开始故事。`
}

function submit(): void {
  if (!complete.value || transitioning.value) return
  const draft = dragonFlow.value ? dragonDraft() : `我的 Dragon Raja 开局档案：${selections.value.map((item) => `${item.groupTitle}：${item.option}`).join('；')}。请根据这份档案开始故事。`
  const token = motion.nextGeneration()
  if (motion.reducedMotion.value) {
    emit('complete', draft)
    return
  }
  transitioning.value = true
  motion.timeline(undefined, (timeline) => timeline
    .to('.dr-opening__review', { xPercent: -7, autoAlpha: .18, clipPath: 'inset(0 100% 0 0)', duration: .48, ease: 'power3.inOut' }, 0)
    .to('.dr-opening__spine', { scaleY: 1.08, filter: 'brightness(1.7)', duration: .3, ease: 'power2.out' }, .05)
    .to('.dr-opening__record', { xPercent: -34, scale: 1.025, boxShadow: '0 32px 90px rgba(185,151,97,.2)', duration: .52, ease: 'expo.inOut' }, .08)
    .to('.dr-opening__archive-flash', { autoAlpha: 1, duration: .24, ease: 'power2.in' }, .3))
  void motion.delay(620, token).then((completed) => {
    if (!completed || !motion.isCurrent(token)) return
    transitioning.value = false
    emit('complete', draft)
  })
}

watch(() => profile.value.awakened, (awakened) => {
  skippedDragonSteps.value = new Set()
  if (awakened) return
  dragonSelection.value.bloodlineRating = ''
  dragonSelection.value.bloodlineStability = ''
  dragonSelection.value.spiritCategory = ''
  dragonSelection.value.spiritIds = []
})

onMounted(animateEntry)
onBeforeUnmount(() => motion.kill())
</script>

<template>
  <section ref="root" class="dr-opening" role="dialog" aria-modal="true" aria-label="开局档案">
    <div class="dr-opening__atmosphere" aria-hidden="true"><i class="dr-opening__ray dr-opening__ray--one" /><i class="dr-opening__ray dr-opening__ray--two" /><i class="dr-opening__ray dr-opening__ray--three" /><span v-for="index in 18" :key="index" class="dr-opening__ember" :style="emberStyle(index)" /></div>
    <div class="dr-opening__archive-flash" aria-hidden="true" />
    <header class="dr-opening__top">
      <div class="dr-opening__institution"><span class="dr-opening__crest"><img v-if="DRAGON_RAJA_MEDIA.cassellCrestUrl" :src="DRAGON_RAJA_MEDIA.cassellCrestUrl" alt="" /><b v-else aria-hidden="true">C</b></span><span><strong>卡塞尔学院</strong><small>CASSELL COLLEGE · ADMISSION AUTHORITY</small></span></div>
      <div class="dr-opening__session" aria-hidden="true"><span>SESSION</span><strong>CC-2009 / 01A</strong></div>
      <button type="button" class="dr-opening__skip" aria-label="暂不开局，直接进入故事" :disabled="transitioning" @click="emit('cancel')"><span>跳过建档</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
    </header>

    <div class="dr-opening__file">
      <nav class="dr-opening__steps" aria-label="开局步骤" :style="progressStyle"><i class="dr-opening__progress" aria-hidden="true" /><button v-for="(item, index) in steps" :key="item.id" type="button" :class="{ active: index === activeGroup, done: isStepComplete(item) }" :disabled="transitioning" :aria-current="index === activeGroup ? 'step' : undefined" @click="void goToGroup(index)"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ item.title }}</strong><small>{{ stepStatus(item, index) }}</small></button></nav>

      <main ref="content" class="dr-opening__review">
        <div class="dr-opening__folio" aria-hidden="true">{{ String(activeGroup + 1).padStart(2, '0') }}</div>
        <div class="dr-opening__prompt"><div class="dr-opening__counter"><span>{{ String(activeGroup + 1).padStart(2, '0') }}</span><i />{{ String(steps.length).padStart(2, '0') }}<small>ADMISSION REVIEW</small></div><p class="dr-opening__eyebrow">DR / {{ activeStep.id.toUpperCase() }} / CLASSIFIED</p><h1>{{ activeStep.title }}</h1><p class="dr-opening__instruction">{{ activeStep.instruction }}</p></div>

        <div v-if="dragonFlow" class="dr-opening__choice-panel" :class="{ 'dr-opening__choice-panel--dense': denseChoices }">
          <header class="dr-opening__choice-meta"><span>{{ activeStep.id === 'profile' ? '05 项身份字段' : activeStep.id === 'tier' ? `${availableIdentityOptions.length} 项候选身份` : activeStep.id === 'bloodline' ? '03 项血统判定' : `${availableSpiritOptions.length} 项分类言灵` }}</span><strong v-if="activeStep.id === 'spirit' && profile.awakened">最多选择 3 项 · {{ dragonSelection.spiritIds.length }} / 3</strong><strong v-else-if="activeStep.id === 'bloodline' && profile.awakened">评级 / 稳定性 / 分类</strong><strong v-else-if="activeStep.id === 'bloodline' || activeStep.id === 'spirit'">未觉醒分支</strong><strong v-else>单项判定</strong></header>

          <div v-if="activeStep.id === 'profile'" class="dr-opening__profile-fields">
            <label class="dr-opening__field dr-opening__field--name"><span>姓名 <small>NAME / OPTIONAL</small></span><input v-model="profile.name" type="text" maxlength="32" placeholder="输入角色姓名" /></label>
            <fieldset class="dr-opening__field"><legend>性别</legend><div class="dr-opening__segmented"><button v-for="gender in OPENING_GENDER_OPTIONS" :key="gender" type="button" :class="{ selected: profile.gender === gender }" :aria-pressed="profile.gender === gender" @click="selectGender(gender)">{{ gender }}</button></div></fieldset>
            <label class="dr-opening__field dr-opening__age"><span>年龄 <b>{{ profile.age }}</b><small>YEARS</small></span><input v-model.number="profile.age" type="range" min="6" max="100" step="1" aria-label="年龄" /><input v-model.number="profile.age" type="number" min="6" max="100" aria-label="年龄数值" /></label>
            <fieldset class="dr-opening__field"><legend>粗略阶层</legend><div class="dr-opening__choices dr-opening__choices--compact" role="group" aria-label="粗略阶层"><button v-for="tier in OPENING_COARSE_TIERS" :key="tier.value" type="button" :class="{ selected: profile.coarseTier === tier.value }" :aria-pressed="profile.coarseTier === tier.value" @click="selectCoarseTier(tier.value)"><small>{{ tier.value === '普通' ? '01' : tier.value === '中级' ? '02' : '03' }}</small><span><b>{{ tier.label }}</b><small>{{ tier.description }}</small></span><b class="dr-opening__stamp" style="--stamp-state: 0" aria-hidden="true">已录入</b><svg class="dr-opening__choice-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5" /></svg></button></div></fieldset>
            <fieldset class="dr-opening__field"><legend>是否已觉醒</legend><div class="dr-opening__segmented"><button type="button" :class="{ selected: !profile.awakened }" :aria-pressed="!profile.awakened" @click="selectAwakened(false)">否 · 尚未觉醒</button><button type="button" :class="{ selected: profile.awakened }" :aria-pressed="profile.awakened" @click="selectAwakened(true)">是 · 已觉醒</button></div></fieldset>
          </div>

          <div v-else-if="activeStep.id === 'tier'" class="dr-opening__choices dr-opening__choices--dense dr-opening__choices--identity" role="group" aria-label="具体身份"><button v-for="(option, index) in availableIdentityOptions" :key="option.id" type="button" :class="{ selected: dragonSelection.identityId === option.id }" :aria-pressed="dragonSelection.identityId === option.id" @click="selectIdentity(option.id)"><small>{{ String(index + 1).padStart(2, '0') }}</small><span><b>{{ option.label }}</b><small>{{ option.description }}</small></span><i class="dr-opening__choice-line" aria-hidden="true" /><b class="dr-opening__stamp" aria-hidden="true">已录入</b><svg class="dr-opening__choice-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5" /></svg></button></div>

          <div v-else-if="activeStep.id === 'bloodline'" class="dr-opening__bloodline-fields"><div v-if="!profile.awakened" class="dr-opening__notice"><span>AWAKENING STATUS</span><strong>你还未觉醒，一切皆有可能</strong><small>血统评级、稳定性与言灵分类将在故事中自然揭示。</small></div><template v-else><label class="dr-opening__range-field"><span>血统评级 <output>{{ dragonSelection.bloodlineRating || '未选择' }}</output><small>BLOODLINE RANK</small></span><input v-model.number="bloodlineRatingIndex" type="range" min="0" :max="OPENING_BLOODLINE_RATINGS.length - 1" step="1" aria-label="血统评级" /><div class="dr-opening__range-ticks" aria-hidden="true"><b v-for="rating in OPENING_BLOODLINE_RATINGS" :key="rating">{{ rating }}</b></div></label><label class="dr-opening__range-field"><span>血统稳定性 <output>{{ dragonSelection.bloodlineStability || '未选择' }}</output><small>STABILITY</small></span><input v-model.number="bloodlineStabilityIndex" type="range" min="0" :max="OPENING_BLOODLINE_STABILITIES.length - 1" step="1" aria-label="血统稳定性" /><div class="dr-opening__range-ticks" aria-hidden="true"><b v-for="stability in OPENING_BLOODLINE_STABILITIES" :key="stability">{{ stability }}</b></div></label><fieldset class="dr-opening__field"><legend>言灵分类</legend><div class="dr-opening__choices dr-opening__choices--compact" role="group" aria-label="言灵分类"><button v-for="(category, index) in OPENING_SPIRIT_CATEGORIES" :key="category" type="button" :class="{ selected: dragonSelection.spiritCategory === category }" :aria-pressed="dragonSelection.spiritCategory === category" @click="selectSpiritCategory(category)"><small>{{ String(index + 1).padStart(2, '0') }}</small><span><b>{{ category }}</b><small>{{ category === '未知' ? '尚未确认具体分支' : '下一页将显示此分类的言灵' }}</small></span><i class="dr-opening__choice-line" aria-hidden="true" /><b class="dr-opening__stamp" aria-hidden="true">已录入</b><svg class="dr-opening__choice-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5" /></svg></button></div></fieldset></template></div>

          <div v-else class="dr-opening__spirit-fields"><div v-if="!profile.awakened" class="dr-opening__notice"><span>AWAKENING STATUS</span><strong>你还未觉醒，一切皆有可能</strong><small>保持空白即可继续，言灵将在后续故事中被发现。</small></div><template v-else><div class="dr-opening__spirit-filter"><span>当前分类</span><strong>{{ dragonSelection.spiritCategory }}</strong><small>可选 {{ availableSpiritOptions.length }} 项 · 已选 {{ dragonSelection.spiritIds.length }} / 3</small></div><div class="dr-opening__choices dr-opening__choices--dense dr-opening__choices--multiple" role="group" aria-label="言灵选项"><button v-for="(option, index) in availableSpiritOptions" :key="option.id" type="button" :class="{ selected: dragonSelection.spiritIds.includes(option.id) }" :disabled="dragonOptionDisabled(option.id)" :aria-pressed="dragonSelection.spiritIds.includes(option.id)" @click="toggleSpirit(option.id)"><small>{{ String(index + 1).padStart(2, '0') }}</small><span><b>{{ option.label }}</b><small>{{ option.description }}</small></span><i class="dr-opening__choice-line" aria-hidden="true" /><b class="dr-opening__stamp" aria-hidden="true">已录入</b><svg class="dr-opening__choice-mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" /><path v-if="dragonSelection.spiritIds.includes(option.id)" d="m8 12.5 2.7 2.7L16.5 9" /></svg></button></div></template></div>

          <footer class="dr-opening__choice-footer"><span>{{ !isStepComplete(activeStep) ? (canSkipDragonStep(activeStep) ? '未觉醒 · 点击继续跳过本页' : activeStep.id === 'profile' ? '先确认粗略阶层' : activeStep.id === 'bloodline' ? '完成三项血统判定' : '请选择一个身份') : (activeStep.id === 'spirit' && profile.awakened ? `已选择 ${dragonSelection.spiritIds.length} 项` : '本页已完成') }}</span><button type="button" :disabled="(!isStepComplete(activeStep) && !canSkipDragonStep(activeStep)) || transitioning" @click="void continueGroup()">{{ activeGroup < steps.length - 1 ? '继续' : '完成本项' }}</button></footer>
        </div>

        <div v-else class="dr-opening__choice-panel" :class="{ 'dr-opening__choice-panel--dense': denseChoices }"><header class="dr-opening__choice-meta"><span>{{ String(currentChoices.length).padStart(2, '0') }} 项候选</span><strong v-if="multiple">多项判定 · {{ selectedOptions.length }} / {{ maximum }}</strong><strong v-else>单项判定</strong></header><div class="dr-opening__choices" :class="{ 'dr-opening__choices--dense': denseChoices, 'dr-opening__choices--extensive': extensiveChoices, 'dr-opening__choices--multiple': multiple }" role="group" :aria-label="`${group.title}选项`"><button v-for="(option, index) in currentChoices" :key="option" type="button" :class="{ selected: isOptionSelected(option) }" :disabled="optionDisabled(option)" :aria-pressed="isOptionSelected(option)" @click="void select(option)"><small>{{ String(index + 1).padStart(2, '0') }}</small><span><b>{{ optionLabel(option) }}</b><small v-if="optionDescription(option)">{{ optionDescription(option) }}</small></span><i class="dr-opening__choice-line" aria-hidden="true" /><b class="dr-opening__stamp" aria-hidden="true">已录入</b><svg v-if="multiple" class="dr-opening__choice-mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" /><path v-if="isOptionSelected(option)" d="m8 12.5 2.7 2.7L16.5 9" /></svg><svg v-else class="dr-opening__choice-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5" /></svg></button></div><footer class="dr-opening__choice-footer"><span>{{ selectedOptions.length < minimum ? `至少选择 ${minimum} 项` : `已选择 ${selectedOptions.length} 项` }}</span><button type="button" :disabled="!isStepComplete(activeStep) || transitioning" @click="void continueGroup()">{{ activeGroup < steps.length - 1 ? '继续' : '完成本项' }}</button></footer></div>
      </main>

      <i class="dr-opening__spine" aria-hidden="true"><span>DRAGON RAJA · ADMISSION DOSSIER · 2009</span></i>
      <aside class="dr-opening__record"><header><span class="dr-opening__record-crest"><img v-if="DRAGON_RAJA_MEDIA.cassellCrestUrl" :src="DRAGON_RAJA_MEDIA.cassellCrestUrl" alt="" /><b v-else aria-hidden="true">C</b></span><span><small>卡塞尔学院入学登记</small><h2>新生档案</h2><em>ADMISSION RECORD / 01A</em></span></header><div class="dr-opening__record-progress" :style="progressStyle"><span><b>{{ completedGroups }}</b> / {{ steps.length }}</span><i><b /></i><small>{{ complete ? '档案完整，等待封存' : '正在写入身份判定' }}</small></div><ol><li v-for="(item, index) in steps" :key="item.id" :class="{ filled: isStepComplete(item) }"><span>{{ String(index + 1).padStart(2, '0') }}</span><p><small>{{ item.title }}</small><strong :title="stepOptions(item).join('、')">{{ stepOptions(item).join('、') || '尚未判定' }}</strong></p><svg v-if="isStepComplete(item)" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg><i v-else aria-hidden="true" /></li></ol><footer><p><span>REGISTRAR</span><b>{{ complete ? 'AUTHORIZED' : `${remaining} FIELD${remaining === 1 ? '' : 'S'} PENDING` }}</b></p><button type="button" :disabled="!complete || transitioning" @click="submit"><span><small>{{ complete ? '封存档案' : `还需完成 ${remaining} 项` }}</small><strong>{{ complete ? '进入叙事' : '等待审查' }}</strong></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11" /></svg></button></footer></aside>
    </div>
  </section>
</template>
