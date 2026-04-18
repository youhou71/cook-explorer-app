/**
 * Composable Vue pour l'import de recettes depuis une URL externe.
 *
 * Orchestre le flux complet : validation, fetch via proxy CORS,
 * extraction JSON-LD, parsing des ingrédients, génération du .cook.
 */
import { ref } from 'vue'
import {
  extractRecipeJsonLd,
  parseIngredientFR,
  buildCooklangContent,
  type ImportedRecipe,
} from '@/utils/recipeImport'

/** URL du proxy CORS (configurable via env, fallback allorigins). */
const CORS_PROXY_URL =
  import.meta.env.VITE_CORS_PROXY_URL || 'https://api.allorigins.win/raw?url='

export function useRecipeImport() {
  /** Indique si un import est en cours. */
  const importing = ref(false)
  /** Message d'erreur affiché à l'utilisateur, null si OK. */
  const importError = ref<string | null>(null)
  /** Recette brute extraite (pour debug/preview). */
  const importedRaw = ref<ImportedRecipe | null>(null)

  /**
   * Importe une recette depuis une URL et retourne le contenu .cook généré.
   * Retourne `null` en cas d'erreur (le message est dans `importError`).
   */
  async function importFromUrl(url: string): Promise<string | null> {
    importing.value = true
    importError.value = null
    importedRaw.value = null

    try {
      // 1. Validation de l'URL
      let parsedUrl: URL
      try {
        parsedUrl = new URL(url)
      } catch {
        throw new Error('URL invalide. Vérifiez le format.')
      }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('URL invalide. Seuls HTTP et HTTPS sont supportés.')
      }

      // 2. Fetch du HTML via le proxy CORS
      const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(url)}`
      let html: string
      try {
        const response = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        html = await response.text()
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'TimeoutError') {
          throw new Error('Le site met trop de temps à répondre.')
        }
        throw new Error('Impossible de récupérer la page. Vérifiez votre connexion.')
      }

      // 3. Extraction du JSON-LD schema.org/Recipe
      const recipe = extractRecipeJsonLd(html, url)
      if (!recipe) {
        throw new Error('Aucune recette structurée trouvée sur cette page.')
      }
      importedRaw.value = recipe

      // 4. Parsing des ingrédients
      const parsedIngredients = recipe.ingredients.map(parseIngredientFR)

      // 5. Assemblage du .cook
      return buildCooklangContent(recipe, parsedIngredients)
    } catch (e: unknown) {
      importError.value = e instanceof Error ? e.message : 'Erreur inconnue.'
      return null
    } finally {
      importing.value = false
    }
  }

  return { importing, importError, importedRaw, importFromUrl }
}
