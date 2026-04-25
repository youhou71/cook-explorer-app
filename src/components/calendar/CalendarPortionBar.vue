<!--
  Barre visuelle indiquant le remplissage des portions pour un groupe.
  Couleur verte si objectif atteint, orange si partiel, gris si vide.
-->
<template>
  <div class="portion-bar" :title="`${filled}/${target} portions`">
    <div
      class="portion-bar__fill"
      :class="fillClass"
      :style="{ width: fillPercent + '%' }"
    />
    <span class="portion-bar__label">{{ filled }}/{{ target }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  filled: number
  target: number
}>()

const fillPercent = computed(() =>
  props.target > 0 ? Math.min(100, (props.filled / props.target) * 100) : 0
)

const fillClass = computed(() => {
  if (props.filled >= props.target) return 'portion-bar__fill--full'
  if (props.filled > 0) return 'portion-bar__fill--partial'
  return 'portion-bar__fill--empty'
})
</script>

<style scoped>
.portion-bar {
  position: relative;
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}

.portion-bar__fill {
  height: 100%;
  border-radius: 3px;
  transition: width var(--transition-med);
}

.portion-bar__fill--full {
  background: var(--color-sage);
}

.portion-bar__fill--partial {
  background: var(--color-warm);
}

.portion-bar__fill--empty {
  background: transparent;
}

.portion-bar__label {
  position: absolute;
  top: -16px;
  right: 0;
  font-size: 0.65rem;
  color: var(--color-muted);
  font-weight: 500;
}
</style>
