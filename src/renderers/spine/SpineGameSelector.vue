<script setup lang="ts">
import { Gamepad2, Sparkles } from 'lucide-vue-next'
import type { SpineCatalogEntry } from './spineTypes'

defineProps<{ catalogs: Record<string, SpineCatalogEntry[]> }>()
const emit = defineEmits<{ select: [gameId: string] }>()
const games = [
  { id: 'nikke', name: 'NIKKE', detail: '胜利女神 · Spine 角色档案', icon: Gamepad2 },
  { id: 'brown-dust-2', name: '棕色尘埃 2', detail: 'Brown Dust 2 · Spine 资源库', icon: Sparkles },
]
</script>

<template>
  <section class="spine-game-selector" aria-labelledby="spine-game-selector-title">
    <div class="spine-game-selector__eyebrow">SPINE ARCHIVE / SELECT TITLE</div>
    <h1 id="spine-game-selector-title">选择游戏</h1>
    <p>进入对应的模型展示图鉴。只有打开具体模型后才会下载资源。</p>
    <div class="spine-game-selector__grid">
      <button v-for="game in games" :key="game.id" type="button" class="spine-game-card"
        :disabled="!catalogs[game.id]?.length" @click="emit('select', game.id)">
        <span class="spine-game-card__icon"><component :is="game.icon" :size="28" /></span>
        <span class="spine-game-card__body"><strong>{{ game.name }}</strong><small>{{ game.detail }}</small><em>{{ catalogs[game.id]?.length ?? 0 }} 份档案</em></span>
        <span class="spine-game-card__arrow" aria-hidden="true">→</span>
      </button>
    </div>
  </section>
</template>
