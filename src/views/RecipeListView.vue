<template>
  <div class="list-view">
    <div class="list-header">
      <div>
        <h1>Mes recettes</h1>
        <p class="list-count" v-if="!loading && recipes.recipes.length">{{ recipes.recipes.length }} recette{{ recipes.recipes.length > 1 ? 's' : '' }}</p>
      </div>
      <RouterLink to="/recipes/new" class="btn-new">
        <span class="btn-new-icon">+</span>
        Nouvelle
      </RouterLink>
    </div>

    <div class="search-wrap">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input v-model="search" placeholder="Rechercher une recette..." class="search" />
    </div>

    <div class="toolbar">
      <div class="toolbar-group toolbar-filters">
        <div v-if="allCategories.length" class="select-wrap">
          <select v-model="activeCategory" class="select">
            <option value="">Toutes les catégories</option>
            <option v-for="cat in allCategories" :key="cat" :value="cat">{{ recipes.getCategorySettings(cat).icon }} {{ recipes.getCategorySettings(cat).name }}</option>
          </select>
          <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="select-wrap">
          <select v-model="activeDuration" class="select">
            <option value="">Toutes les durées</option>
            <option value="15">Moins de 15 min</option>
            <option value="30">Moins de 30 min</option>
            <option value="60">Moins de 1 h</option>
            <option value="120">Moins de 2 h</option>
          </select>
          <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div v-if="allOrigins.length" class="select-wrap">
          <select v-model="activeOrigin" class="select">
            <option value="">Toutes origines</option>
            <option v-for="o in allOrigins" :key="o" :value="o">
              {{ getOriginMeta(o).flag }} {{ getOriginMeta(o).label }}
            </option>
          </select>
          <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div v-if="allSeasons.length" ref="seasonsFilterRef" class="tags-filter-wrap">
          <button
            type="button"
            class="tags-filter-btn"
            :class="{ 'tags-filter-btn--active': activeSeasons.length > 0 }"
            @click.stop="seasonsOpen = !seasonsOpen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
            Saisons
            <span v-if="activeSeasons.length" class="tags-filter-count">{{ activeSeasons.length }}</span>
            <svg class="tags-filter-chevron" :class="{ 'tags-filter-chevron--open': seasonsOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-if="seasonsOpen" class="tags-dropdown" @click.stop>
            <div class="tags-dropdown-list">
              <button
                v-for="s in allSeasons"
                :key="s"
                type="button"
                class="tag-filter"
                :class="{ 'tag-filter--active tag-filter--sky': activeSeasons.includes(s) }"
                @click="toggleSeasonFilter(s)"
              >
                {{ getSeasonMeta(s).icon }} {{ getSeasonMeta(s).label }}
              </button>
            </div>
            <button v-if="activeSeasons.length" type="button" class="tags-clear" @click="clearSeasons">
              Tout effacer
            </button>
          </div>
        </div>
        <div v-if="allTags.length" ref="tagsFilterRef" class="tags-filter-wrap">
          <button
            type="button"
            class="tags-filter-btn"
            :class="{ 'tags-filter-btn--active': activeTags.length > 0 }"
            @click.stop="tagsOpen = !tagsOpen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            Tags
            <span v-if="activeTags.length" class="tags-filter-count">{{ activeTags.length }}</span>
            <svg class="tags-filter-chevron" :class="{ 'tags-filter-chevron--open': tagsOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-if="tagsOpen" class="tags-dropdown" @click.stop>
            <div class="tags-dropdown-list">
              <button
                v-for="tag in allTags"
                :key="tag"
                type="button"
                class="tag-filter"
                :class="[
                  activeTags.includes(tag)
                    ? 'tag-filter--active tag-filter--' + recipes.getTagColor(tag)
                    : ''
                ]"
                @click="toggleTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
            <button v-if="activeTags.length" type="button" class="tags-clear" @click="clearTags">
              Tout effacer
            </button>
          </div>
        </div>
      </div>

      <div class="toolbar-group toolbar-sort">
        <span class="toolbar-sort-label">Trier par</span>
        <div class="select-wrap">
          <select v-model="sortBy" class="select select--ghost">
            <option value="name">Nom (A-Z)</option>
            <option value="created">Ajout récent</option>
            <option value="updated">Modification récente</option>
          </select>
          <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
    </div>

    <div v-if="loading" class="state-msg">
      <div class="loader"></div>
      Chargement depuis GitHub...
    </div>
    <div v-else-if="error" class="state-msg state-msg--error">{{ error }}</div>

    <div v-else-if="filtered.length === 0" class="state-msg">
      {{ recipes.recipes.length === 0 ? 'Aucune recette trouvée dans le repo.' : 'Aucun résultat.' }}
    </div>

    <div v-else class="recipe-grid">
      <RouterLink
        v-for="r in filtered"
        :key="r.path"
        :to="`/recipes/${r.path}`"
        class="recipe-card"
      >
        <div class="card-image-wrap">
          <img
            v-if="images[r.path]"
            :src="images[r.path] ?? undefined"
            :alt="r.name"
            class="card-image"
          />
          <div v-else class="card-image card-image--placeholder">
            <span>🍽</span>
          </div>
          <span
            v-if="getCategory(r.path) || recipeOrigin[r.path]"
            class="card-category"
            :style="getCategory(r.path) ? { background: recipes.getCategorySettings(getCategory(r.path)).colorSecondary, color: recipes.getCategorySettings(getCategory(r.path)).color } : undefined"
          >
            <span
              v-if="recipeOrigin[r.path]"
              class="card-category-flag"
              :title="getOriginMeta(recipeOrigin[r.path]).label"
            >{{ getOriginMeta(recipeOrigin[r.path]).flag }}</span>
            <template v-if="getCategory(r.path)">{{ recipes.getCategorySettings(getCategory(r.path)).icon }} {{ recipes.getCategorySettings(getCategory(r.path)).name }}</template>
          </span>
          <span v-if="recipeTotalTimes[r.path]" class="card-time card-time--overlay">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {{ recipeTotalTimes[r.path] }}
          </span>
        </div>
        <div class="card-body">
          <span class="card-name">{{ titles[r.path] || r.name }}</span>
          <span v-if="recipeTotalTimes[r.path]" class="card-time card-time--inline">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {{ recipeTotalTimes[r.path] }}
          </span>
          <div v-if="recipeTags[r.path]?.length" class="card-tags">
            <span
              v-for="tag in recipeTags[r.path]"
              :key="tag"
              class="card-tag"
              :class="'card-tag--' + recipes.getTagColor(tag)"
            >{{ tag }}</span>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<!--
  Vue principale de la liste des recettes (route /recipes).

  Affiche une grille de cartes de recettes avec recherche full-text et filtres
  combinés (catégorie, durée, origine, saisons, tags libres). Les catégories
  dans le dropdown et sur les badges de cartes utilisent les settings dynamiques
  (nom d'affichage, icône, couleurs) chargés depuis les fichiers .category.json.
-->
<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useRecipesStore } from '@/stores/recipes'
import { useGitHub } from '@/composables/useGitHub'
import { useCooklang } from '@/composables/useCooklang'
import { compareCategories, getCategory } from '@/utils/categories'
import { ORIGIN_COUNTRIES, SEASONS, getOriginMeta, getSeasonMeta } from '@/utils/taxonomies'

/** Store Pinia central (recettes, tags, catégories). */
const recipes = useRecipesStore()
const { fetchRecipeList, fetchRecipeContent, findRecipeImage, fetchCategorySettings } = useGitHub()
const { parseRecipe, getTitle, getSummary } = useCooklang()

// ── Métadonnées extraites par recette (path → valeur) ─────────────────────
/** Data URIs des images de couverture (path → dataUri ou null). */
const images = reactive<Record<string, string | null>>({})
/** Titres d'affichage (path → titre extrait du frontmatter). */
const titles = reactive<Record<string, string>>({})
/** Tags libres (sans préfixe) par recette. */
const recipeTags = reactive<Record<string, string[]>>({})
/** Origine géographique par recette (path → valeur sans préfixe). */
const recipeOrigin = reactive<Record<string, string>>({})
/** Saisons par recette (path → tableau de valeurs). */
const recipeSeasons = reactive<Record<string, string[]>>({})
/** Durée totale formatée pour l'affichage (path → "1h30", "45 min"…). */
const recipeTotalTimes = reactive<Record<string, string>>({})
/** Durée totale en minutes pour le filtrage numérique. */
const recipeTotalMinutes = reactive<Record<string, number>>({})
/** Timestamp de création (pour le tri par date d'ajout). */
const recipeCreatedAt = reactive<Record<string, number>>({})
/** Timestamp de dernière modification. */
const recipeUpdatedAt = reactive<Record<string, number>>({})

// ── État des filtres ──────────────────────────────────────────────────────
/** Tags actuellement sélectionnés (filtre AND : tous doivent matcher). */
const activeTags = ref<string[]>([])
/** Origine sélectionnée dans le dropdown (filtre exact). */
const activeOrigin = ref('')
/** Saisons sélectionnées (filtre OR : au moins une doit matcher). */
const activeSeasons = ref<string[]>([])
/** Catégorie sélectionnée dans le dropdown. */
const activeCategory = ref('')
/** Durée max sélectionnée (en minutes, sous forme de string "15"/"30"/"60"/"120"). */
const activeDuration = ref('')
/** Critère de tri actif. */
const sortBy = ref<'name' | 'created' | 'updated'>('name')
/** État d'ouverture du dropdown des tags. */
const tagsOpen = ref(false)
/** Ref DOM du wrapper du dropdown tags (pour détecter les clics extérieurs). */
const tagsFilterRef = ref<HTMLElement | null>(null)
/** État d'ouverture du dropdown des saisons. */
const seasonsOpen = ref(false)
/** Ref DOM du wrapper du dropdown saisons. */
const seasonsFilterRef = ref<HTMLElement | null>(null)

/** Indicateur de chargement initial (premier fetch sans cache). */
const loading = ref(false)
/** Message d'erreur du fetch (null si OK). */
const error = ref<string | null>(null)
/** Texte de recherche saisi par l'utilisateur. */
const search = ref('')

/** Tous les tags uniques trouvés, triés alphabétiquement */
const allTags = computed(() => {
  const set = new Set<string>()
  for (const tags of Object.values(recipeTags)) {
    tags.forEach(t => set.add(t))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

/** Origines réellement présentes dans les recettes (triées selon ORIGIN_COUNTRIES) */
const allOrigins = computed(() => {
  const set = new Set<string>()
  for (const o of Object.values(recipeOrigin)) if (o) set.add(o)
  // Trier d'abord dans l'ordre prédéfini (alpha) puis les valeurs libres (alpha)
  const predef = ORIGIN_COUNTRIES.filter(c => set.has(c.value)).map(c => c.value)
  const predefSet = new Set(predef)
  const custom = [...set].filter(v => !predefSet.has(v)).sort((a, b) => a.localeCompare(b))
  return [...predef, ...custom]
})

/** Saisons réellement présentes (dans l'ordre calendaire des SEASONS) */
const allSeasons = computed(() => {
  const set = new Set<string>()
  for (const arr of Object.values(recipeSeasons)) arr.forEach(s => set.add(s))
  return SEASONS.filter(s => set.has(s.value)).map(s => s.value)
})

function toggleTag(tag: string) {
  const idx = activeTags.value.indexOf(tag)
  if (idx >= 0) activeTags.value.splice(idx, 1)
  else activeTags.value.push(tag)
}

function clearTags() {
  activeTags.value = []
}

function toggleSeasonFilter(value: string) {
  const idx = activeSeasons.value.indexOf(value)
  if (idx >= 0) activeSeasons.value.splice(idx, 1)
  else activeSeasons.value.push(value)
}

function clearSeasons() {
  activeSeasons.value = []
}

/** Ferme les dropdowns (tags, saisons) si clic en dehors */
function onDocumentClick(e: MouseEvent) {
  const target = e.target as Node
  if (tagsOpen.value) {
    const el = tagsFilterRef.value
    if (el && !el.contains(target)) tagsOpen.value = false
  }
  if (seasonsOpen.value) {
    const el = seasonsFilterRef.value
    if (el && !el.contains(target)) seasonsOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

// Synchroniser les couleurs de tags dès qu'on découvre de nouveaux tags
watch(allTags, (tags) => {
  if (tags.length) recipes.syncTags(tags)
}, { immediate: true })

/**
 * Toutes les catégories uniques présentes dans le repo, triées selon l'ordre
 * dynamique défini dans les `.category.json` (via `recipes.categoryMap`).
 * Si aucun .category.json n'est configuré, l'ordre legacy est utilisé.
 */
const allCategories = computed(() => {
  const set = new Set<string>()
  for (const r of recipes.recipes) {
    const cat = getCategory(r.path)
    if (cat) set.add(cat)
  }
  return [...set].sort((a, b) => compareCategories(a, b, recipes.categoryMap))
})

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  const maxMinutes = activeDuration.value ? parseInt(activeDuration.value, 10) : 0
  return recipes.recipes
    .filter(r => {
      const displayName = (titles[r.path] || r.name).toLowerCase()
      const matchesSearch = !q || displayName.includes(q) || r.path.toLowerCase().includes(q)
      const matchesTags = activeTags.value.length === 0 ||
        activeTags.value.every(t => (recipeTags[r.path] ?? []).includes(t))
      const matchesCategory = !activeCategory.value || getCategory(r.path) === activeCategory.value
      const matchesDuration = !maxMinutes ||
        (recipeTotalMinutes[r.path] !== undefined && recipeTotalMinutes[r.path] <= maxMinutes)
      const matchesOrigin = !activeOrigin.value || recipeOrigin[r.path] === activeOrigin.value
      // Saisons en OR : au moins une saison sélectionnée doit correspondre
      const matchesSeasons = activeSeasons.value.length === 0 ||
        activeSeasons.value.some(s => (recipeSeasons[r.path] ?? []).includes(s))
      return matchesSearch && matchesTags && matchesCategory && matchesDuration
        && matchesOrigin && matchesSeasons
    })
    .sort((a, b) => {
      if (sortBy.value === 'created' || sortBy.value === 'updated') {
        const map = sortBy.value === 'created' ? recipeCreatedAt : recipeUpdatedAt
        const ta = map[a.path] ?? 0
        const tb = map[b.path] ?? 0
        // Plus récent d'abord ; les recettes sans date vont en bas (fallback nom pour départager)
        if (tb !== ta) return tb - ta
      }
      const nameA = (titles[a.path] || a.name).toLowerCase()
      const nameB = (titles[b.path] || b.name).toLowerCase()
      return nameA.localeCompare(nameB)
    })
})

/** Charge les images : d'abord le cache IndexedDB, puis GitHub si absent */
async function loadImages(list: { path: string }[]) {
  for (const r of list) {
    if (r.path in images) continue
    // Tenter le cache
    const cached = await recipes.getCached(r.path)
    if (cached?.image) {
      images[r.path] = cached.image
      continue
    }
    // Sinon charger depuis GitHub et cacher
    findRecipeImage(r.path).then(url => {
      images[r.path] = url
      if (url) recipes.cacheImage(r.path, url)
    })
  }
}

/** Parse une chaîne de durée type "30 min" / "1 h" / "1h30" → { value, unit } */
function parseDuration(raw: string | undefined): { minutes: number } | null {
  if (!raw) return null
  const s = String(raw).toLowerCase().trim()
  // Format "1h30" ou "1 h 30"
  const hm = s.match(/^(\d+)\s*h\s*(\d+)?\s*(?:min|m)?$/)
  if (hm) {
    const h = parseInt(hm[1], 10)
    const m = hm[2] ? parseInt(hm[2], 10) : 0
    return { minutes: h * 60 + m }
  }
  // Format "30 min" ou "30m"
  const mm = s.match(/^(\d+)\s*(?:min|m)$/)
  if (mm) return { minutes: parseInt(mm[1], 10) }
  // Format "1 heure(s)" / "1 hour(s)"
  const hh = s.match(/^(\d+)\s*(?:heure|hour)s?$/)
  if (hh) return { minutes: parseInt(hh[1], 10) * 60 }
  // Nombre seul → minutes
  const nb = s.match(/^(\d+)$/)
  if (nb) return { minutes: parseInt(nb[1], 10) }
  return null
}

/** Formate une durée en minutes vers un affichage court "1h30" / "45 min" */
function formatMinutes(total: number): string {
  if (total <= 0) return ''
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

/** Retourne le temps total affichable : total explicite OU prep+cook, sinon fallback sur une seule valeur */
function computeTotalTime(summary: any): string {
  if (summary.totalTime) {
    const parsed = parseDuration(summary.totalTime)
    return parsed ? formatMinutes(parsed.minutes) : String(summary.totalTime)
  }
  const prep = parseDuration(summary.prepTime)
  const cook = parseDuration(summary.cookTime)
  if (prep && cook) return formatMinutes(prep.minutes + cook.minutes)
  if (prep) return formatMinutes(prep.minutes)
  if (cook) return formatMinutes(cook.minutes)
  return ''
}

/** Retourne la durée totale en minutes (0 si non calculable), pour filtrage numérique */
function computeTotalMinutes(summary: any): number {
  if (summary.totalTime) {
    const parsed = parseDuration(summary.totalTime)
    if (parsed) return parsed.minutes
  }
  const prep = parseDuration(summary.prepTime)
  const cook = parseDuration(summary.cookTime)
  if (prep && cook) return prep.minutes + cook.minutes
  if (prep) return prep.minutes
  if (cook) return cook.minutes
  return 0
}

/** Parse une date ISO en timestamp (0 si absente/invalide) */
function toTimestamp(iso: string | undefined): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Extrait titre + tags + temps total depuis un parsed recipe */
function extractMeta(path: string, name: string, parsed: any) {
  const summary = getSummary(parsed)
  titles[path] = summary.title || name
  recipeTags[path] = summary.tags || []
  if (summary.origin) recipeOrigin[path] = summary.origin
  else delete recipeOrigin[path]
  recipeSeasons[path] = summary.seasons ?? []
  const total = computeTotalTime(summary)
  if (total) recipeTotalTimes[path] = total
  const minutes = computeTotalMinutes(summary)
  if (minutes > 0) recipeTotalMinutes[path] = minutes
  const created = toTimestamp(summary.createdAt)
  if (created) recipeCreatedAt[path] = created
  const updated = toTimestamp(summary.updatedAt)
  if (updated) recipeUpdatedAt[path] = updated
}

/** Charge les métadonnées (titre + tags) : cache d'abord, puis GitHub */
async function loadMeta(list: { path: string; name: string }[]) {
  for (const r of list) {
    if (r.path in titles && r.path in recipeTags) continue

    // Tenter le store Pinia (parsed)
    const inStore = recipes.getByPath(r.path)
    if (inStore?.parsed) {
      extractMeta(r.path, r.name, inStore.parsed)
      recipes.cacheTitle(r.path, titles[r.path])
      continue
    }
    // Tenter le cache IndexedDB
    const cached = await recipes.getCached(r.path)
    if (cached?.parsedJson) {
      extractMeta(r.path, r.name, JSON.parse(cached.parsedJson))
      continue
    }
    if (cached?.title) {
      titles[r.path] = cached.title
    }
    // Sinon charger depuis GitHub
    fetchRecipeContent(r.path).then(({ content, sha }) => {
      const parsed = parseRecipe(content)
      extractMeta(r.path, r.name, parsed)
      recipes.upsertRecipe({ name: r.name, path: r.path, sha, content, parsed })
    }).catch(() => {
      titles[r.path] = r.name
      recipeTags[r.path] = []
    })
  }
}

onMounted(async () => {
  // Hydrater depuis IndexedDB pour un affichage instantané
  await recipes.hydrate()

  // Rafraîchir les settings de catégories (.category.json) en arrière-plan.
  // Permet de mettre à jour les noms, couleurs et ordre des catégories sans
  // bloquer l'affichage initial (les valeurs du cache IndexedDB sont déjà chargées).
  fetchCategorySettings()
    .then(settings => recipes.setCategorySettings(settings))
    .catch(() => {})

  if (recipes.recipes.length > 0) {
    // Afficher le cache immédiatement
    loadImages(recipes.recipes)
    loadMeta(recipes.recipes)
    // Rafraîchir depuis GitHub en arrière-plan pour détecter les changements
    fetchRecipeList().then(freshList => {
      // Comparer les SHA pour détecter les changements
      const currentPaths = new Set(recipes.recipes.map(r => r.path))
      const freshPaths = new Set(freshList.map(r => r.path))
      const hasChanges =
        freshList.length !== recipes.recipes.length ||
        freshList.some(r => {
          const existing = recipes.getByPath(r.path)
          return !existing || existing.sha !== r.sha
        })

      if (hasChanges) {
        recipes.setRecipes(freshList)
        loadImages(freshList)
        loadMeta(freshList)
      }
    }).catch(() => { /* silencieux en arrière-plan */ })
    return
  }

  // Premier chargement (pas de cache)
  loading.value = true
  error.value = null
  try {
    const list = await fetchRecipeList()
    recipes.setRecipes(list)
    loadImages(list)
    loadMeta(list)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

h1 {
  font-family: var(--font-serif);
  font-size: 1.8rem;
  letter-spacing: -0.01em;
}

.list-count {
  font-size: 0.82rem;
  color: var(--color-muted);
  margin-top: 0.2rem;
}

.btn-new {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--color-sage);
  color: white;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 500;
  text-decoration: none;
  transition: background var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast);
  box-shadow: 0 2px 8px rgba(107, 143, 113, 0.2);
}

.btn-new:hover {
  background: var(--color-sage-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(107, 143, 113, 0.3);
  text-decoration: none;
}

.btn-new-icon {
  font-size: 1.1rem;
  font-weight: 300;
  line-height: 1;
}

/* ── Recherche ── */
.search-wrap {
  position: relative;
  max-width: 460px;
  margin-bottom: 1rem;
}

.search-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-muted);
  pointer-events: none;
}

.search {
  padding-left: 2.5rem;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  width: 100%;
}

/* ── Toolbar filtres + tri ── */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem 1.25rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.toolbar-sort {
  gap: 0.55rem;
}

.toolbar-sort-label {
  font-size: 0.78rem;
  color: var(--color-muted);
  font-weight: 500;
  white-space: nowrap;
}

/* ── Select générique (filtres) ── */
.select-wrap {
  position: relative;
  flex: 0 0 auto;
}

.select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: auto;
  padding: 0.5rem 2rem 0.5rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.select:hover { border-color: var(--color-sage); }
.select:focus {
  outline: none;
  border-color: var(--color-sage);
  box-shadow: 0 0 0 3px rgba(107, 143, 113, 0.15);
}

/* Variante "ghost" pour le tri : plus discret, pas de bordure au repos */
.select--ghost {
  border-color: transparent;
  background: transparent;
  padding-left: 0.35rem;
  color: var(--color-text);
  font-weight: 500;
}

.select--ghost:hover {
  background: var(--color-surface-alt);
  border-color: var(--color-border);
}

.select-chevron {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-muted);
  pointer-events: none;
}

/* Tags filter : bouton dropdown */
.tags-filter-wrap {
  position: relative;
  flex: 0 0 auto;
}

.tags-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.tags-filter-btn:hover { border-color: var(--color-sage); }
.tags-filter-btn--active {
  border-color: var(--color-sage);
  color: var(--color-sage);
}

.tags-filter-count {
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 1.2rem;
  padding: 0.05rem 0.4rem;
  border-radius: 99px;
  background: var(--color-sage);
  color: white;
  text-align: center;
  line-height: 1.3;
}

.tags-filter-chevron {
  color: var(--color-muted);
  transition: transform var(--transition-fast);
}

.tags-filter-chevron--open { transform: rotate(180deg); }

.tags-dropdown {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 20;
  min-width: 260px;
  max-width: 360px;
  max-height: 340px;
  overflow-y: auto;
  padding: 0.85rem;
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.tags-dropdown-list {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.tags-clear {
  align-self: flex-start;
  font-size: 0.75rem;
  color: var(--color-muted);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  transition: color var(--transition-fast);
}
.tags-clear:hover { color: var(--color-accent); }

.tag-filter {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 0.25rem 0.65rem;
  border-radius: 99px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tag-filter:hover {
  border-color: var(--color-sage);
  color: var(--color-sage);
}

.tag-filter--sage { background: var(--color-sage-light); border-color: var(--color-sage); color: var(--color-sage); }
.tag-filter--warm { background: var(--color-warm-light); border-color: var(--color-warm); color: var(--color-warm); }
.tag-filter--accent { background: var(--color-accent-light); border-color: var(--color-accent); color: var(--color-accent); }
.tag-filter--plum { background: var(--color-plum-light); border-color: var(--color-plum); color: var(--color-plum); }
.tag-filter--sky { background: var(--color-sky-light); border-color: var(--color-sky); color: var(--color-sky); }
.tag-filter--rose { background: var(--color-rose-light); border-color: var(--color-rose); color: var(--color-rose); }

/* States */
.state-msg {
  color: var(--color-muted);
  padding: 3rem 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.state-msg--error { color: #c0392b; }

.loader {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Grid */
.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
}

.recipe-card {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  text-decoration: none;
  transition: transform var(--transition-med), box-shadow var(--transition-med), border-color var(--transition-med);
}

.recipe-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-accent);
  text-decoration: none;
}

.card-image-wrap {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--color-surface-alt);
}

.card-category {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: capitalize;
  padding: 0.25rem 0.6rem;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--color-text);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* Drapeau origine — préfixe le nom de la catégorie (ou seul si pas de catégorie) */
.card-category-flag {
  font-size: 0.9rem;
  line-height: 1;
  display: inline-flex;
}

/* Temps total — overlay en desktop (haut-droite), inline en mobile */
.card-time {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 0.25rem 0.55rem;
  border-radius: 99px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  line-height: 1;
}

.card-time--overlay {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  background: rgba(255, 255, 255, 0.92);
  color: var(--color-text);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.card-time--inline {
  display: none;
  padding: 0;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-muted);
  margin-top: 0.1rem;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-med);
}

.recipe-card:hover .card-image {
  transform: scale(1.05);
}

.card-image--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  opacity: 0.4;
}

.card-body {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.card-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text);
  text-transform: capitalize;
}

.card-tags {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.card-tag {
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 0.1rem 0.42rem;
  border-radius: 99px;
  line-height: 1.35;
}

.card-tag--sage { background: var(--color-sage-light); color: var(--color-sage); }
.card-tag--warm { background: var(--color-warm-light); color: var(--color-warm); }
.card-tag--accent { background: var(--color-accent-light); color: var(--color-accent); }
.card-tag--plum { background: var(--color-plum-light); color: var(--color-plum); }
.card-tag--sky { background: var(--color-sky-light); color: var(--color-sky); }
.card-tag--rose { background: var(--color-rose-light); color: var(--color-rose); }

/* === Mobile : layout horizontal compact (image à gauche, infos à droite) === */
@media (max-width: 640px) {
  .recipe-grid {
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }

  .recipe-card {
    flex-direction: row;
    align-items: stretch;
  }

  .recipe-card:hover {
    transform: translateY(-2px);
  }

  .card-image-wrap {
    flex: 0 0 110px;
    aspect-ratio: 1 / 1;
  }

  .card-category {
    top: 0.3rem;
    left: 0.3rem;
    font-size: 0.55rem;
    padding: 0.12rem 0.42rem;
  }

  .card-time--overlay { display: none; }
  .card-time--inline { display: inline-flex; }

  .card-category-flag {
    font-size: 0.75rem;
  }

  .card-body {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0.65rem 0.85rem;
    justify-content: center;
  }

  .card-name {
    font-size: 0.9rem;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-tags {
    margin-top: 0.35rem;
  }
}
</style>
