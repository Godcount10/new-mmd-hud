<script setup lang="ts">
import DragonRajaHud from '../../hud/themes/dragon-raja/DragonRajaHud.vue'
import type { HudContext } from '../../hud/context'
import { provideDragonRajaContext } from './dragonRajaContext'

const props = defineProps<{ hudContext: HudContext }>()
provideDragonRajaContext(props.hudContext)
</script>

<template>
  <DragonRajaHud />
</template>
