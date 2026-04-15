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

    <div class="search-bar">
      <div class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input v-model="search" placeholder="Rechercher une recette..." class="search" />
      </div>
      <div v-if="allCategories.length" class="category-filter-wrap">
        <select v-model="activeCategory" class="category-select">
          <option value="">Toutes les catégories</option>
          <option v-for="cat in allCategories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <svg class="category-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="category-filter-wrap">
        <select v-model="activeDuration" class="category-select">
          <option value="">Toutes les durées</option>
          <option value="15">Moins de 15 min</option>
          <option value="30">Moins de 30 min</option>
          <option value="60">Moins de 1 h</option>
          <option value="120">Moins de 2 h</option>
        </select>
        <svg class="category-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="category-filter-wrap">
        <select v-model="sortBy" class="category-select">
          <option value="name">Trier : Nom (A-Z)</option>
          <option value="created">Trier : Ajout récent</option>
          <option value="updated">Trier : Modification récente</option>
        </select>
        <svg class="category-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
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
            :src="images[r.path]"
            :alt="r.name"
            class="card-image"
          />
          <div v-else class="card-image card-image--placeholder">
            <span>🍽</span>
          </div>
          <span v-if="getCategory(r.path)" class="card-category">{{ getCategory(r.path) }}</span>
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

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useRecipesStore } from '@/stores/recipes'
import { useGitHub } from '@/composables/useGitHub'
import { useCooklang } from '@/composables/useCooklang'
import { compareCategories } from '@/utils/categories'

const recipes = useRecipesStore()
const { fetchRecipeList, fetchRecipeContent, findRecipeImage } = useGitHub()
const { parseRecipe, getTitle, getSummary } = useCooklang()

const images = reactive<Record<string, string | null>>({})
const titles = reactive<Record<string, string>>({})
const recipeTags = reactive<Record<string, string[]>>({})
const recipeTotalTimes = reactive<Record<string, string>>({})
const recipeTotalMinutes = reactive<Record<string, number>>({})
const recipeCreatedAt = reactive<Record<string, number>>({})
const recipeUpdatedAt = reactive<Record<string, number>>({})
const activeTags = ref<string[]>([])
const activeCategory = ref('')
const activeDuration = ref('')
const sortBy = ref<'name' | 'created' | 'updated'>('name')
const tagsOpen = ref(false)
const tagsFilterRef = ref<HTMLElement | null>(null)

const loading = ref(false)
const error = ref<string | null>(null)
const search = ref('')

/** Tous les tags uniques trouvés, triés alphabétiquement */
const allTags = computed(() => {
  const set = new Set<string>()
  for (const tags of Object.values(recipeTags)) {
    tags.forEach(t => set.add(t))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

function toggleTag(tag: string) {
  const idx = activeTags.value.indexOf(tag)
  if (idx >= 0) activeTags.value.splice(idx, 1)
  else activeTags.value.push(tag)
}

function clearTags() {
  activeTags.value = []
}

/** Ferme le dropdown tags si clic en dehors */
function onDocumentClick(e: MouseEvent) {
  if (!tagsOpen.value) return
  const el = tagsFilterRef.value
  if (el && !el.contains(e.target as Node)) {
    tagsOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

// Synchroniser les couleurs de tags dès qu'on découvre de nouveaux tags
watch(allTags, (tags) => {
  if (tags.length) recipes.syncTags(tags)
}, { immediate: true })

/** Extrait le type de plat (= premier dossier du path) */
function getCategory(path: string): string {
  const idx = path.indexOf('/')
  return idx === -1 ? '' : path.substring(0, idx)
}

/** Toutes les catégories uniques, triées selon l'ordre de priorité */
const allCategories = computed(() => {
  const set = new Set<string>()
  for (const r of recipes.recipes) {
    const cat = getCategory(r.path)
    if (cat) set.add(cat)
  }
  return [...set].sort(compareCategories)
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
      return matchesSearch && matchesTags && matchesCategory && matchesDuration
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

/* Search + filtre catégorie */
.search-bar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: stretch;
  margin-bottom: 2rem;
}

.search-wrap {
  position: relative;
  flex: 1 1 280px;
  max-width: 400px;
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

.category-filter-wrap {
  position: relative;
  flex: 0 0 auto;
  min-width: 180px;
}

.category-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: 100%;
  padding: 0.55rem 2.2rem 0.55rem 0.95rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.88rem;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.category-select:hover { border-color: var(--color-sage); }
.category-select:focus {
  outline: none;
  border-color: var(--color-sage);
  box-shadow: 0 0 0 3px rgba(107, 143, 113, 0.15);
}

.category-chevron {
  position: absolute;
  right: 0.85rem;
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
  padding: 0.55rem 0.85rem 0.55rem 0.85rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.88rem;
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
