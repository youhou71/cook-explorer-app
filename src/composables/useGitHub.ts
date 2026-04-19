/**
 * Composable d'intégration avec l'API GitHub (via Octokit).
 *
 * Toutes les opérations de lecture/écriture sur le repo de recettes passent par
 * ce composable. Il n'y a pas de backend : les appels sont faits directement
 * depuis le navigateur avec le Personal Access Token de l'utilisateur.
 *
 * Fonctionnalités :
 *  - **Recettes** : lister, lire, créer, modifier, supprimer des fichiers .cook
 *  - **Images** : trouver, uploader, supprimer des images associées aux recettes
 *  - **Catégories** : lire et sauvegarder les fichiers `.category.json`
 *  - **Connexion** : tester l'accès au repo
 *
 * Le client Octokit est recréé à chaque changement de token (computed réactif).
 */

import { Octokit } from '@octokit/rest'
import { computed } from 'vue'
import { useGitHubStore } from '@/stores/github'
import type { RecipeFile, CategorySettings } from '@/types'
import { buildCategorySettings } from '@/utils/categories'

/** Encode une chaîne UTF-8 en base64 sans utiliser unescape() (déprécié). */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Réessaie une opération async jusqu'à `maxRetries` fois sur erreur transitoire.
 * Backoff exponentiel : 500ms, 1s, 2s. Ne retente que sur les erreurs réseau,
 * les 5xx et les 429 (rate limit) — les 4xx client sont propagées immédiatement.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      const status = err?.status ?? err?.response?.status
      const isTransient = !status || status >= 500 || status === 429
      if (!isTransient || attempt === maxRetries) throw err
      await new Promise(r => setTimeout(r, 500 * 2 ** attempt))
    }
  }
  throw lastError
}

export function useGitHub() {
  /** Store Pinia contenant la configuration GitHub (token, owner, repo, branch). */
  const store = useGitHubStore()

  /**
   * Wrapper fetch qui bypasse le cache HTTP du navigateur.
   * Sans cela, le navigateur peut servir une réponse cachée pour l'API GitHub
   * (même URL pour git.getTree sur une même branche), ce qui provoque des données
   * périmées (ex : recette supprimée qui réapparaît dans la liste).
   */
  const noCacheFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, cache: 'no-store' })

  /**
   * Client Octokit réactif : recréé automatiquement quand le token change.
   * Null si la configuration est incomplète (pas de token / owner / repo).
   */
  const octokit = computed(() =>
    store.isConfigured
      ? new Octokit({ auth: store.token, request: { fetch: noCacheFetch } })
      : null
  )

  // ── Recettes ─────────────────────────────────────────────────────────────

  /**
   * Récupère la liste de tous les fichiers .cook du repo via l'API Git Tree.
   * L'option `recursive: '1'` permet de scanner toute l'arborescence en un seul appel.
   *
   * @returns Tableau de RecipeFile (sans contenu, juste path + name + sha)
   * @throws Si GitHub n'est pas configuré
   */
  async function fetchRecipeList(): Promise<RecipeFile[]> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    const { data } = await withRetry(() => octokit.value!.rest.git.getTree({
      owner: store.owner,
      repo: store.repo,
      tree_sha: store.branch,
      recursive: '1'
    }))

    return data.tree
      .filter(item => item.type === 'blob' && item.path?.endsWith('.cook'))
      .map(item => ({
        name: item.path!.split('/').pop()!.replace('.cook', ''),
        path: item.path!,
        sha: item.sha!
      }))
  }

  /**
   * Récupère le contenu d'un fichier dans le repo (décode le base64 de l'API GitHub).
   * Utilisé pour lire les .cook et les .category.json.
   *
   * @param path - Chemin du fichier dans le repo
   * @returns Le contenu décodé en UTF-8 et le SHA du fichier
   */
  async function fetchRecipeContent(path: string): Promise<{ content: string; sha: string }> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    const { data } = await withRetry(() => octokit.value!.rest.repos.getContent({
      owner: store.owner,
      repo: store.repo,
      path,
      ref: store.branch
    }))

    if (Array.isArray(data) || data.type !== 'file') {
      throw new Error('Chemin invalide')
    }

    // Décodage base64 → binaire → UTF-8 (gère correctement les caractères accentués)
    const binary = atob(data.content.replace(/\n/g, ''))
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    const content = new TextDecoder('utf-8').decode(bytes)
    return { content, sha: data.sha }
  }

  /**
   * Crée ou met à jour un fichier dans le repo.
   *
   * @param path - Chemin du fichier à créer/modifier
   * @param content - Contenu texte à écrire
   * @param sha - SHA actuel du fichier (requis pour une mise à jour, absent pour une création)
   * @returns Le nouveau SHA du fichier après l'opération
   */
  async function saveRecipe(path: string, content: string, sha?: string): Promise<string> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    const message = sha
      ? `chore: update ${path.split('/').pop()}`
      : `chore: add ${path.split('/').pop()}`

    const { data } = await octokit.value.rest.repos.createOrUpdateFileContents({
      owner: store.owner,
      repo: store.repo,
      path,
      message,
      // Encodage UTF-8 → base64 via TextEncoder (compatible caractères non-ASCII)
      content: utf8ToBase64(content),
      branch: store.branch,
      ...(sha ? { sha } : {})
    })

    return (data.content as any).sha
  }

  /**
   * Supprime un fichier du repo.
   *
   * @param path - Chemin du fichier à supprimer
   * @param sha - SHA actuel du fichier (requis par l'API GitHub)
   */
  async function deleteRecipe(path: string, sha: string): Promise<void> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    await octokit.value.rest.repos.deleteFile({
      owner: store.owner,
      repo: store.repo,
      path,
      message: `chore: delete ${path.split('/').pop()}`,
      sha,
      branch: store.branch
    })
  }

  /**
   * Teste la connexion et les droits d'accès au repo configuré.
   * Effectue un appel GET /repos/:owner/:repo pour vérifier l'authentification.
   */
  async function testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!octokit.value) throw new Error('Paramètres manquants')
      await octokit.value.rest.repos.get({ owner: store.owner, repo: store.repo })
      return { success: true, message: `Connecté à ${store.owner}/${store.repo}` }
    } catch (e: any) {
      return { success: false, message: e.message ?? 'Erreur inconnue' }
    }
  }

  // ── Images ───────────────────────────────────────────────────────────────

  /** Extensions d'images supportées pour la convention de nommage Cooklang. */
  const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

  /** Détermine le type MIME d'une image à partir de son extension. */
  function mimeFromExt(name: string): string {
    const n = name.toLowerCase()
    if (n.endsWith('.png')) return 'image/png'
    if (n.endsWith('.webp')) return 'image/webp'
    return 'image/jpeg'
  }

  /**
   * Cherche une image associée à une recette et retourne ses métadonnées complètes.
   * Convention Cooklang : l'image porte le même nom que le fichier .cook mais avec
   * une extension image (ex : `Crepes.cook` → `Crepes.jpg`).
   *
   * @param cookPath - Chemin du fichier .cook
   * @returns data URI de l'image + path + sha, ou null si aucune image trouvée
   */
  async function findRecipeImageInfo(cookPath: string): Promise<{ dataUri: string; path: string; sha: string } | null> {
    if (!octokit.value) return null

    const basePath = cookPath.replace(/\.cook$/, '')
    const dir = basePath.includes('/') ? basePath.substring(0, basePath.lastIndexOf('/')) : ''

    try {
      // Lister le contenu du dossier pour trouver un fichier image correspondant
      const { data } = await octokit.value.rest.repos.getContent({
        owner: store.owner,
        repo: store.repo,
        path: dir || '.',
        ref: store.branch
      })

      if (!Array.isArray(data)) return null

      const baseName = basePath.split('/').pop()!.toLowerCase()
      const match = data.find(file =>
        file.type === 'file' &&
        IMAGE_EXTENSIONS.some(ext =>
          file.name.toLowerCase() === baseName + ext
        )
      )

      if (!match) return null

      // Récupérer le contenu binaire de l'image via l'API (fonctionne pour les repos privés)
      const { data: fileData } = await octokit.value.rest.repos.getContent({
        owner: store.owner,
        repo: store.repo,
        path: match.path,
        ref: store.branch
      })

      if (Array.isArray(fileData) || fileData.type !== 'file' || !fileData.content) return null

      return {
        dataUri: `data:${mimeFromExt(match.name)};base64,${fileData.content.replace(/\n/g, '')}`,
        path: match.path,
        sha: fileData.sha
      }
    } catch {
      return null
    }
  }

  /**
   * Version simplifiée de `findRecipeImageInfo` qui retourne uniquement le data URI.
   * Pratique quand on a juste besoin d'afficher l'image sans gérer son path/sha.
   */
  async function findRecipeImage(cookPath: string): Promise<string | null> {
    const info = await findRecipeImageInfo(cookPath)
    return info?.dataUri ?? null
  }

  /**
   * Convertit un objet File en chaîne base64 (sans le préfixe `data:...;base64,`).
   * Utilisé pour l'upload d'images via l'API GitHub (qui attend du base64 pur).
   */
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const comma = result.indexOf(',')
        resolve(result.substring(comma + 1))
      }
      reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * Upload ou met à jour l'image associée à une recette sur le repo GitHub.
   *
   * @param cookPath - Chemin du fichier .cook (pour construire le nom de l'image)
   * @param file - Fichier image sélectionné par l'utilisateur
   * @param sha - SHA de l'image existante (pour une mise à jour), absent pour une création
   * @returns Le path, sha et data URI de l'image uploadée
   */
  async function saveRecipeImage(cookPath: string, file: File, sha?: string): Promise<{ path: string; sha: string; dataUri: string }> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    const rawExt = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : ''
    const ext = rawExt === '.jpeg' ? '.jpg' : rawExt
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      throw new Error('Format non supporté (jpg, png, webp uniquement)')
    }

    // Le chemin de l'image suit la convention Cooklang : même base que le .cook + extension image
    const imagePath = cookPath.replace(/\.cook$/, '') + ext
    const base64 = await fileToBase64(file)

    const message = sha
      ? `chore: update image for ${cookPath.split('/').pop()}`
      : `chore: add image for ${cookPath.split('/').pop()}`

    const { data } = await octokit.value.rest.repos.createOrUpdateFileContents({
      owner: store.owner,
      repo: store.repo,
      path: imagePath,
      message,
      content: base64,
      branch: store.branch,
      ...(sha ? { sha } : {})
    })

    return {
      path: imagePath,
      sha: (data.content as any).sha,
      dataUri: `data:${mimeFromExt(imagePath)};base64,${base64}`
    }
  }

  /**
   * Supprime une image du repo par son chemin et SHA.
   */
  async function deleteRecipeImage(path: string, sha: string): Promise<void> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    await octokit.value.rest.repos.deleteFile({
      owner: store.owner,
      repo: store.repo,
      path,
      message: `chore: remove image ${path.split('/').pop()}`,
      sha,
      branch: store.branch
    })
  }

  // ── Catégories ───────────────────────────────────────────────────────────

  /**
   * Récupère les paramètres de toutes les catégories depuis le repo GitHub.
   *
   * Fonctionne en deux temps :
   *  1. Scan de l'arbre Git complet pour trouver les fichiers `.category.json`
   *     situés exactement un niveau sous la racine (ex : `plats/.category.json`).
   *  2. Téléchargement en parallèle du contenu de chaque fichier trouvé,
   *     parsing JSON et construction d'un `CategorySettings` complet avec defaults.
   *
   * Les fichiers malformés ou inaccessibles sont silencieusement ignorés.
   *
   * @returns Tableau de CategorySettings (un par dossier ayant un .category.json)
   */
  async function fetchCategorySettings(): Promise<CategorySettings[]> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    // Récupérer l'arbre complet du repo en un seul appel API
    const { data } = await withRetry(() => octokit.value!.rest.git.getTree({
      owner: store.owner,
      repo: store.repo,
      tree_sha: store.branch,
      recursive: '1'
    }))

    // Filtrer les .category.json situés exactement un niveau sous la racine
    // (path.split('/').length === 2 → "dossier/.category.json")
    const categoryFiles = data.tree.filter(item =>
      item.type === 'blob' &&
      item.path?.endsWith('/.category.json') &&
      item.path.split('/').length === 2
    )

    const results: CategorySettings[] = []

    // Télécharger et parser chaque fichier en parallèle
    await Promise.allSettled(
      categoryFiles.map(async (item) => {
        try {
          const { content, sha: fileSha } = await fetchRecipeContent(item.path!)
          const json = JSON.parse(content)
          const folder = item.path!.split('/')[0]
          results.push(buildCategorySettings(folder, json, fileSha))
        } catch { /* fichier malformé ou inaccessible : ignoré silencieusement */ }
      })
    )

    return results
  }

  /**
   * Sauvegarde les paramètres d'une catégorie en créant/mettant à jour son
   * fichier `.category.json` sur le repo GitHub.
   *
   * Les champs internes (`sha`, `folder`) sont exclus du JSON écrit dans le fichier :
   * seuls les champs de configuration (name, color, order…) sont persistés.
   *
   * @param folder - Nom du dossier de la catégorie (ex : "plats")
   * @param settings - Objet CategorySettings complet (le sha est utilisé pour l'update)
   * @returns Le nouveau SHA du fichier après l'opération
   */
  async function saveCategorySettings(folder: string, settings: CategorySettings): Promise<string> {
    // Exclure les champs internes (sha et folder) du payload JSON
    const { sha: _sha, folder: _folder, ...payload } = settings
    const content = JSON.stringify(payload, null, 2) + '\n'
    return saveRecipe(`${folder}/.category.json`, content, settings.sha)
  }

  return {
    // Recettes
    fetchRecipeList, fetchRecipeContent, saveRecipe, deleteRecipe,
    // Connexion
    testConnection,
    // Images
    findRecipeImage, findRecipeImageInfo, saveRecipeImage, deleteRecipeImage,
    // Catégories
    fetchCategorySettings, saveCategorySettings
  }
}
