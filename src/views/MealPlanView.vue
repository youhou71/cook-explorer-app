<!--
  Vue de planification des repas (route /mealplan).

  Affiche un calendrier hebdomadaire (lundi → dimanche) avec deux créneaux
  par jour (déjeuner et dîner). L'utilisateur glisse des recettes depuis
  un panneau latéral vers les cases du calendrier. Un bouton génère la
  liste de courses consolidée pour la semaine.
-->

<template>
  <div class="mealplan">
    <!-- En-tête : titre + navigation semaine -->
    <div class="mealplan-header">
      <div>
        <h1>Planifier les repas</h1>
        <p class="hint">Glisse des recettes dans le calendrier, puis génère ta liste de courses.</p>
      </div>
    </div>

    <!-- Navigation semaine -->
    <div class="week-nav">
      <button class="week-btn" @click="goToPrevWeek" title="Semaine précédente">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="week-label">{{ weekLabel }}</span>
      <button class="week-btn" @click="goToNextWeek" title="Semaine suivante">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <button v-if="store.meals.length" class="week-btn week-btn--text" @click="goToToday">Aujourd'hui</button>
      <div class="target-control">
        <label class="target-label">Objectif / repas</label>
        <button class="target-btn" @click="targetServings = Math.max(1, targetServings - 1)">−</button>
        <span class="target-val">{{ targetServings }}</span>
        <button class="target-btn" @click="targetServings++">+</button>
      </div>
    </div>

    <!-- Layout principal : calendrier + sidebar -->
    <div class="mealplan-layout">
      <!-- Grille calendrier -->
      <div ref="calendarEl" class="calendar">
        <!-- En-têtes des jours -->
        <div class="cal-header">
          <div class="cal-slot-label"></div>
          <div
            v-for="(dayName, i) in dayNames"
            :key="i"
            class="cal-day-header"
            :class="{ 'cal-day-header--today': isToday(i) }"
          >
            <span class="cal-day-name">{{ dayName }}</span>
            <span class="cal-day-date">{{ dayDate(i) }}</span>
          </div>
        </div>

        <!-- Ligne Déjeuner -->
        <div class="cal-row" :style="laneRowStyle('lunch')">
          <div class="cal-slot-label" :style="laneLabelStyle('lunch')">Déjeuner</div>
          <!-- Fonds des couloirs étalés -->
          <div v-for="n in laneCount('lunch')" :key="'lbg-l-'+n" class="cal-lane-bg" :style="{gridColumn:'2/-1',gridRow:`${n}`}" @dragover.prevent="onLaneDragOver($event,'lunch')" @dragleave="onDragLeave" @drop="onLaneDrop($event,'lunch')"></div>
          <div v-if="laneCount('lunch')>0&&todayIdx>=0" class="cal-lane-today" :style="{gridColumn:`${todayIdx+2}`,gridRow:`1/${laneCount('lunch')+1}`}"></div>
          <!-- Barres étalées -->
          <div
            v-for="{meal,lane} in getLanes('lunch')"
            :key="'bar-l-'+meal.recipePath"
            class="meal-chip meal-chip--bar"
            :style="{gridColumn:`${meal.day+2}/span ${meal.span}`,gridRow:`${lane+1}`,...getMealChipStyle(meal.recipePath)}"
            draggable="true"
            @dragstart="onChipDragStart($event,meal.day,'lunch',meal.recipePath)"
            @dragend="onDragEnd"
            @dragover.prevent="onLaneDragOver($event,'lunch')"
            @drop="onLaneDrop($event,'lunch')"
          >
            <RouterLink :to="`/recipes/${meal.recipePath}`" class="meal-chip-link">{{ getRecipeTitle(meal.recipePath) }}</RouterLink>
            <div class="meal-chip-controls">
              <div class="meal-chip-servings" title="Portions">
                <button class="meal-chip-srv-btn" @click="store.updateServings(meal.day,'lunch',meal.recipePath,meal.servings-1)">−</button>
                <span class="meal-chip-srv-val">{{ meal.servings }}</span>
                <button class="meal-chip-srv-btn" @click="store.updateServings(meal.day,'lunch',meal.recipePath,meal.servings+1)">+</button>
              </div>
            </div>
            <button class="meal-chip-remove" @click="store.removeMeal(meal.day,'lunch',meal.recipePath)" title="Retirer">×</button>
            <div v-if="meal.day+meal.span-1<6" class="meal-chip-resize" @mousedown.prevent.stop="onResizeStart($event,meal)"></div>
          </div>
          <!-- Cellules des jours (repas non étalés) -->
          <div
            v-for="day in 7"
            :key="'lunch-'+day"
            class="cal-cell"
            :class="{'cal-cell--dragover':dragTarget===`${day-1}-lunch`,'cal-cell--today':isToday(day-1),'cal-cell--resize-preview':isCellInResizePreview(day-1,'lunch')}"
            :style="laneCellStyle('lunch',day-1)"
            @dragover.prevent="onDragOver($event,day-1,'lunch')"
            @dragleave="onDragLeave"
            @drop="onDrop($event,day-1,'lunch')"
          >
            <div v-for="meal in getSingleMeals(day-1,'lunch')" :key="meal.recipePath" class="meal-chip" :style="getMealChipStyle(meal.recipePath)" draggable="true" @dragstart="onChipDragStart($event,day-1,'lunch',meal.recipePath)" @dragend="onDragEnd">
              <RouterLink :to="`/recipes/${meal.recipePath}`" class="meal-chip-link">{{ getRecipeTitle(meal.recipePath) }}</RouterLink>
              <div class="meal-chip-controls">
                <div class="meal-chip-servings" title="Portions">
                  <button class="meal-chip-srv-btn" @click="store.updateServings(day-1,'lunch',meal.recipePath,meal.servings-1)">−</button>
                  <span class="meal-chip-srv-val">{{ meal.servings }}</span>
                  <button class="meal-chip-srv-btn" @click="store.updateServings(day-1,'lunch',meal.recipePath,meal.servings+1)">+</button>
                </div>
              </div>
              <button class="meal-chip-remove" @click="store.removeMeal(day-1,'lunch',meal.recipePath)" title="Retirer">×</button>
              <div v-if="day-1<6" class="meal-chip-resize" @mousedown.prevent.stop="onResizeStart($event,meal)"></div>
            </div>
            <div v-if="getSingleMeals(day-1,'lunch').length===0&&!hasSpannedAt(day-1,'lunch')" class="cal-cell-empty">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div class="cal-cell-portions" :class="{'cal-cell-portions--ok':cellServings(day-1,'lunch')>=targetServings,'cal-cell-portions--under':cellServings(day-1,'lunch')<targetServings}">{{ cellServings(day-1,'lunch') }}/{{ targetServings }}</div>
          </div>
        </div>

        <!-- Ligne Dîner -->
        <div class="cal-row" :style="laneRowStyle('dinner')">
          <div class="cal-slot-label" :style="laneLabelStyle('dinner')">Dîner</div>
          <div v-for="n in laneCount('dinner')" :key="'lbg-d-'+n" class="cal-lane-bg" :style="{gridColumn:'2/-1',gridRow:`${n}`}" @dragover.prevent="onLaneDragOver($event,'dinner')" @dragleave="onDragLeave" @drop="onLaneDrop($event,'dinner')"></div>
          <div v-if="laneCount('dinner')>0&&todayIdx>=0" class="cal-lane-today" :style="{gridColumn:`${todayIdx+2}`,gridRow:`1/${laneCount('dinner')+1}`}"></div>
          <div
            v-for="{meal,lane} in getLanes('dinner')"
            :key="'bar-d-'+meal.recipePath"
            class="meal-chip meal-chip--bar"
            :style="{gridColumn:`${meal.day+2}/span ${meal.span}`,gridRow:`${lane+1}`,...getMealChipStyle(meal.recipePath)}"
            draggable="true"
            @dragstart="onChipDragStart($event,meal.day,'dinner',meal.recipePath)"
            @dragend="onDragEnd"
            @dragover.prevent="onLaneDragOver($event,'dinner')"
            @drop="onLaneDrop($event,'dinner')"
          >
            <RouterLink :to="`/recipes/${meal.recipePath}`" class="meal-chip-link">{{ getRecipeTitle(meal.recipePath) }}</RouterLink>
            <div class="meal-chip-controls">
              <div class="meal-chip-servings" title="Portions">
                <button class="meal-chip-srv-btn" @click="store.updateServings(meal.day,'dinner',meal.recipePath,meal.servings-1)">−</button>
                <span class="meal-chip-srv-val">{{ meal.servings }}</span>
                <button class="meal-chip-srv-btn" @click="store.updateServings(meal.day,'dinner',meal.recipePath,meal.servings+1)">+</button>
              </div>
            </div>
            <button class="meal-chip-remove" @click="store.removeMeal(meal.day,'dinner',meal.recipePath)" title="Retirer">×</button>
            <div v-if="meal.day+meal.span-1<6" class="meal-chip-resize" @mousedown.prevent.stop="onResizeStart($event,meal)"></div>
          </div>
          <div
            v-for="day in 7"
            :key="'dinner-'+day"
            class="cal-cell"
            :class="{'cal-cell--dragover':dragTarget===`${day-1}-dinner`,'cal-cell--today':isToday(day-1),'cal-cell--resize-preview':isCellInResizePreview(day-1,'dinner')}"
            :style="laneCellStyle('dinner',day-1)"
            @dragover.prevent="onDragOver($event,day-1,'dinner')"
            @dragleave="onDragLeave"
            @drop="onDrop($event,day-1,'dinner')"
          >
            <div v-for="meal in getSingleMeals(day-1,'dinner')" :key="meal.recipePath" class="meal-chip" :style="getMealChipStyle(meal.recipePath)" draggable="true" @dragstart="onChipDragStart($event,day-1,'dinner',meal.recipePath)" @dragend="onDragEnd">
              <RouterLink :to="`/recipes/${meal.recipePath}`" class="meal-chip-link">{{ getRecipeTitle(meal.recipePath) }}</RouterLink>
              <div class="meal-chip-controls">
                <div class="meal-chip-servings" title="Portions">
                  <button class="meal-chip-srv-btn" @click="store.updateServings(day-1,'dinner',meal.recipePath,meal.servings-1)">−</button>
                  <span class="meal-chip-srv-val">{{ meal.servings }}</span>
                  <button class="meal-chip-srv-btn" @click="store.updateServings(day-1,'dinner',meal.recipePath,meal.servings+1)">+</button>
                </div>
              </div>
              <button class="meal-chip-remove" @click="store.removeMeal(day-1,'dinner',meal.recipePath)" title="Retirer">×</button>
              <div v-if="day-1<6" class="meal-chip-resize" @mousedown.prevent.stop="onResizeStart($event,meal)"></div>
            </div>
            <div v-if="getSingleMeals(day-1,'dinner').length===0&&!hasSpannedAt(day-1,'dinner')" class="cal-cell-empty">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div
              class="cal-cell-portions"
              :class="{
                'cal-cell-portions--ok': cellServings(day - 1, 'dinner') >= targetServings,
                'cal-cell-portions--under': cellServings(day - 1, 'dinner') < targetServings
              }"
            >{{ cellServings(day - 1, 'dinner') }}/{{ targetServings }}</div>
          </div>
        </div>
      </div>

      <!-- Panneau latéral : recettes disponibles -->
      <div class="sidebar">
        <div class="sidebar-header">
          <h2>Recettes</h2>
          <span class="sidebar-count">{{ filteredRecipes.length }}</span>
        </div>
        <div class="sidebar-search">
          <svg class="sidebar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="sidebarSearch" placeholder="Filtrer..." class="sidebar-input" />
        </div>
        <div class="sidebar-list">
          <template v-for="group in groupedRecipes" :key="group.key">
            <div class="sidebar-group-header">
              <span class="sidebar-group-icon">{{ group.icon }}</span>
              <span class="sidebar-group-name">{{ group.name }}</span>
              <span class="sidebar-group-count">{{ group.recipes.length }}</span>
            </div>
            <div
              v-for="r in group.recipes"
              :key="r.path"
              class="sidebar-recipe"
              draggable="true"
              @dragstart="onDragStart($event, r.path)"
              @dragend="onDragEnd"
            >
              <span class="sidebar-recipe-name">{{ getRecipeTitle(r.path) }}</span>
            </div>
          </template>
          <div v-if="filteredRecipes.length === 0" class="sidebar-empty">Aucune recette trouvée.</div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="mealplan-actions">
      <button
        class="btn btn--primary"
        :disabled="store.meals.length === 0"
        @click="showShoppingList = true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        Générer la liste de courses
      </button>
      <button
        v-if="store.meals.length"
        class="btn btn--ghost"
        @click="confirmClear"
      >
        Vider la semaine
      </button>
    </div>

    <!-- Modal liste de courses -->
    <Teleport to="body">
      <div v-if="showShoppingList" class="modal-overlay" @click.self="showShoppingList = false">
        <div class="modal">
          <div class="modal-header">
            <h2>Liste de courses</h2>
            <span class="modal-subtitle">{{ weekLabel }} — {{ store.meals.length }} repas</span>
            <button class="modal-close" @click="showShoppingList = false">×</button>
          </div>
          <div class="modal-body">
            <div v-if="shoppingList.length === 0" class="modal-empty">
              Aucun ingrédient à afficher. Les recettes n'ont peut-être pas encore été chargées.
            </div>
            <div v-for="(group, gi) in shoppingList" :key="gi" class="shop-group">
              <h3 class="shop-group-title">
                <span class="shop-group-icon">{{ group.icon }}</span>
                {{ group.category }}
                <span class="shop-group-count">{{ group.items.length }}</span>
              </h3>
              <ul class="shop-list">
                <li v-for="(item, ii) in group.items" :key="ii" class="shop-item">
                  <span class="shop-item-check">○</span>
                  <span class="shop-item-qty" v-if="item.qty">{{ item.qty }}<span v-if="item.unit"> {{ item.unit }}</span></span>
                  <span class="shop-item-name">{{ item.name }}</span>
                  <span class="shop-item-recipes" v-if="item.recipes.length > 1" :title="item.recipes.join(', ')">× {{ item.recipes.length }} recettes</span>
                  <select class="shop-item-aisle" :value="item.aisleId" @change="reassignAisle(item.normName, ($event.target as HTMLSelectElement).value)" title="Changer de rayon">
                    <option v-for="a in AISLES" :key="a.id" :value="a.id">{{ a.icon }} {{ a.name }}</option>
                  </select>
                </li>
              </ul>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--ghost" @click="copyForGoogleKeep"
              title="Collez dans Google Keep, puis activez les cases à cocher via le menu ⋮">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {{ copyKeepLabel }}
            </button>
            <button class="btn btn--primary" @click="copyShoppingList">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {{ copyLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { RouterLink } from 'vue-router'
import { useMealPlanStore, getMonday } from '@/stores/mealplan'
import { useRecipesStore } from '@/stores/recipes'
import { useCooklang } from '@/composables/useCooklang'
import { getCategory, compareCategories } from '@/utils/categories'
import { AISLES, AISLE_MAP, getDefaultAisle } from '@/utils/aisles'
import { useRecipeCache } from '@/composables/useRecipeCache'
import type { CooklangIngredient, IngredientAisleMapping, MealSlot } from '@/types'

const store = useMealPlanStore()
const recipesStore = useRecipesStore()
const cache = useRecipeCache()
const { parseRecipe, getTitle, getBaseServings } = useCooklang()

/** Noms des jours de la semaine. */
const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** Recherche dans la sidebar. */
const sidebarSearch = ref('')

/** Cible actuelle du drag-and-drop (pour le style de surbrillance). */
const dragTarget = ref<string | null>(null)

/** Ref du calendrier (pour calculer les positions des colonnes au resize). */
const calendarEl = ref<HTMLElement | null>(null)

/** Nombre de portions cible par repas (persisté en localStorage). */
const targetServings = useLocalStorage('mealplan-target-servings', 4)

/** Affichage de la modal liste de courses. */
const showShoppingList = ref(false)

/** Label du bouton copier. */
const copyLabel = ref('Copier')

/** Label du bouton copier pour Google Keep. */
const copyKeepLabel = ref('Pour Google Keep')

/** Associations ingrédient → rayon personnalisées par l'utilisateur. */
const userAisleMap = ref(new Map<string, string>())

// ── Initialisation ────────────────────────────────────────────────────────

onMounted(async () => {
  await recipesStore.hydrate()
  await store.loadWeek(store.weekStart)
  const saved = await cache.getAllIngredientAisles()
  userAisleMap.value = new Map(saved.map(m => [m.ingredient, m.aisleId]))
})

// ── Navigation semaine ────────────────────────────────────────────────────

/** Label lisible de la semaine courante. */
const weekLabel = computed(() => {
  const d = new Date(store.weekStart + 'T00:00:00')
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const locale = 'fr-FR'
  return `${d.toLocaleDateString(locale, opts)} — ${end.toLocaleDateString(locale, opts)}`
})

async function goToPrevWeek() { await store.prevWeek() }
async function goToNextWeek() { await store.nextWeek() }
async function goToToday() { await store.loadWeek(getMonday(new Date())) }

/** Vérifie si un jour du calendrier est aujourd'hui. */
function isToday(dayIndex: number): boolean {
  const d = new Date(store.weekStart + 'T00:00:00')
  d.setDate(d.getDate() + dayIndex)
  const today = new Date()
  return d.toDateString() === today.toDateString()
}


/** Retourne la date formatée (ex : "14") pour un jour. */
function dayDate(dayIndex: number): string {
  const d = new Date(store.weekStart + 'T00:00:00')
  d.setDate(d.getDate() + dayIndex)
  return d.getDate().toString()
}

// ── Recettes (sidebar) ───────────────────────────────────────────────────

/** Recettes filtrées par la recherche sidebar. */
const filteredRecipes = computed(() => {
  const q = sidebarSearch.value.toLowerCase().trim()
  return recipesStore.recipes.filter(r => {
    if (!q) return true
    const title = getRecipeTitle(r.path).toLowerCase()
    return title.includes(q) || r.path.toLowerCase().includes(q)
  })
})

/** Recettes groupées par catégorie, triées selon l'ordre défini. */
const groupedRecipes = computed(() => {
  const map = new Map<string, typeof filteredRecipes.value>()
  for (const r of filteredRecipes.value) {
    const cat = getCategory(r.path) || ''
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(r)
  }
  const settingsMap = recipesStore.categoryMap
  return Array.from(map.entries())
    .sort(([a], [b]) => compareCategories(a, b, settingsMap))
    .map(([cat, recipes]) => {
      const settings = cat ? recipesStore.getCategorySettings(cat) : null
      return {
        key: cat || '_uncategorized',
        name: settings?.name || cat || 'Autres',
        icon: settings?.icon || '🍽️',
        recipes
      }
    })
})

/** Cache des titres de recettes pour éviter de re-parser. */
const titleCache = new Map<string, string>()

/** Retourne le titre d'une recette par son path. */
function getRecipeTitle(path: string): string {
  if (titleCache.has(path)) return titleCache.get(path)!
  const recipe = recipesStore.getByPath(path)
  if (!recipe) {
    const name = path.split('/').pop()?.replace('.cook', '') ?? path
    return name
  }
  if (recipe.parsed) {
    const title = getTitle(recipe.parsed, recipe.name)
    titleCache.set(path, title)
    return title
  }
  if (recipe.content) {
    const parsed = parseRecipe(recipe.content)
    const title = getTitle(parsed, recipe.name)
    titleCache.set(path, title)
    return title
  }
  return recipe.name
}

/** Retourne l'icône emoji de la catégorie d'une recette. */
function getCategoryIcon(path: string): string {
  const cat = getCategory(path)
  if (!cat) return '🍽️'
  return recipesStore.getCategorySettings(cat).icon
}

/** Style coloré pour un chip de repas, basé sur la catégorie. */
function getMealChipStyle(path: string): Record<string, string> {
  const cat = getCategory(path)
  if (!cat) return {}
  const settings = recipesStore.getCategorySettings(cat)
  return {
    background: settings.colorSecondary,
    color: settings.color,
    borderColor: settings.color
  }
}

/**
 * Distribution globale des portions par jour et par créneau.
 * Algorithme glouton : chaque repas remplit ses jours en tenant compte
 * de la capacité restante (objectif - déjà attribué ce jour-là).
 */
const portionMap = computed(() => {
  const target = targetServings.value
  const result: Record<string, number[]> = {
    lunch: new Array(7).fill(0),
    dinner: new Array(7).fill(0)
  }

  for (const slot of ['lunch', 'dinner'] as const) {
    const meals = store.meals
      .filter(m => m.slot === slot)
      .sort((a, b) => a.day - b.day)

    for (const meal of meals) {
      const span = meal.span ?? 1
      let remaining = meal.servings
      for (let d = meal.day; d < meal.day + span && d < 7; d++) {
        const available = Math.max(0, target - result[slot][d])
        const take = Math.min(remaining, available)
        result[slot][d] += take
        remaining -= take
      }
    }
  }

  return result
})

/** Total de portions attribuées à un jour/créneau. */
function cellServings(day: number, slot: 'lunch' | 'dinner'): number {
  return portionMap.value[slot][day]
}

// ── Système de lanes (couloirs) pour les recettes étalées ─────────────

/** Index du jour courant dans la semaine (0-6), ou -1 si hors semaine. */
const todayIdx = computed(() => {
  for (let i = 0; i < 7; i++) {
    if (isToday(i)) return i
  }
  return -1
})

/** Algorithme glouton d'assignation de lanes pour les recettes étalées. */
function getLanes(slot: 'lunch' | 'dinner'): { meal: MealSlot; lane: number }[] {
  const spanned = store.meals
    .filter(m => m.slot === slot && m.span > 1)
    .sort((a, b) => a.day - b.day)
  const lanes: { meal: MealSlot; lane: number }[] = []
  const laneEnds: number[] = []
  for (const meal of spanned) {
    let assigned = -1
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= meal.day) {
        assigned = i
        break
      }
    }
    if (assigned === -1) {
      assigned = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[assigned] = meal.day + meal.span
    lanes.push({ meal, lane: assigned })
  }
  return lanes
}

/** Nombre de lanes pour un créneau. */
function laneCount(slot: 'lunch' | 'dinner'): number {
  const lanes = getLanes(slot)
  if (lanes.length === 0) return 0
  return Math.max(...lanes.map(l => l.lane)) + 1
}

/** Style grid pour la ligne d'un créneau (lanes + cellules). */
function laneRowStyle(slot: 'lunch' | 'dinner'): Record<string, string> {
  const n = laneCount(slot)
  const rows = n > 0 ? `repeat(${n}, auto) 1fr` : '1fr'
  return {
    gridTemplateColumns: '80px repeat(7, 1fr)',
    gridTemplateRows: rows
  }
}

/** Style du label du créneau (couvre toutes les lignes). */
function laneLabelStyle(_slot: 'lunch' | 'dinner'): Record<string, string> {
  return { gridColumn: '1', gridRow: '1 / -1' }
}

/** Style d'une cellule jour (dernière ligne de la grille). */
function laneCellStyle(slot: 'lunch' | 'dinner', dayIndex: number): Record<string, string> {
  const n = laneCount(slot)
  return {
    gridColumn: `${dayIndex + 2}`,
    gridRow: `${n + 1}`
  }
}

/** Retourne les repas NON étalés d'une cellule. */
function getSingleMeals(day: number, slot: 'lunch' | 'dinner'): MealSlot[] {
  return store.getMeals(day, slot).filter(m => (m.span ?? 1) <= 1)
}

/** Vérifie si un repas étalé couvre ce jour (pour masquer le placeholder). */
function hasSpannedAt(day: number, slot: 'lunch' | 'dinner'): boolean {
  return store.meals.some(m =>
    m.slot === slot && m.span > 1 && m.day <= day && m.day + m.span > day
  )
}

/** Calcule le jour cible à partir de la position X de la souris sur le calendrier. */
function dayFromMouseX(e: MouseEvent): number {
  if (!calendarEl.value) return 0
  const rect = calendarEl.value.getBoundingClientRect()
  const labelWidth = 80
  const colWidth = (rect.width - labelWidth) / 7
  const dayIdx = Math.floor((e.clientX - rect.left - labelWidth) / colWidth)
  return Math.max(0, Math.min(6, dayIdx))
}

/** Gestion dragover sur les zones de lanes. */
function onLaneDragOver(e: DragEvent, slot: 'lunch' | 'dinner') {
  const day = dayFromMouseX(e as unknown as MouseEvent)
  dragTarget.value = `${day}-${slot}`
  e.dataTransfer!.dropEffect = e.dataTransfer!.types.includes('fromday') ? 'move' : 'copy'
}

/** Gestion drop sur les zones de lanes. */
async function onLaneDrop(e: DragEvent, slot: 'lunch' | 'dinner') {
  const day = dayFromMouseX(e as unknown as MouseEvent)
  await onDrop(e, day, slot)
}

// ── Drag and drop ─────────────────────────────────────────────────────────

/** Drag depuis la sidebar (ajout). */
function onDragStart(e: DragEvent, path: string) {
  e.dataTransfer!.setData('text/plain', path)
  e.dataTransfer!.setData('source', 'sidebar')
  e.dataTransfer!.effectAllowed = 'copyMove'
}

/** Drag depuis une chip du calendrier (déplacement). */
function onChipDragStart(e: DragEvent, day: number, slot: 'lunch' | 'dinner', path: string) {
  e.stopPropagation()
  e.dataTransfer!.setData('text/plain', path)
  e.dataTransfer!.setData('source', 'calendar')
  e.dataTransfer!.setData('fromDay', String(day))
  e.dataTransfer!.setData('fromSlot', slot)
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragEnd() {
  dragTarget.value = null
}

function onDragOver(e: DragEvent, day: number, slot: 'lunch' | 'dinner') {
  const source = e.dataTransfer!.types.includes('source') ? 'known' : 'unknown'
  e.dataTransfer!.dropEffect = e.dataTransfer!.types.includes('fromday') ? 'move' : 'copy'
  dragTarget.value = `${day}-${slot}`
}

function onDragLeave() {
  dragTarget.value = null
}

async function onDrop(e: DragEvent, day: number, slot: 'lunch' | 'dinner') {
  dragTarget.value = null
  const path = e.dataTransfer!.getData('text/plain')
  if (!path) return

  const source = e.dataTransfer!.getData('source')
  if (source === 'calendar') {
    const fromDay = parseInt(e.dataTransfer!.getData('fromDay'))
    const fromSlot = e.dataTransfer!.getData('fromSlot') as 'lunch' | 'dinner'
    if (fromDay === day && fromSlot === slot) return
    await store.moveMeal(fromDay, fromSlot, path, day, slot)
  } else {
    const servings = getRecipeServings(path)
    await store.addMeal(day, slot, path, servings)
  }
}

// ── Resize (étaler sur plusieurs jours) ───────────────────────────────────

/** Meal en cours de redimensionnement. */
const resizing = ref<MealSlot | null>(null)
/** Span en prévisualisation pendant le resize. */
const resizePreviewSpan = ref(1)

/** Démarre le resize depuis la poignée droite d'une chip. */
function onResizeStart(e: MouseEvent, meal: MealSlot) {
  resizing.value = meal
  resizePreviewSpan.value = meal.span
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

/** Calcule le span en fonction de la position horizontale de la souris. */
function onResizeMove(e: MouseEvent) {
  if (!resizing.value || !calendarEl.value) return
  const rect = calendarEl.value.getBoundingClientRect()
  const labelWidth = 80
  const colWidth = (rect.width - labelWidth) / 7
  const dayUnderMouse = Math.floor((e.clientX - rect.left - labelWidth) / colWidth)
  const clamped = Math.max(resizing.value.day, Math.min(6, dayUnderMouse))
  resizePreviewSpan.value = clamped - resizing.value.day + 1
}

/** Applique le span final au relâchement de la souris. */
function onResizeEnd() {
  if (resizing.value) {
    store.updateSpan(resizing.value.day, resizing.value.slot, resizing.value.recipePath, resizePreviewSpan.value)
  }
  resizing.value = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

/** Indique si une cellule est dans la zone de preview du resize en cours. */
function isCellInResizePreview(day: number, slot: 'lunch' | 'dinner'): boolean {
  if (!resizing.value) return false
  const m = resizing.value
  return m.slot === slot && day > m.day && day < m.day + resizePreviewSpan.value
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})

/** Retourne le nombre de portions de base d'une recette (fallback 4). */
function getRecipeServings(path: string): number {
  const recipe = recipesStore.getByPath(path)
  if (!recipe) return 4
  if (recipe.parsed) return getBaseServings(recipe.parsed) ?? 4
  if (recipe.content) return getBaseServings(parseRecipe(recipe.content)) ?? 4
  return 4
}

// ── Vider la semaine ──────────────────────────────────────────────────────

function confirmClear() {
  if (confirm('Vider tous les repas de cette semaine ?')) {
    store.clearWeek()
  }
}

// ── Liste de courses ──────────────────────────────────────────────────────

interface ShoppingItem {
  name: string
  normName: string
  qty: string
  unit: string
  recipes: string[]
  aisleId: string
}

interface ShoppingGroup {
  category: string
  icon: string
  aisleId: string
  items: ShoppingItem[]
}

/** Normalise un nom d'ingrédient en singulier pour le regroupement. */
function singularize(name: string): string {
  let s = name.toLowerCase().trim()
  s = s.replace(/œ/g, 'oe')
  if (s === 'oeufs') return 'oeuf'
  if (s.endsWith('eaux')) return s.slice(0, -4) + 'eau'
  if (s.endsWith('aux') && !s.endsWith('eaux')) return s.slice(0, -3) + 'al'
  if (s.endsWith('oux')) return s.slice(0, -1)
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1)
  return s
}

/** Résout le rayon d'un ingrédient : choix utilisateur > mapping par défaut > "autres". */
function resolveAisle(normName: string): string {
  return userAisleMap.value.get(normName) ?? getDefaultAisle(normName)
}

/** Réassigne un ingrédient à un nouveau rayon et persiste le choix. */
async function reassignAisle(normName: string, newAisleId: string) {
  userAisleMap.value.set(normName, newAisleId)
  userAisleMap.value = new Map(userAisleMap.value)
  await cache.putIngredientAisle({ ingredient: normName, aisleId: newAisleId })
}

/** Construit la liste de courses consolidée depuis les repas de la semaine, groupée par rayon. */
const shoppingList = computed<ShoppingGroup[]>(() => {
  const itemMap = new Map<string, ShoppingItem>()

  for (const meal of store.meals) {
    const recipe = recipesStore.getByPath(meal.recipePath)
    if (!recipe) continue

    let parsed = recipe.parsed
    if (!parsed && recipe.content) {
      parsed = parseRecipe(recipe.content)
    }
    if (!parsed) continue

    const baseServings = getBaseServings(parsed) ?? meal.servings
    const ratio = meal.servings / baseServings
    const recipeTitle = getRecipeTitle(meal.recipePath)

    for (const ing of parsed.ingredients) {
      const normName = singularize(ing.name)
      const normUnit = singularize(ing.units ?? '')
      const key = `${normName}|${normUnit}`

      const scaledQty = scaleQuantity(ing.quantity, ratio)

      const existing = itemMap.get(key)
      if (existing) {
        existing.qty = mergeQty(existing.qty, scaledQty)
        if (!existing.recipes.includes(recipeTitle)) {
          existing.recipes.push(recipeTitle)
        }
      } else {
        itemMap.set(key, {
          name: ing.name,
          normName,
          qty: formatQuantity(scaledQty),
          unit: normUnit,
          recipes: [recipeTitle],
          aisleId: resolveAisle(normName)
        })
      }
    }
  }

  if (itemMap.size === 0) return []

  const grouped = new Map<string, ShoppingItem[]>()
  for (const item of itemMap.values()) {
    item.aisleId = resolveAisle(item.normName)
    const list = grouped.get(item.aisleId) ?? []
    list.push(item)
    grouped.set(item.aisleId, list)
  }

  return AISLES
    .filter(a => grouped.has(a.id))
    .map(a => ({
      category: a.name,
      icon: a.icon,
      aisleId: a.id,
      items: grouped.get(a.id)!.sort((x, y) => x.name.localeCompare(y.name, 'fr-FR'))
    }))
})

/** Applique un ratio de mise à l'échelle à une quantité. */
function scaleQuantity(qty: string | number, ratio: number): string | number {
  if (ratio === 1) return qty
  if (typeof qty === 'number') return qty * ratio
  const n = parseFloat(String(qty))
  if (!Number.isNaN(n)) return n * ratio
  return qty
}

/** Arrondi à 2 décimales max, sans trailing zeros. */
function fmtQty(n: number): string {
  if (Number.isNaN(n)) return ''
  if (Number.isInteger(n)) return n.toString()
  return parseFloat(n.toFixed(2)).toString()
}

/** Formate une quantité brute en chaîne lisible. */
function formatQuantity(qty: string | number): string {
  if (qty === '' || qty === undefined || qty === null) return ''
  if (typeof qty === 'number') return fmtQty(qty)
  const n = parseFloat(String(qty))
  if (!Number.isNaN(n)) return fmtQty(n)
  return String(qty)
}

/** Additionne deux quantités si possible. */
function mergeQty(existingQty: string, newQty: string | number): string {
  const a = existingQty ? parseFloat(existingQty) : NaN
  const b = typeof newQty === 'number' ? newQty : parseFloat(String(newQty))
  if (!Number.isNaN(a) && !Number.isNaN(b)) return fmtQty(a + b)
  if (!existingQty) return formatQuantity(newQty)
  return existingQty
}

/** Copie la liste au format Google Keep (texte brut, une ligne par item sans préfixe). */
async function copyForGoogleKeep() {
  const lines: string[] = []
  for (const group of shoppingList.value) {
    if (lines.length > 0) lines.push('')
    lines.push(`--- ${group.icon} ${group.category} ---`)
    for (const item of group.items) {
      const qty = item.qty ? `${item.qty}${item.unit ? ' ' + item.unit : ''} ` : ''
      lines.push(`${qty}${item.name}`)
    }
  }
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copyKeepLabel.value = 'Copié ✓'
    setTimeout(() => { copyKeepLabel.value = 'Pour Google Keep' }, 2000)
  } catch {
    copyKeepLabel.value = 'Erreur'
    setTimeout(() => { copyKeepLabel.value = 'Pour Google Keep' }, 2000)
  }
}

/** Copie la liste de courses dans le presse-papier en texte brut. */
async function copyShoppingList() {
  const lines: string[] = []
  for (const group of shoppingList.value) {
    if (lines.length > 0) lines.push('')
    lines.push(`## ${group.icon} ${group.category}`)
    for (const item of group.items) {
      const qty = item.qty ? `${item.qty}${item.unit ? ' ' + item.unit : ''} ` : ''
      lines.push(`- ${qty}${item.name}`)
    }
  }
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copyLabel.value = 'Copié ✓'
    setTimeout(() => { copyLabel.value = 'Copier' }, 2000)
  } catch {
    copyLabel.value = 'Erreur'
    setTimeout(() => { copyLabel.value = 'Copier' }, 2000)
  }
}
</script>

<style scoped>
/* ── Étend .app-main sur toute la largeur quand le meal planner est affiché ── */
:global(.app-main:has(.mealplan)) {
  max-width: none;
  margin-right: 250px;
}

/* ── Layout principal ──────────────────────────────────────────────────── */
.mealplan {
  max-width: 100%;
}

.mealplan-header {
  margin-bottom: 1.5rem;
}

h1 {
  font-family: var(--font-serif);
  font-size: 1.8rem;
  margin-bottom: 0.3rem;
  letter-spacing: -0.01em;
}

.hint {
  color: var(--color-muted);
  font-size: 0.88rem;
}

/* ── Navigation semaine ────────────────────────────────────────────────── */
.week-nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.week-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--color-muted);
  transition: all var(--transition-fast);
}

.week-btn:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.week-btn--text {
  width: auto;
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
  margin-left: 0.5rem;
}

.week-label {
  font-weight: 600;
  font-size: 1rem;
}

/* ── Contrôle objectif portions ── */
.target-control {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 99px;
  padding: 0.25rem 0.6rem;
}

.target-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
  margin-right: 0.2rem;
}

.target-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.target-btn:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.target-val {
  font-size: 0.92rem;
  font-weight: 700;
  min-width: 16px;
  text-align: center;
}

/* ── Layout calendrier + sidebar ───────────────────────────────────────── */
.mealplan-layout {
  margin-bottom: 1.5rem;
}

/* ── Calendrier ────────────────────────────────────────────────────────── */
.calendar {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--color-border);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.cal-header {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  gap: 1px;
}

.cal-slot-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--color-surface);
  padding: 0.5rem 0.4rem;
  white-space: nowrap;
}

.cal-day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.6rem 0.25rem;
  background: var(--color-surface);
  gap: 0.1rem;
}

.cal-day-header--today {
  background: var(--color-accent-light);
}

.cal-day-name {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cal-day-header--today .cal-day-name {
  color: var(--color-accent);
}

.cal-day-date {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.cal-day-header--today .cal-day-date {
  color: var(--color-accent);
}

.cal-row {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  gap: 1px;
}

.cal-cell {
  background: var(--color-surface);
  min-height: 90px;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  overflow: visible;
  transition: background var(--transition-fast);
}

.cal-cell--today {
  background: color-mix(in srgb, var(--color-accent-light) 40%, var(--color-surface));
}

.cal-cell--dragover {
  background: var(--color-sage-light);
  outline: 2px dashed var(--color-sage);
  outline-offset: -2px;
}

.cal-cell-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-border);
  padding: 0.5rem 0;
}

/* ── Indicateur portions dans les cellules ── */
.cal-cell-portions {
  margin-top: auto;
  font-size: 0.65rem;
  font-weight: 700;
  text-align: right;
  border-radius: 3px;
  padding: 0 0.25rem;
  line-height: 1.5;
  align-self: flex-end;
}

.cal-cell-portions--ok {
  color: var(--color-sage);
  background: var(--color-sage-light);
}

.cal-cell-portions--under {
  color: var(--color-accent);
  background: var(--color-accent-light);
}

/* ── Chips de repas ────────────────────────────────────────────────────── */
.meal-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 500;
  border: 1px solid transparent;
  background: var(--color-surface-alt);
  line-height: 1.3;
  cursor: grab;
}

.meal-chip:active {
  cursor: grabbing;
}

.meal-chip-link {
  flex: 1;
  color: inherit;
  text-decoration: none;
  word-break: break-word;
}

.meal-chip-link:hover {
  text-decoration: underline;
}

/* ── Lanes : fond, surbrillance aujourd'hui, barres étalées ── */
.cal-lane-bg {
  background: var(--color-surface);
  min-height: 2rem;
}

.cal-lane-today {
  background: color-mix(in srgb, var(--color-accent-light) 40%, transparent);
  z-index: 1;
  pointer-events: none;
}

.meal-chip--bar {
  z-index: 2;
  align-self: center;
  margin: 0.15rem 0.3rem;
  border-radius: var(--radius-sm);
}

/* ── Contrôles dans les chips ── */
.meal-chip-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  margin-left: auto;
}

.meal-chip-servings,
.meal-chip-span {
  display: flex;
  align-items: center;
  gap: 0.1rem;
}

.meal-chip-srv-btn {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 700;
  color: inherit;
  opacity: 0.5;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  line-height: 1;
}

.meal-chip-srv-btn:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.1);
}

.meal-chip-srv-val {
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 12px;
  text-align: center;
}

/* ── Poignée de resize (bord droit de la chip) ── */
.meal-chip {
  position: relative;
}

.meal-chip-resize {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  transition: background var(--transition-fast);
}

.meal-chip-resize::after {
  content: '';
  position: absolute;
  right: 1px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 14px;
  border-radius: 1px;
  background: currentColor;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.meal-chip:hover .meal-chip-resize::after {
  opacity: 0.35;
}

.meal-chip-resize:hover::after {
  opacity: 0.7;
}

/* ── Preview resize (cellules survolées) ── */
.cal-cell--resize-preview {
  background: var(--color-sage-light);
  outline: 2px dashed var(--color-sage);
  outline-offset: -2px;
}

.meal-chip-remove {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 0.85rem;
  color: inherit;
  opacity: 0.4;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.meal-chip-remove:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.1);
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */
.sidebar {
  position: fixed;
  right: 0;
  top: 59px;
  bottom: 0;
  width: 250px;
  background: var(--color-surface);
  border-left: 1.5px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 5;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem 0;
}

.sidebar-header h2 {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 600;
}

.sidebar-count {
  font-size: 0.75rem;
  color: var(--color-muted);
  background: var(--color-surface-alt);
  padding: 0.1rem 0.5rem;
  border-radius: 99px;
}

.sidebar-search {
  position: relative;
  padding: 0.6rem 1rem;
}

.sidebar-search-icon {
  position: absolute;
  left: 1.6rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-muted);
  pointer-events: none;
}

.sidebar-input {
  padding-left: 2rem;
  font-size: 0.82rem;
  height: 32px;
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 0.5rem 0.5rem;
}

.sidebar-group-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem 0.25rem;
  margin-top: 0.3rem;
  position: sticky;
  top: 0;
  background: var(--color-surface);
  z-index: 1;
}

.sidebar-group-header:first-child {
  margin-top: 0;
}

.sidebar-group-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.sidebar-group-name {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.sidebar-group-count {
  font-size: 0.65rem;
  color: var(--color-muted);
  background: var(--color-surface-alt);
  padding: 0 0.35rem;
  border-radius: 99px;
  font-weight: 500;
  line-height: 1.6;
}

.sidebar-recipe {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem 0.45rem 1.8rem;
  border-radius: var(--radius-sm);
  cursor: grab;
  font-size: 0.82rem;
  transition: background var(--transition-fast);
  user-select: none;
}

.sidebar-recipe:hover {
  background: var(--color-surface-alt);
}

.sidebar-recipe:active {
  cursor: grabbing;
}

.sidebar-recipe-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}

.sidebar-recipe-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-empty {
  color: var(--color-muted);
  font-size: 0.82rem;
  text-align: center;
  padding: 1rem 0;
}

/* ── Actions ───────────────────────────────────────────────────────────── */
.mealplan-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.2rem;
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--color-accent);
  color: white;
  box-shadow: 0 2px 8px rgba(196, 89, 58, 0.2);
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(196, 89, 58, 0.3);
}

.btn--ghost {
  color: var(--color-muted);
  background: none;
  border: 1.5px solid var(--color-border);
}

.btn--ghost:hover {
  color: var(--color-text);
  border-color: var(--color-muted);
}

/* ── Modal ─────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  position: relative;
  padding: 1.5rem 1.5rem 0.75rem;
}

.modal-header h2 {
  font-family: var(--font-serif);
  font-size: 1.4rem;
  font-weight: 600;
}

.modal-subtitle {
  font-size: 0.82rem;
  color: var(--color-muted);
}

.modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1.2rem;
  color: var(--color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.5rem;
}

.modal-empty {
  color: var(--color-muted);
  text-align: center;
  padding: 2rem 0;
  font-size: 0.88rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
}

/* ── Shopping list ─────────────────────────────────────────────────────── */
.shop-group {
  margin-bottom: 1.25rem;
}

.shop-group-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.6rem;
  color: var(--color-text);
}

.shop-group-icon {
  font-size: 1rem;
}

.shop-group-count {
  font-size: 0.72rem;
  color: var(--color-muted);
  background: var(--color-surface-alt);
  padding: 0.1rem 0.45rem;
  border-radius: 99px;
  font-weight: 500;
}

.shop-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.shop-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.35rem 0;
  font-size: 0.88rem;
  border-bottom: 1px solid var(--color-border);
}

.shop-item:last-child {
  border-bottom: none;
}

.shop-item-check {
  color: var(--color-border);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.shop-item-qty {
  font-weight: 600;
  color: var(--color-accent);
  white-space: nowrap;
  min-width: 3.5rem;
}

.shop-item-name {
  flex: 1;
}

.shop-item-recipes {
  font-size: 0.72rem;
  color: var(--color-muted);
  white-space: nowrap;
}

.shop-item-aisle {
  font-size: 0.68rem;
  color: var(--color-muted);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.1rem 0.3rem;
  cursor: pointer;
  flex-shrink: 0;
  max-width: 7rem;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5' fill='none' stroke='%237d7670' stroke-width='2'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.2rem center;
  padding-right: 1rem;
}

.shop-item-aisle:hover {
  border-color: var(--color-accent);
}
</style>
