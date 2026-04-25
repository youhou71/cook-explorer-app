<!--
  Chip représentant une recette placée dans le calendrier.
  Draggable, avec contrôles de portions (±) et bouton de suppression.
-->
<template>
  <div
    class="recipe-chip"
    :class="{
      'recipe-chip--compact': compact,
      'recipe-chip--spanned': entry.span > 1,
      'recipe-chip--dragging': isDragging
    }"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="recipe-chip__body">
      <span
        ref="titleRef"
        class="recipe-chip__title"
        :class="{ 'recipe-chip__title--truncated': isTruncated }"
        @mouseenter="showTooltip"
        @mouseleave="hideTooltip"
      >{{ title }}</span>
      <Teleport to="body">
        <div
          v-if="tooltipVisible && isTruncated"
          class="recipe-chip-tooltip"
          :style="tooltipStyle"
        >
          {{ title }}
          <div class="recipe-chip-tooltip__arrow" :style="arrowStyle" />
        </div>
      </Teleport>
      <span v-if="entry.span > 1" class="recipe-chip__span-badge">{{ entry.span }}j</span>
      <div v-if="!compact" class="recipe-chip__controls">
        <button class="recipe-chip__btn" @click.stop="decrease" title="Réduire les portions">−</button>
        <span class="recipe-chip__portions">{{ entry.totalPortions }}p</span>
        <button class="recipe-chip__btn" @click.stop="increase" title="Augmenter les portions">+</button>
      </div>
    </div>
    <button v-if="!compact" class="recipe-chip__remove" @click.stop="$emit('remove')" title="Retirer">×</button>
    <div
      v-if="!compact"
      class="recipe-chip__resize-handle"
      @mousedown.stop.prevent="$emit('resize-start', $event)"
      title="Glisser pour étendre"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { CalendarRecipeEntry } from '@/types'
import { useRecipesStore } from '@/stores/recipes'
import { useCooklang } from '@/composables/useCooklang'

const props = defineProps<{
  entry: CalendarRecipeEntry
  compact?: boolean
}>()

const emit = defineEmits<{
  remove: []
  'update-portions': [portions: number]
  'drag-start': [e: DragEvent]
  'drag-end': []
  'resize-start': [e: MouseEvent]
}>()

const recipesStore = useRecipesStore()
const { getTitle } = useCooklang()

const isDragging = ref(false)
const titleRef = ref<HTMLElement | null>(null)
const isTruncated = ref(false)
const tooltipVisible = ref(false)
const tooltipStyle = ref<Record<string, string>>({})
const arrowStyle = ref<Record<string, string>>({})

function checkTruncation() {
  if (titleRef.value) {
    isTruncated.value = titleRef.value.scrollWidth > titleRef.value.clientWidth
  }
}

function showTooltip() {
  if (!isTruncated.value || !titleRef.value) return
  const rect = titleRef.value.getBoundingClientRect()
  const tooltipX = rect.left + rect.width / 2
  const tooltipY = rect.top - 8
  tooltipStyle.value = {
    position: 'fixed',
    left: `${tooltipX}px`,
    top: `${tooltipY}px`,
    transform: 'translate(-50%, -100%)',
    zIndex: '9999'
  }
  arrowStyle.value = {
    left: '50%',
    transform: 'translateX(-50%)'
  }
  tooltipVisible.value = true
}

function hideTooltip() {
  tooltipVisible.value = false
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  checkTruncation()
  if (titleRef.value) {
    resizeObserver = new ResizeObserver(checkTruncation)
    resizeObserver.observe(titleRef.value)
  }
})
onBeforeUnmount(() => resizeObserver?.disconnect())

const title = computed(() => {
  const recipe = recipesStore.getByPath(props.entry.recipePath)
  if (recipe?.parsed) return getTitle(recipe.parsed, recipe.name)
  return recipe?.name.replace('.cook', '') ?? props.entry.recipePath.split('/').pop()?.replace('.cook', '') ?? '?'
})

function onDragStart(e: DragEvent) {
  isDragging.value = true
  emit('drag-start', e)
}

function onDragEnd() {
  isDragging.value = false
  emit('drag-end')
}

function increase() {
  emit('update-portions', props.entry.totalPortions + 1)
}

function decrease() {
  if (props.entry.totalPortions > 1) {
    emit('update-portions', props.entry.totalPortions - 1)
  }
}
</script>

<style scoped>
.recipe-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  cursor: grab;
  transition: box-shadow var(--transition-fast), opacity var(--transition-fast);
  position: relative;
}

.recipe-chip:hover {
  box-shadow: var(--shadow-sm);
}

.recipe-chip--dragging {
  opacity: 0.4;
}

.recipe-chip--spanned {
  background: linear-gradient(90deg, var(--color-surface) 0%, var(--color-accent-light) 100%);
  border-color: var(--color-accent);
}

.recipe-chip--compact {
  padding: 2px 6px;
  font-size: 0.65rem;
  border-radius: 4px;
}

.recipe-chip--compact .recipe-chip__title {
  max-width: 80px;
}

.recipe-chip__body {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.recipe-chip__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
  font-weight: 500;
  position: relative;
}

.recipe-chip__title--truncated {
  cursor: default;
}

.recipe-chip__span-badge {
  flex-shrink: 0;
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-accent-light);
  padding: 1px 4px;
  border-radius: 4px;
}

.recipe-chip__controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
}

.recipe-chip__btn {
  width: 18px;
  height: 18px;
  border: none;
  background: var(--color-surface-alt);
  border-radius: 50%;
  font-size: 0.7rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  transition: background var(--transition-fast);
}

.recipe-chip__btn:hover {
  background: var(--color-border);
}

.recipe-chip__portions {
  font-size: 0.65rem;
  color: var(--color-muted);
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

.recipe-chip__remove {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: none;
  background: none;
  color: var(--color-muted);
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.recipe-chip__remove:hover {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.recipe-chip__resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.recipe-chip__resize-handle:hover {
  background: var(--color-accent-light);
}
</style>

<style>
.recipe-chip-tooltip {
  background: var(--color-text, #1a1a1a);
  color: var(--color-bg, #fff);
  padding: 6px 10px;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,.15));
  animation: recipe-tooltip-in 0.15s ease-out;
}

.recipe-chip-tooltip__arrow {
  position: absolute;
  bottom: -6px;
  width: 0;
  height: 0;
  border: 6px solid transparent;
  border-bottom: none;
  border-top-color: var(--color-text, #1a1a1a);
}

@keyframes recipe-tooltip-in {
  from { opacity: 0; transform: translate(-50%, calc(-100% + 4px)); }
  to   { opacity: 1; transform: translate(-50%, -100%); }
}
</style>
