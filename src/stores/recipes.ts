/**
 * Store Pinia central pour les recettes, tags et catégories.
 *
 * Ce store joue le rôle de couche mémoire réactive entre l'IndexedDB (persistance
 * locale) et les vues Vue. Il est hydraté au démarrage depuis IndexedDB pour un
 * affichage instantané, puis mis à jour en arrière-plan depuis GitHub.
 *
 * Responsabilités :
 *  - **Recettes** : cache en mémoire de tous les RecipeFile (path, sha, contenu,
 *    parsé). CRUD synchronisé avec IndexedDB.
 *  - **Tags** : association tag → couleur (palette de 6 couleurs). Synchronisation
 *    avec IndexedDB via round-robin équilibré.
 *  - **Catégories** : paramètres de personnalisation par type de plat (couleur,
 *    icône, ordre…). Map réactive `folder → CategorySettings` pour un accès O(1).
 *
 * Le flag `hydrated` empêche les hydratations multiples (idempotent).
 */

import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import type { RecipeFile, CategorySettings } from '@/types'
import { useRecipeCache, type CachedTag } from '@/composables/useRecipeCache'
import { defaultCategorySettings } from '@/utils/categories'

export const useRecipesStore = defineStore('recipes', () => {
  /** Liste de toutes les recettes connues (cache mémoire). */
  const recipes = ref<RecipeFile[]>([])
  /** Indicateur de chargement (utilisé par les vues pour afficher un spinner). */
  const loading = ref(false)
  /** Message d'erreur global (null si aucune erreur). */
  const error = ref<string | null>(null)
  /** Flag d'hydratation : true une fois que le store a été chargé depuis IndexedDB. */
  const hydrated = ref(false)

  /** Map réactive tag → clé de couleur du thème ('sage', 'warm', 'accent'…). */
  const tagColors = reactive<Record<string, string>>({})

  // ── Catégories ───────────────────────────────────────────────────────────

  /** Liste brute des settings de catégories chargés depuis le cache ou GitHub. */
  const categorySettings = ref<CategorySettings[]>([])

  /**
   * Map réactive `folder → CategorySettings` pour un accès O(1) par nom de dossier.
   * Recalculée automatiquement quand `categorySettings` change.
   */
  const categoryMap = computed(() => {
    const map = new Map<string, CategorySettings>()
    for (const cat of categorySettings.value) {
      map.set(cat.folder, cat)
    }
    return map
  })

  /**
   * Retourne les settings d'une catégorie par nom de dossier.
   * Si la catégorie n'a pas de `.category.json`, retourne un objet avec les
   * valeurs par défaut (couleur sage, icône 📁, nom = nom du dossier).
   *
   * @param folder - Nom du dossier (ex : "plats", "desserts")
   */
  function getCategorySettings(folder: string): CategorySettings {
    return categoryMap.value.get(folder) ?? defaultCategorySettings(folder)
  }

  /**
   * Met à jour la liste des catégories en mémoire et persiste dans IndexedDB.
   * Appelé après un fetch depuis GitHub ou après la sauvegarde depuis la page /categories.
   */
  function setCategorySettings(settings: CategorySettings[]) {
    categorySettings.value = settings
    cache.putManyCategories(settings)
  }

  // ── Cache IndexedDB ──────────────────────────────────────────────────────

  /** Instance du composable de cache IndexedDB. */
  const cache = useRecipeCache()

  /**
   * Hydrate le store depuis IndexedDB au démarrage de l'application.
   * Charge les recettes, catégories et tags en mémoire pour un affichage instantané.
   * Idempotent : ne s'exécute qu'une seule fois grâce au flag `hydrated`.
   */
  async function hydrate() {
    if (hydrated.value) return

    // Charger les recettes depuis le cache
    const cached = await cache.getAllRecipes()
    if (cached.length) {
      recipes.value = cached.map(c => ({
        name: c.name,
        path: c.path,
        sha: c.sha,
        content: c.content,
        parsed: c.parsedJson ? JSON.parse(c.parsedJson) : undefined
      }))
    }

    // Charger les catégories depuis le cache
    const cats = await cache.getAllCategories()
    if (cats.length) {
      categorySettings.value = cats
    }

    // Charger les tags depuis le cache
    const tags = await cache.getAllTags()
    for (const t of tags) {
      tagColors[t.name] = t.color
    }

    hydrated.value = true
  }

  // ── CRUD Recettes ────────────────────────────────────────────────────────

  /**
   * Remplace entièrement la liste des recettes et persiste dans IndexedDB.
   * Utilisé après un fetch complet depuis GitHub.
   */
  function setRecipes(list: RecipeFile[]) {
    recipes.value = list
    cache.putMany(list.map(r => ({
      path: r.path,
      name: r.name,
      sha: r.sha,
      content: r.content,
      parsedJson: r.parsed ? JSON.stringify(r.parsed) : undefined
    })))
  }

  /**
   * Ajoute ou met à jour une recette individuelle (mémoire + IndexedDB).
   * Si le path existe déjà, l'entrée est remplacée ; sinon, elle est ajoutée.
   */
  function upsertRecipe(recipe: RecipeFile) {
    const idx = recipes.value.findIndex(r => r.path === recipe.path)
    if (idx >= 0) {
      recipes.value[idx] = recipe
    } else {
      recipes.value.push(recipe)
    }
    cache.putRecipe({
      path: recipe.path,
      name: recipe.name,
      sha: recipe.sha,
      content: recipe.content,
      parsedJson: recipe.parsed ? JSON.stringify(recipe.parsed) : undefined
    })
  }

  /**
   * Supprime une recette par son path (mémoire + IndexedDB).
   * Async pour garantir que le cache IndexedDB est bien purgé avant
   * toute navigation — évite qu'un rechargement ne restaure la recette.
   */
  async function removeRecipe(path: string) {
    recipes.value = recipes.value.filter(r => r.path !== path)
    await cache.deleteRecipe(path)
  }

  /** Recherche une recette en mémoire par son path. */
  function getByPath(path: string) {
    return recipes.value.find(r => r.path === path)
  }

  // ── Cache images et titres ───────────────────────────────────────────────

  /** Stocke un data URI d'image dans le store IndexedDB dédié aux images. */
  function cacheImage(path: string, dataUri: string | null) {
    cache.putImage(path, dataUri)
  }

  /** Lit le data URI d'une image depuis le store IndexedDB dédié. */
  async function getCachedImage(path: string): Promise<string | null> {
    return cache.getImage(path)
  }

  /** Stocke le titre d'une recette dans le cache IndexedDB (pour affichage rapide en liste). */
  function cacheTitle(path: string, title: string) {
    cache.putRecipe({ path, title })
  }

  /** Lit une entrée complète du cache IndexedDB par son path. */
  async function getCached(path: string) {
    return cache.getRecipe(path)
  }

  /** Lit toutes les entrées du cache IndexedDB. */
  async function getAllCached() {
    return cache.getAllRecipes()
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  /**
   * Synchronise les couleurs de tags avec la liste actuelle des noms de tags.
   * Supprime les tags obsolètes et attribue des couleurs aux nouveaux.
   */
  async function syncTags(allTagNames: string[]) {
    const synced = await cache.syncTags(allTagNames)
    // Supprimer les tags qui n'existent plus
    for (const key of Object.keys(tagColors)) {
      if (!synced.find(t => t.name === key)) delete tagColors[key]
    }
    // Mettre à jour les couleurs
    for (const t of synced) {
      tagColors[t.name] = t.color
    }
  }

  /**
   * Retourne la clé de couleur du thème pour un tag donné.
   * Fallback sur 'sage' si le tag n'est pas dans la map (ne devrait pas arriver
   * après une synchronisation, mais protège contre les cas limites).
   */
  function getTagColor(tag: string): string {
    return tagColors[tag] ?? 'sage'
  }

  return {
    // State
    recipes, loading, error, hydrated, tagColors,
    categorySettings, categoryMap,
    // Actions
    hydrate, setRecipes, upsertRecipe, removeRecipe, getByPath,
    cacheImage, getCachedImage, cacheTitle, getCached, getAllCached,
    syncTags, getTagColor,
    getCategorySettings, setCategorySettings
  }
})
