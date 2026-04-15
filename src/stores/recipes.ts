import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { RecipeFile } from '@/types'
import { useRecipeCache, type CachedTag } from '@/composables/useRecipeCache'

export const useRecipesStore = defineStore('recipes', () => {
  const recipes = ref<RecipeFile[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hydrated = ref(false)

  // Map réactive tag → couleur, accessible partout
  const tagColors = reactive<Record<string, string>>({})

  const cache = useRecipeCache()

  /** Hydrate le store depuis IndexedDB au démarrage */
  async function hydrate() {
    if (hydrated.value) return
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
    // Charger les tags
    const tags = await cache.getAllTags()
    for (const t of tags) {
      tagColors[t.name] = t.color
    }
    hydrated.value = true
  }

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

  function removeRecipe(path: string) {
    recipes.value = recipes.value.filter(r => r.path !== path)
    cache.deleteRecipe(path)
  }

  function getByPath(path: string) {
    return recipes.value.find(r => r.path === path)
  }

  function cacheImage(path: string, dataUri: string | null) {
    cache.putRecipe({ path, image: dataUri })
  }

  function cacheTitle(path: string, title: string) {
    cache.putRecipe({ path, title })
  }

  async function getCached(path: string) {
    return cache.getRecipe(path)
  }

  async function getAllCached() {
    return cache.getAllRecipes()
  }

  /** Synchronise les tags avec IndexedDB et met à jour tagColors */
  async function syncTags(allTagNames: string[]) {
    const synced = await cache.syncTags(allTagNames)
    // Reset et repeupler
    for (const key of Object.keys(tagColors)) {
      if (!synced.find(t => t.name === key)) delete tagColors[key]
    }
    for (const t of synced) {
      tagColors[t.name] = t.color
    }
  }

  /** Retourne la couleur d'un tag, avec fallback */
  function getTagColor(tag: string): string {
    return tagColors[tag] ?? 'sage'
  }

  return {
    recipes, loading, error, hydrated, tagColors,
    hydrate, setRecipes, upsertRecipe, removeRecipe, getByPath,
    cacheImage, cacheTitle, getCached, getAllCached,
    syncTags, getTagColor
  }
})
