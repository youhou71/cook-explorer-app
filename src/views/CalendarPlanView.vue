<!--
  Vue principale du calendrier de planification de repas.
  Assemble la toolbar, la grille semaine, et la sidebar de recettes.
  Gère le drag & drop et le redimensionnement des entrées multi-jours.
-->
<template>
  <div class="calendar-plan">
    <CalendarToolbar @open-shopping="showShopping = true" />

    <div class="calendar-plan__grid">
      <LoadingState v-if="recipesStore.loading" :loading="true" />

      <CalendarWeekGrid
        v-else
        :dates="store.visibleDates"
        :dnd="dnd"
        :get-allocation-fn="getAllocation"
        @resize-start="onResizeStart"
      />
    </div>

    <CalendarRecipeSidebar
      :on-drag-start-fn="dnd.startDragFromSidebar"
      :on-touch-select-fn="dnd.startTouchPlacement"
    />

    <CalendarShoppingList :visible="showShopping" :meals="allMeals" @close="showShopping = false" />

    <!-- Indicateur de mode placement tactile -->
    <Transition name="fade">
      <div v-if="dnd.touchPlacement.value" class="calendar-plan__touch-banner" @click="dnd.cancelTouchPlacement()">
        Touchez un groupe pour placer la recette • <strong>Annuler</strong>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { MealTimeSlot, MealGroupId, CalendarMeal, CalendarRecipeEntry } from '@/types'
import { useCalendarPlanStore } from '@/stores/calendarPlan'
import { useRecipesStore } from '@/stores/recipes'
import { useCalendarDnD } from '@/composables/useCalendarDnD'
import { usePortionAllocation } from '@/composables/usePortionAllocation'
import { toISODate } from '@/composables/useCalendarDates'
import { useGitHub } from '@/composables/useGitHub'
import { useCooklang } from '@/composables/useCooklang'
import CalendarToolbar from '@/components/calendar/CalendarToolbar.vue'
import CalendarWeekGrid from '@/components/calendar/CalendarWeekGrid.vue'
import CalendarRecipeSidebar from '@/components/calendar/CalendarRecipeSidebar.vue'
import CalendarShoppingList from '@/components/calendar/CalendarShoppingList.vue'
import LoadingState from '@/components/LoadingState.vue'

const store = useCalendarPlanStore()
const recipesStore = useRecipesStore()
const dnd = useCalendarDnD(store)
const { fetchRecipeList, fetchRecipeContent } = useGitHub()
const { parseRecipe } = useCooklang()
const showShopping = ref(false)

onMounted(async () => {
  if (!recipesStore.hydrated) {
    await recipesStore.hydrate()
  }

  if (recipesStore.recipes.length === 0) {
    try {
      const list = await fetchRecipeList()
      recipesStore.setRecipes(list)
    } catch { /* silencieux */ }
  }

  const unparsed = recipesStore.recipes.filter(r => !r.parsed)
  for (const r of unparsed) {
    fetchRecipeContent(r.path).then(({ content, sha }) => {
      const parsed = parseRecipe(content)
      recipesStore.upsertRecipe({ name: r.name, path: r.path, sha, content, parsed })
    }).catch(() => {})
  }
})

// ── Allocation des portions ─────────────────────────────────────────────

const allMeals = computed<CalendarMeal[]>(() => {
  const meals: CalendarMeal[] = []
  for (const plan of store.plans.values()) {
    meals.push(...plan.meals)
  }
  return meals
})

const dateRange = computed(() =>
  store.visibleDates.map(d => toISODate(d)).sort()
)

const targetPortions = computed(() => store.targetPortions)

const { getAllocation } = usePortionAllocation(allMeals, targetPortions, dateRange)

// ── Resize multi-jours ──────────────────────────────────────────────────

const resizing = ref<{ entryId: string, startX: number, startSpan: number, lastSpan: number } | null>(null)

function onResizeStart(e: MouseEvent, entry: CalendarRecipeEntry) {
  resizing.value = {
    entryId: entry.id,
    startX: e.clientX,
    startSpan: entry.span,
    lastSpan: entry.span
  }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e: MouseEvent) {
  if (!resizing.value) return
  const gridCells = document.querySelectorAll('.week-grid__cell, .day-cell')
  if (gridCells.length === 0) return
  const cellWidth = gridCells[0].getBoundingClientRect().width
  const delta = Math.round((e.clientX - resizing.value.startX) / cellWidth)
  const newSpan = Math.max(1, resizing.value.startSpan + delta)
  if (newSpan !== resizing.value.lastSpan) {
    resizing.value.lastSpan = newSpan
    store.updateSpan(resizing.value.entryId, newSpan)
  }
}

function onResizeEnd() {
  resizing.value = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})
</script>

<style scoped>
.calendar-plan {
  max-width: none;
  margin-right: 276px;
}

.calendar-plan__grid {
  min-width: 0;
}

.calendar-plan__touch-banner {
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-accent);
  color: white;
  padding: 0.6rem 1.2rem;
  border-radius: 99px;
  font-size: 0.8rem;
  cursor: pointer;
  z-index: 30;
  box-shadow: var(--shadow-lg);
  white-space: nowrap;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-med);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .calendar-plan {
    margin-right: 0;
  }
  .calendar-plan__grid {
    width: 100%;
    padding-bottom: 60px;
  }
}
</style>
