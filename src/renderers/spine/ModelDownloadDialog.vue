<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { SpineCatalogEntry, SpineVariant } from './spineTypes'
import { formatMegabytes } from './formatBytes'

const props = defineProps<{
  entry: SpineCatalogEntry
  hostDocument: Document
  initialVariantId?: string
}>()

const emit = defineEmits<{
  cancel: []
  confirm: [variant: SpineVariant]
}>()

const dialog = ref<HTMLElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
const variants = props.entry.variants ?? [{ id: props.entry.asset.id, label: props.entry.asset.label, asset: props.entry.asset, estimatedBytes: props.entry.estimatedBytes }]
const variantId = ref(props.initialVariantId ?? variants[0].id)
const selected = computed(() => variants.find(row => row.id === variantId.value) ?? variants[0])

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return

  const focusable = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled])'))
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && props.hostDocument.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && props.hostDocument.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  props.hostDocument.addEventListener('keydown', onKeydown)
  confirmButton.value?.focus()
})

onBeforeUnmount(() => {
  props.hostDocument.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="model-dialog-backdrop" @click.self="emit('cancel')">
    <section
      ref="dialog"
      class="model-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-dialog-title"
      aria-describedby="model-dialog-detail"
    >
      <div class="model-dialog__signal" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="model-dialog__content">
        <p class="model-dialog__code">DATA TRANSFER REQUEST // {{ props.entry.id.toUpperCase() }}</p>
        <h2 id="model-dialog-title">载入 {{ props.entry.name }}？</h2>
        <label class="model-dialog__variant">模型版本
          <select v-model="variantId" aria-label="待加载模型版本"><option v-for="variant in variants" :key="variant.id" :value="variant.id">{{ variant.label }}</option></select>
        </label>
        <p id="model-dialog-detail" class="model-dialog__detail">
          首次加载需要下载角色骨骼、图集与纹理资源。
        </p>
        <div class="model-dialog__meter">
          <span>预计本次流量</span>
          <strong>{{ formatMegabytes(selected.estimatedBytes) }}</strong>
        </div>
        <p class="model-dialog__note">Spine {{ selected.asset.runtimeVersion ?? '4.0' }} · 仅下载所选版本。移动网络下请留意流量；实际传输量受缓存和压缩影响，运行时内存占用可能更高。</p>
      </div>
      <div class="model-dialog__actions">
        <button type="button" class="model-dialog__cancel" @click="emit('cancel')">取消</button>
        <button ref="confirmButton" type="button" class="model-dialog__confirm" @click="emit('confirm', selected)">继续加载</button>
      </div>
    </section>
  </div>
</template>
