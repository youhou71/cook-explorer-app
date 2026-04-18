<template>
  <div class="detail-view" :style="{ '--cat-color': catSettings.color, '--cat-color-light': catSettings.colorSecondary }">
    <div v-if="loading" class="state-msg">
      <div class="loader"></div>
      Chargement...
    </div>
    <div v-else-if="error" class="state-msg state-msg--error">{{ error }}</div>

    <template v-else-if="recipe">
      <!-- Hero image -->
      <div class="hero" :class="{ 'hero--has-image': imageUrl }">
        <img v-if="imageUrl" :src="imageUrl" :alt="title" class="hero-image" />
        <RouterLink to="/recipes" class="back-btn" title="Retour à la liste">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </RouterLink>
        <div class="hero-actions">
          <button class="action-btn" title="Imprimer" @click="printRecipe">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
          <RouterLink :to="`/recipes/${path}/edit`" class="action-btn" title="Modifier">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </RouterLink>
          <button class="action-btn action-btn--danger" title="Supprimer" @click="confirmDelete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <div class="hero-overlay">
          <div class="hero-content">
            <h1>{{ title }}</h1>
            <div class="meta-badges" v-if="summary">
              <span v-if="baseServings" class="badge badge--sage badge--servings">
                👥
                <button class="servings-btn" @click="servings! > 1 && servings!--">−</button>
                <span class="servings-value">{{ servings }}</span>
                <button class="servings-btn" @click="servings!++">+</button>
              </span>
              <span v-if="summary.prepTime" class="badge badge--warm">
                🥘 Prépa {{ summary.prepTime }}
              </span>
              <span v-if="summary.cookTime" class="badge badge--accent">
                🔥 Cuisson {{ summary.cookTime }}
              </span>
              <span v-if="summary.totalTime" class="badge badge--muted">
                ⏱ Total {{ summary.totalTime }}
              </span>
              <span v-if="summary.origin" class="badge badge--origin">
                {{ getOriginMeta(summary.origin).flag }} {{ getOriginMeta(summary.origin).label }}
              </span>
              <span
                v-for="s in summary.seasons"
                :key="s"
                class="badge badge--season"
              >
                {{ getSeasonMeta(s).icon }} {{ getSeasonMeta(s).label }}
              </span>
            </div>
            <div v-if="summary?.tags?.length" class="tags">
              <span
                v-for="tag in summary.tags"
                :key="tag"
                class="tag"
                :class="'tag--' + recipesStore.getTagColor(tag)"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="detail-body">
        <!-- Colonne ingrédients -->
        <aside class="ingredients-panel">
          <h2>Ingrédients</h2>
          <template v-for="(sec, si) in ingredientSections" :key="si">
            <h3 v-if="sec.title" class="ing-section-title">{{ sec.title }}</h3>
            <ul>
              <li v-for="(ing, i) in sec.ingredients" :key="i">
                <span class="ing-dot"></span>
                {{ formatIngredient(ing, ratio) }}
              </li>
            </ul>
          </template>

          <template v-if="parsed?.cookware.length">
            <h2>Matériel</h2>
            <ul>
              <li v-for="(cw, i) in parsed?.cookware" :key="i">
                <span class="ing-dot ing-dot--warm"></span>
                {{ capitalize(cw.name) }}
              </li>
            </ul>
          </template>
        </aside>

        <!-- Étapes -->
        <section class="steps-panel">
          <h2>Préparation</h2>
          <template v-for="(sec, si) in parsed?.sections" :key="si">
            <h3 v-if="sec.title" class="section-title">{{ sec.title }}</h3>
            <ol class="section-ol">
              <li
                v-for="(step, i) in sec.steps"
                :key="i"
                v-html="renderStep(step)"
                class="step"
              />
            </ol>
          </template>
          <div v-if="parsed?.notes?.length" class="notes">
            <div v-for="(note, i) in parsed?.notes" :key="i" class="note">
              <span class="note-icon">💡</span>
              <span>{{ note }}</span>
            </div>
          </div>
          <p v-if="parsed?.metadata?.source" class="source">
            Source :
            <a :href="parsed?.metadata?.source" target="_blank" rel="noopener noreferrer">
              {{ parsed?.metadata?.source }}
            </a>
          </p>

          <p v-if="createdAtLabel || updatedAtLabel" class="dates">
            <span v-if="createdAtLabel">Ajoutée le {{ createdAtLabel }}</span>
            <span v-if="createdAtLabel && updatedAtLabel" class="dates-sep">·</span>
            <span v-if="updatedAtLabel">Modifiée le {{ updatedAtLabel }}</span>
          </p>
        </section>
      </div>
    </template>
  </div>
</template>

<!--
  Vue de détail d'une recette.

  Affiche la recette complète : hero image, badges de métadonnées (portions,
  temps, origine, saisons), panneau d'ingrédients sticky, étapes numérotées
  groupées par section, notes de l'auteur, source et dates.

  Le thème couleur de la page est dynamique : les variables CSS `--cat-color`
  et `--cat-color-light` sont définies inline sur la div racine `.detail-view`
  à partir des settings de la catégorie de la recette (fichier `.category.json`).
  Cela teinte le hero gradient, les numéros d'étape, les bordures de section,
  les puces d'ingrédients, les boutons d'action et les liens source.
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useRecipesStore } from '@/stores/recipes'
import { useGitHub } from '@/composables/useGitHub'
import { useCooklang } from '@/composables/useCooklang'
import { getOriginMeta, getSeasonMeta } from '@/utils/taxonomies'
import type { CooklangRecipe } from '@/types'
import { getCategory } from '@/utils/categories'
const route = useRoute()
const router = useRouter()
const recipesStore = useRecipesStore()
const { fetchRecipeContent, deleteRecipe, findRecipeImage } = useGitHub()
const { parseRecipe, getTitle, getSummary, getBaseServings, formatIngredient, renderStep, capitalize } = useCooklang()

/** Chemin de la recette dans le repo (ex : "plats/poulet-roti.cook") */
const path = computed(() => route.params.path as string)

/**
 * Settings de la catégorie associée à cette recette.
 * Détermine les couleurs du thème de la page (--cat-color, --cat-color-light).
 * Si aucun `.category.json` n'existe, les valeurs par défaut (sage) sont utilisées.
 */
const catSettings = computed(() => recipesStore.getCategorySettings(getCategory(path.value)))

const loading = ref(false)
const error = ref<string | null>(null)
/** Recette parsée par la bibliothèque Cooklang */
const parsed = ref<CooklangRecipe | null>(null)
/** SHA Git du fichier .cook (nécessaire pour les opérations update/delete) */
const sha = ref('')
/** Data URI de l'image hero (null si aucune image) */
const imageUrl = ref<string | null>(null)
/** Nombre de portions actuel (ajustable via les boutons +/−) */
const servings = ref<number | null>(null)

/** Nombre de portions de base (tel que défini dans le frontmatter) */
const baseServings = computed(() =>
  parsed.value ? getBaseServings(parsed.value) : null
)

/**
 * Ratio portions actuelles / portions de base.
 * Utilisé pour recalculer les quantités d'ingrédients proportionnellement.
 */
const ratio = computed(() => {
  if (!baseServings.value || !servings.value) return 1
  return servings.value / baseServings.value
})

/** Titre de la recette (depuis le frontmatter ou le nom de fichier en fallback) */
const title = computed(() =>
  parsed.value ? getTitle(parsed.value, path.value.split('/').pop()!) : ''
)

/** Résumé de la recette (métadonnées extraites du frontmatter + taxonomies) */
const summary = computed(() =>
  parsed.value ? getSummary(parsed.value) : null
)

/** Alias pour le template (v-else-if="recipe" est plus lisible) */
const recipe = computed(() => parsed.value)

/** Formate une date ISO en "12 avril 2026" (format français long). Retourne null si invalide. */
function formatDate(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Date de création formatée pour l'affichage */
const createdAtLabel = computed(() => formatDate(summary.value?.createdAt))
/** Date de modification formatée pour l'affichage */
const updatedAtLabel = computed(() => formatDate(summary.value?.updatedAt))

/** Sections ayant au moins 1 ingrédient (pour le panneau ingrédients latéral) */
const ingredientSections = computed(() =>
  (parsed.value?.sections ?? []).filter(s => s.ingredients.length > 0)
)

/** Met à jour le titre du navigateur avec le nom de la recette */
const defaultTitle = document.title
watch(title, (t) => {
  if (t) document.title = `${t} | CookExplorer`
}, { immediate: true })
onUnmounted(() => {
  document.title = defaultTitle
})

/**
 * Chargement initial de la recette au montage du composant.
 * Stratégie : cache IndexedDB d'abord (affichage instantané), puis GitHub si nécessaire.
 * L'image est chargée en parallèle avec une cascade de fallbacks :
 *   1. Cache IndexedDB (data URI stocké)
 *   2. Métadonnée `image` du frontmatter
 *   3. Convention Cooklang (même nom que le .cook avec extension image)
 */
onMounted(async () => {
  loading.value = true
  error.value = null
  try {
    await recipesStore.hydrate()

    // Tenter de charger depuis le cache Pinia (hydraté depuis IndexedDB)
    const cached = recipesStore.getByPath(path.value)
    if (cached?.content) {
      parsed.value = parseRecipe(cached.content)
      sha.value = cached.sha
    } else {
      // Sinon, télécharger depuis GitHub
      const { content, sha: fileSha } = await fetchRecipeContent(path.value)
      sha.value = fileSha
      parsed.value = parseRecipe(content)
      recipesStore.upsertRecipe({
        name: path.value.split('/').pop()!.replace('.cook', ''),
        path: path.value,
        content,
        sha: fileSha,
        parsed: parsed.value,
      })
    }

    // Initialiser le compteur de portions
    servings.value = getBaseServings(parsed.value!)

    // Résolution de l'image hero (cascade de fallbacks)
    const cachedEntry = await recipesStore.getCached(path.value)
    if (cachedEntry?.image) {
      imageUrl.value = cachedEntry.image
    } else if (parsed.value?.metadata?.image) {
      imageUrl.value = parsed.value.metadata.image
      recipesStore.cacheImage(path.value, parsed.value.metadata.image)
    } else {
      const img = await findRecipeImage(path.value)
      imageUrl.value = img
      if (img) recipesStore.cacheImage(path.value, img)
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

/** Ouvre la boîte de dialogue d'impression du navigateur */
function printRecipe() {
  window.print()
}

/** Demande confirmation puis supprime la recette du repo et du cache local */
async function confirmDelete() {
  if (!confirm(`Supprimer "${title.value}" ?`)) return
  try {
    await deleteRecipe(path.value, sha.value)
    await recipesStore.removeRecipe(path.value)
    router.push('/recipes')
  } catch (e: any) {
    alert(`Erreur : ${e.message}`)
  }
}
</script>

<style scoped>
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

/* Hero */
.hero {
  position: relative;
  border-radius: var(--radius-xl);
  overflow: hidden;
  margin-bottom: 1.5rem;
  min-height: 120px;
  background: linear-gradient(135deg, var(--cat-color-light) 0%, var(--color-surface) 100%);
}

.hero--has-image {
  min-height: 320px;
}

.hero-image {
  width: 100%;
  height: 320px;
  object-fit: cover;
  display: block;
}

.hero-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2rem 2rem 1.5rem;
  background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%);
}

.hero:not(.hero--has-image) .hero-overlay {
  position: relative;
  background: none;
  padding: 2.5rem 2rem 2rem;
}

h1 {
  font-family: var(--font-serif);
  font-size: 2rem;
  margin-bottom: 0.75rem;
  letter-spacing: -0.01em;
}

.hero--has-image h1 {
  color: white;
  text-shadow: 0 1px 8px rgba(0,0,0,0.3);
}

/* Meta badges */
.meta-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.75rem;
  border-radius: 99px;
  font-size: 0.78rem;
  font-weight: 500;
  backdrop-filter: blur(4px);
}

.hero--has-image .badge {
  background: rgba(255,255,255,0.2);
  color: white;
}

.hero:not(.hero--has-image) .badge--sage {
  background: var(--color-sage-light);
  color: var(--color-sage);
}

.hero:not(.hero--has-image) .badge--warm {
  background: var(--color-warm-light);
  color: var(--color-warm);
}

.hero:not(.hero--has-image) .badge--accent {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.hero:not(.hero--has-image) .badge--muted {
  background: var(--color-surface-alt);
  color: var(--color-muted);
}

.hero:not(.hero--has-image) .badge--origin {
  background: var(--color-plum-light);
  color: var(--color-plum);
}

.hero:not(.hero--has-image) .badge--season {
  background: var(--color-sky-light);
  color: var(--color-sky);
}

/* Tags */
.tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.6rem;
}

.tag {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.25rem 0.7rem;
  border-radius: 99px;
  border: 1.5px solid;
}

.tag--sage {
  background: var(--color-sage-light);
  color: var(--color-sage);
  border-color: var(--color-sage);
}

.tag--warm {
  background: var(--color-warm-light);
  color: var(--color-warm);
  border-color: var(--color-warm);
}

.tag--accent {
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.tag--plum {
  background: var(--color-plum-light);
  color: var(--color-plum);
  border-color: var(--color-plum);
}

.tag--sky {
  background: var(--color-sky-light);
  color: var(--color-sky);
  border-color: var(--color-sky);
}

.tag--rose {
  background: var(--color-rose-light);
  color: var(--color-rose);
  border-color: var(--color-rose);
}

/* Servings selector */
.badge--servings {
  gap: 0.3rem;
  padding: 0.25rem 0.5rem;
}

.servings-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1;
  border: none;
  padding: 0;
}

.hero--has-image .servings-btn {
  background: rgba(255,255,255,0.25);
  color: white;
}

.hero--has-image .servings-btn:hover {
  background: rgba(255,255,255,0.45);
}

.hero:not(.hero--has-image) .servings-btn {
  background: var(--cat-color);
  color: white;
}

.hero:not(.hero--has-image) .servings-btn:hover {
  background: color-mix(in srgb, var(--cat-color) 80%, black);
}

.servings-value {
  min-width: 1.2em;
  text-align: center;
  font-weight: 600;
}

/* Back button */
.back-btn {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  text-decoration: none;
  transition: all var(--transition-fast);
  background: rgba(255, 255, 255, 0.85);
  color: var(--color-muted);
  backdrop-filter: blur(8px);
}

.hero:not(.hero--has-image) .back-btn {
  background: var(--color-surface-alt);
}

.back-btn:hover {
  background: white;
  color: var(--color-text);
  transform: scale(1.1);
  text-decoration: none;
}

/* Hero actions — bandeau groupé */
.hero-actions {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  display: flex;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 99px;
  overflow: hidden;
}

.hero:not(.hero--has-image) .hero-actions {
  background: var(--color-surface-alt);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 34px;
  border: none;
  border-radius: 0;
  cursor: pointer;
  text-decoration: none;
  transition: color var(--transition-fast), background var(--transition-fast);
  background: none;
  color: var(--color-muted);
}

.action-btn:hover {
  color: var(--cat-color);
  background: rgba(0, 0, 0, 0.06);
  text-decoration: none;
}

.action-btn--danger:hover {
  color: #e74c3c;
}

.action-btn + .action-btn {
  border-left: 1px solid rgba(0, 0, 0, 0.12);
}

.hero:not(.hero--has-image) .action-btn + .action-btn {
  border-left-color: var(--color-border);
}

/* Body */
.detail-body {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 2.5rem;
}

@media (max-width: 640px) {
  .detail-body { grid-template-columns: 1fr; }

  /* Hero mobile : image pleine largeur, contenu en dessous */
  .hero {
    margin: -2rem -1.5rem 1rem;
    border-radius: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  .hero--has-image { min-height: 0; }

  .hero-image {
    order: 1;
    width: 100%;
    height: 250px;
    flex-shrink: 0;
  }

  .hero-overlay {
    order: 4;
    position: relative;
    width: 100%;
    background: none;
    padding: 0.75rem 1.5rem 1rem;
  }

  .hero:not(.hero--has-image) .hero-overlay {
    padding-top: 0;
  }

  h1 { font-size: 1.6rem; }

  .hero--has-image h1 {
    color: var(--color-text);
    text-shadow: none;
  }

  .badge { backdrop-filter: none; }

  .hero--has-image .badge {
    background: var(--color-surface-alt);
    color: var(--color-text);
  }

  .hero--has-image .badge--sage {
    background: var(--color-sage-light);
    color: var(--color-sage);
  }

  .hero--has-image .badge--warm {
    background: var(--color-warm-light);
    color: var(--color-warm);
  }

  .hero--has-image .badge--accent {
    background: var(--color-accent-light);
    color: var(--color-accent);
  }

  .hero--has-image .badge--muted {
    background: var(--color-surface-alt);
    color: var(--color-muted);
  }

  .hero--has-image .badge--origin {
    background: var(--color-plum-light);
    color: var(--color-plum);
  }

  .hero--has-image .badge--season {
    background: var(--color-sky-light);
    color: var(--color-sky);
  }

  .hero--has-image .servings-btn {
    background: var(--cat-color);
    color: white;
  }

  .hero--has-image .servings-btn:hover {
    background: color-mix(in srgb, var(--cat-color) 80%, black);
  }
}

/* Ingrédients */
.ingredients-panel {
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  align-self: start;
}

/* Sticky uniquement en desktop (colonne latérale) */
@media (min-width: 641px) {
  .ingredients-panel {
    position: sticky;
    top: 70px;
  }
}

h2 {
  font-family: var(--font-serif);
  font-size: 1rem;
  margin-bottom: 0.75rem;
  font-style: italic;
  color: var(--color-muted);
}

.ingredients-panel ul {
  list-style: none;
  margin-bottom: 1.5rem;
}

/* Titre de section dans la liste d'ingrédients */
.ing-section-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.88rem;
  color: var(--color-text);
  margin-top: 0.85rem;
  margin-bottom: 0.45rem;
  padding-left: 0.5rem;
  border-left: 2.5px solid var(--cat-color);
  font-weight: 500;
}

.ing-section-title:first-of-type {
  margin-top: 0;
}

.ingredients-panel ul + .ing-section-title {
  margin-top: 1rem;
}

.ingredients-panel li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.88rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--color-border);
}

.ingredients-panel li:last-child {
  border-bottom: none;
}

.ing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cat-color);
  flex-shrink: 0;
}

.ing-dot--warm {
  background: var(--color-warm);
}

/* Étapes */
.steps-panel ol {
  list-style: none;
  counter-reset: step;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Titre de section ("= ..." dans le .cook) */
.section-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.05rem;
  color: var(--color-text);
  margin-top: 1.75rem;
  margin-bottom: 0.85rem;
  padding-left: 0.6rem;
  border-left: 3px solid var(--cat-color);
}

.section-title:first-of-type {
  margin-top: 0.25rem;
}

/* Deux sections sans titre collées : on les sépare visuellement */
.section-ol + .section-ol {
  margin-top: 1.75rem;
}

.step {
  counter-increment: step;
  padding-left: 3rem;
  position: relative;
  line-height: 1.75;
  font-size: 0.95rem;
}

.step::before {
  content: counter(step);
  position: absolute;
  left: 0;
  top: 2px;
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, var(--cat-color) 0%, color-mix(in srgb, var(--cat-color) 60%, var(--color-warm)) 100%);
  color: white;
  border-radius: 50%;
  font-size: 0.78rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Notes */
.notes {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.note {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  background: var(--color-warm-light);
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--color-text);
}

.note-icon {
  flex-shrink: 0;
  font-size: 1rem;
}

/* Source */
.source {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
  font-size: 0.82rem;
  color: var(--color-muted);
}

.source a {
  color: var(--cat-color);
  word-break: break-all;
}

.source a:hover {
  text-decoration: underline;
}

/* Dates création / modification */
.dates {
  margin-top: 1rem;
  font-size: 0.75rem;
  color: var(--color-muted);
  font-style: italic;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.dates-sep {
  opacity: 0.6;
}

/* ───────────────────────── IMPRESSION (A4 portrait) ───────────────────────── */
@media print {
  /* ── Masquer uniquement les éléments interactifs inutiles sur papier ── */
  .hero-actions,
  .back-btn,
  .servings-btn,
  .source,
  .dates {
    display: none !important;
  }

  /* ── Texte justifié avec césure automatique pour les étapes ── */
  .step {
    text-align: justify;
    hyphens: auto;
    -webkit-hyphens: auto;
  }

  /* ── Hero ── */
  .hero {
    /* Hauteur limitée pour laisser de la place à la recette sur la 1re page */
    min-height: 0 !important;
    margin-bottom: 1rem;
  }

  .hero--has-image {
    min-height: 8cm;
  }

  .hero-image {
    height: 8cm;
  }

  /* ── Layout : bascule grid → block + float pour permettre le page-break
     (Chrome/Firefox traitent le grid comme atomique à l'impression et
     poussent tout le body sur la page suivante s'il ne tient pas en entier) ── */
  .detail-body {
    display: block !important;
  }

  /* ── Ingrédients : flottent à gauche, le texte des étapes coule à droite
     puis en dessous si les ingrédients sont plus courts ── */
  .ingredients-panel {
    position: static !important;
    float: left;
    width: 6cm;
    margin: 0 0.8cm 0.8rem 0;
    padding: 1rem;
  }

  /* ── Étapes : flow normal, coulent à droite du float puis reprennent
     la pleine largeur une fois les ingrédients passés ── */

  h2 {
    page-break-after: avoid;
    break-after: avoid;
  }

  .ing-section-title,
  .section-title {
    page-break-after: avoid;
    break-after: avoid;
  }

  /* ── Étapes : éviter les coupures au milieu ── */
  .step {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* ── Notes : ne pas couper ── */
  .note {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* ── Liens en noir (ne pas imprimer en orange vif) ── */
  .source a {
    color: var(--color-text);
  }
}
</style>
