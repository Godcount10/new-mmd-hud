<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import type { HudFeatureContext } from '../../features/types'
import CharacterGallery from './CharacterGallery.vue'
import ModelDownloadDialog from './ModelDownloadDialog.vue'
import SpineViewport from './SpineViewport.vue'
import type { SpineCatalogEntry, SpineVariant } from './spineTypes'
import { localNikkeSpineConfig } from './nikkeAssets'

const props = defineProps<{ context: HudFeatureContext }>()
const fallback = props.context.window.__MMD_SPINE_ASSET__
  ?? props.context.window.__MMD_DEFAULT_SPINE_ASSET__ ?? localNikkeSpineConfig
const catalog: SpineCatalogEntry[] = props.context.window.__MMD_SPINE_CATALOG__?.length
  ? props.context.window.__MMD_SPINE_CATALOG__
  : [{ id: fallback.id, name: fallback.label, estimatedBytes: 0, asset: fallback }]
const selectedEntry = ref<SpineCatalogEntry | null>(null)
const selectedVariant = ref<SpineVariant | null>(null)
const pendingEntry = ref<SpineCatalogEntry | null>(null)
const pendingVariant = ref<string>()
const backButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
let galleryFocus: HTMLElement | null = null

function requestModel(entry: SpineCatalogEntry, variantId?: string): void {
  previousFocus = props.context.document.activeElement as HTMLElement | null
  if (!selectedEntry.value) galleryFocus = previousFocus
  pendingVariant.value = variantId
  pendingEntry.value = entry
}
function closeDialog(): void {
  pendingEntry.value = null
  void nextTick(() => previousFocus?.focus())
}
function confirmModel(variant: SpineVariant): void {
  selectedEntry.value = pendingEntry.value
  selectedVariant.value = variant
  pendingEntry.value = null
  void nextTick(() => backButton.value?.focus())
}
function returnToGallery(): void {
  selectedEntry.value = null
  selectedVariant.value = null
  void nextTick(() => galleryFocus?.focus())
}
function changeVariant(event: Event): void {
  const select = event.target as HTMLSelectElement
  requestModel(selectedEntry.value!, select.value)
  select.value = selectedVariant.value!.id
}
</script>

<template>
  <main class="spine-stage" data-hud="spine-stage" aria-label="NIKKE 模型图鉴">
    <div v-if="selectedEntry && selectedVariant" class="model-stage" :inert="Boolean(pendingEntry)">
      <header class="model-stage__toolbar">
        <button ref="backButton" type="button" class="icon-button" title="返回图鉴" aria-label="返回图鉴" @click="returnToGallery"><ArrowLeft :size="20" /></button>
        <div class="model-stage__identity">
          <strong>{{ selectedEntry.name }}</strong>
          <span>{{ selectedEntry.id.toUpperCase() }} · SPINE {{ selectedVariant.asset.runtimeVersion ?? '4.0' }}</span>
        </div>
        <label class="model-stage__variant">模型版本
          <select :value="selectedVariant.id" aria-label="模型版本" @change="changeVariant">
            <option v-for="variant in selectedEntry.variants ?? [selectedVariant]" :key="variant.id" :value="variant.id">{{ variant.label }}</option>
          </select>
        </label>
      </header>
      <SpineViewport :key="selectedVariant.id" :config="selectedVariant.asset"
        :host-document="props.context.document" :host-window="props.context.window" />
    </div>
    <CharacterGallery v-show="!selectedEntry" :entries="catalog" :inert="Boolean(pendingEntry)"
      :aria-hidden="Boolean(pendingEntry || selectedEntry)" @select="requestModel" />
    <ModelDownloadDialog v-if="pendingEntry" :entry="pendingEntry" :initial-variant-id="pendingVariant"
      :host-document="props.context.document" @cancel="closeDialog" @confirm="confirmModel" />
  </main>
</template>
