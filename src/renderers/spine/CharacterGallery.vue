<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { SpineCatalogEntry } from './spineTypes'
import { formatMegabytes } from './formatBytes'
const props = withDefaults(defineProps<{ entries: SpineCatalogEntry[]; title?: string; subtitle?: string; showBack?: boolean }>(), {
  title: 'NIKKE 角色档案', subtitle: '角色档案', showBack: false,
})
const emit = defineEmits<{ select: [entry: SpineCatalogEntry]; back: [] }>()
const query = ref(''), category = ref('all'), runtime = ref('all'), page = ref(1)
const section = ref<HTMLElement | null>(null)
const brokenImages = ref(new Set<string>())
const pageSize = 36
const filtered = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return props.entries.filter(entry => {
    const variants = entry.variants ?? [{ asset: entry.asset }]
    return (category.value === 'all' || entry.category === category.value)
      && (runtime.value === 'all' || variants.some(row => row.asset.runtimeVersion === runtime.value))
      && (!term || `${entry.name} ${entry.id}`.toLocaleLowerCase().includes(term))
  })
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([query, category, runtime], () => { page.value = 1 })
watch(page, () => { section.value?.scrollTo({ top: 0 }) })
</script>

<template>
  <section ref="section" class="character-gallery" aria-labelledby="character-gallery-title">
    <header class="character-gallery__header">
      <div class="character-gallery__identity">
        <button v-if="showBack" type="button" class="gallery-back" title="返回游戏选择" aria-label="返回游戏选择" @click="emit('back')"><ArrowLeft :size="18" /></button>
        <div><h1 id="character-gallery-title">{{ title }}</h1>
        <p><span aria-hidden="true"></span>{{ subtitle }} · {{ entries.length }} 份档案 · {{ entries.reduce((sum, row) => sum + (row.variants?.length ?? 1), 0) }} 个模型</p></div>
      </div>
      <label class="character-gallery__search"><span>筛选角色</span>
        <input v-model="query" type="search" autocomplete="off" placeholder="姓名或角色 ID" aria-label="筛选角色">
      </label>
    </header>
    <div class="gallery-filters">
      <label>类别<select v-model="category" aria-label="类别"><option value="all">全部档案</option><option value="character">角色与服装</option><option value="other">场景与其他</option></select></label>
      <label>运行时<select v-model="runtime" aria-label="运行时"><option value="all">全部版本</option><option value="4.0">Spine 4.0</option><option value="4.1">Spine 4.1</option></select></label>
      <span role="status">{{ filtered.length }} 份结果</span>
    </div>
    <div v-if="visible.length" class="character-gallery__grid">
      <button v-for="entry in visible" :key="entry.id" class="character-card" type="button"
        :aria-label="`选择${entry.name}，${entry.id}，模型${formatMegabytes(entry.estimatedBytes)}`" @click="emit('select', entry)">
        <span class="character-card__media">
          <img v-if="entry.thumbnail && !brokenImages.has(entry.id)" :src="entry.thumbnail" :alt="entry.name" loading="lazy" decoding="async" @error="brokenImages.add(entry.id)">
          <span v-else class="character-card__placeholder"><strong>{{ entry.id.toUpperCase() }}</strong><small>暂无预览图</small></span>
          <span class="character-card__scanline" aria-hidden="true"></span>
          <span class="character-card__index">{{ entry.variants?.length ?? 1 }} 个版本</span>
        </span>
        <span class="character-card__caption">
          <span><strong>{{ entry.name }}</strong><small>{{ entry.id.toUpperCase() }}</small></span>
          <span class="character-card__size">{{ formatMegabytes(entry.estimatedBytes) }}</span>
        </span>
      </button>
    </div>
    <div v-else class="character-gallery__empty" role="status"><strong>未找到匹配档案</strong></div>
    <nav class="gallery-pagination" aria-label="图鉴分页">
      <button type="button" class="icon-button" :disabled="page === 1" title="上一页" aria-label="上一页" @click="page--"><ChevronLeft :size="20" /></button>
      <label>页码<select v-model.number="page" aria-label="页码"><option v-for="number in pages" :key="number" :value="number">{{ number }} / {{ pages }}</option></select></label>
      <button type="button" class="icon-button" :disabled="page === pages" title="下一页" aria-label="下一页" @click="page++"><ChevronRight :size="20" /></button>
    </nav>
  </section>
</template>
