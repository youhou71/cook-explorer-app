<!--
  Panneau latéral avec la liste des recettes disponibles, groupées par catégorie.
  Les recettes sont draggables vers le calendrier. Sur mobile, le panneau
  se transforme en tiroir rétractable en bas de l'écran.
-->
<template>
  <aside class="cal-sidebar" :class="{ 'cal-sidebar--open': isOpen }">
    <div class="cal-sidebar__handle" @click="isOpen = !isOpen">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline :points="isOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/></svg>
      <span>Recettes</span>
    </div>
    <div class="cal-sidebar__content">
      <div v-if="isLoading" class="cal-sidebar__loading">
        <div class="cal-sidebar__spinner" />
        Chargement…
      </div>
      <template v-else>
        <input
          v-model="search"
          class="cal-sidebar__search"
          type="text"
          placeholder="Rechercher…"
        />
        <div v-for="cat in filteredCategories" :key="cat.folder" class="cal-sidebar__group">
          <div class="cal-sidebar__group-header" :style="{ color: cat.color }">
            {{ cat.icon }} {{ cat.name }}
          </div>
          <div
            v-for="recipe in cat.recipes"
            :key="recipe.path"
            class="cal-sidebar__item"
            draggable="true"
            @dragstart="onDragStart($event, recipe.path)"
            @click="onTouchSelect(recipe.path)"
          >
            <span class="cal-sidebar__item-title">{{ recipe.title }}</span>
            <span v-if="recipe.servings" class="cal-sidebar__item-meta">{{ recipe.servings }}p</span>
          </div>
        </div>
        <div v-if="filteredCategories.length === 0" class="cal-sidebar__empty">
          Aucune recette trouvée
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRecipesStore } from '@/stores/recipes'
import { useCooklang } from '@/composables/useCooklang'
import { getCategory } from '@/utils/categories'

const props = defineProps<{
  onDragStartFn: (e: DragEvent, recipePath: string) => void
  onTouchSelectFn?: (recipePath: string) => void
}>()

const recipesStore = useRecipesStore()
const { getTitle, getBaseServings } = useCooklang()

const search = ref('')
const isOpen = ref(false)

const isLoading = computed(() => {
  if (!recipesStore.hydrated) return true
  const { recipes } = recipesStore
  return recipes.length > 0 && !recipes.some(r => r.parsed)
})

interface SidebarRecipe {
  path: string
  title: string
  servings: number | null
  folder: string
}

const allRecipes = computed<SidebarRecipe[]>(() => {
  return recipesStore.recipes
    .filter(r => r.parsed)
    .map(r => ({
      path: r.path,
      title: getTitle(r.parsed!, r.name),
      servings: getBaseServings(r.parsed!),
      folder: getCategory(r.path)
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
})

interface SidebarCategory {
  folder: string
  name: string
  color: string
  icon: string
  recipes: SidebarRecipe[]
}

const filteredCategories = computed<SidebarCategory[]>(() => {
  const q = search.value.toLowerCase().trim()
  const recipes = q
    ? allRecipes.value.filter(r => r.title.toLowerCase().includes(q))
    : allRecipes.value

  const catMap = new Map<string, SidebarCategory>()
  for (const r of recipes) {
    if (!catMap.has(r.folder)) {
      const settings = recipesStore.getCategorySettings(r.folder)
      catMap.set(r.folder, {
        folder: r.folder,
        name: settings.name,
        color: settings.color,
        icon: settings.icon,
        recipes: []
      })
    }
    catMap.get(r.folder)!.recipes.push(r)
  }

  return Array.from(catMap.values()).sort((a, b) => {
    const sa = recipesStore.getCategorySettings(a.folder)
    const sb = recipesStore.getCategorySettings(b.folder)
    return sa.order - sb.order
  })
})

function onDragStart(e: DragEvent, recipePath: string) {
  props.onDragStartFn(e, recipePath)
}

function onTouchSelect(recipePath: string) {
  if (props.onTouchSelectFn) {
    props.onTouchSelectFn(recipePath)
  }
}
</script>

<style scoped>
.cal-sidebar {
  position: fixed;
  right: 0;
  top: 59px;
  width: 260px;
  height: calc(100vh - 59px);
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 9;
}

.cal-sidebar__handle {
  display: none;
}

.cal-sidebar__content {
  overflow-y: auto;
  padding: 0.75rem;
  flex: 1;
}

.cal-sidebar__search {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  background: var(--color-bg);
  color: var(--color-text);
  margin-bottom: 0.75rem;
  outline: none;
  transition: border-color var(--transition-fast);
}

.cal-sidebar__search:focus {
  border-color: var(--color-accent);
}

.cal-sidebar__group {
  margin-bottom: 0.5rem;
}

.cal-sidebar__group-header {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.35rem 0.25rem;
}

.cal-sidebar__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.5rem;
  border-radius: var(--radius-sm);
  cursor: grab;
  transition: background var(--transition-fast);
  gap: 0.5rem;
}

.cal-sidebar__item:hover {
  background: var(--color-surface-alt);
}

.cal-sidebar__item-title {
  font-size: 0.78rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-sidebar__item-meta {
  font-size: 0.65rem;
  color: var(--color-muted);
  flex-shrink: 0;
}

.cal-sidebar__empty {
  text-align: center;
  color: var(--color-muted);
  font-size: 0.8rem;
  padding: 2rem 0;
}

.cal-sidebar__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 0;
  color: var(--color-muted);
  font-size: 0.8rem;
}

.cal-sidebar__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: sidebar-spin 0.6s linear infinite;
}

@keyframes sidebar-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .cal-sidebar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-height: 50vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    transform: translateY(calc(100% - 44px));
    transition: transform var(--transition-med);
    z-index: 20;
    box-shadow: var(--shadow-lg);
  }

  .cal-sidebar--open {
    transform: translateY(0);
  }

  .cal-sidebar__handle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text);
    border-bottom: 1px solid var(--color-border);
  }
}
</style>
