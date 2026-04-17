import { Octokit } from '@octokit/rest'
import { computed } from 'vue'
import { useGitHubStore } from '@/stores/github'
import type { RecipeFile, CategorySettings } from '@/types'
import { buildCategorySettings } from '@/utils/categories'

export function useGitHub() {
  const store = useGitHubStore()

  const octokit = computed(() =>
    store.isConfigured
      ? new Octokit({ auth: store.token })
      : null
  )

  /**
   * Récupère récursivement tous les fichiers .cook du repo
   */
  async function fetchRecipeList(): Promise<RecipeFile[]> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    const { data } = await octokit.value.rest.git.getTree({
      owner: store.owner,
      repo: store.repo,
      tree_sha: store.branch,
      recursive: '1'
    })

    return data.tree
      .filter(item => item.type === 'blob' && item.path?.endsWith('.cook'))
      .map(item => ({
        name: item.path!.split('/').pop()!.replace('.cook', ''),
        path: item.path!,
        sha: item.sha!
      }))
  }

  /**
   * Récupère le contenu d'un fichier .cook
   */
  async function fetchRecipeContent(path: string): Promise<{ content: string; sha: string }> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    const { data } = await octokit.value.rest.repos.getContent({
      owner: store.owner,
      repo: store.repo,
      path,
      ref: store.branch
    })

    if (Array.isArray(data) || data.type !== 'file') {
      throw new Error('Chemin invalide')
    }

    const binary = atob(data.content.replace(/\n/g, ''))
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    const content = new TextDecoder('utf-8').decode(bytes)
    return { content, sha: data.sha }
  }

  /**
   * Crée ou met à jour un fichier .cook
   * Si sha est fourni → mise à jour, sinon → création
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
      content: btoa(unescape(encodeURIComponent(content))),
      branch: store.branch,
      ...(sha ? { sha } : {})
    })

    return (data.content as any).sha
  }

  /**
   * Supprime un fichier .cook
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
   * Teste la connexion et les droits d'accès au repo
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

  const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

  function mimeFromExt(name: string): string {
    const n = name.toLowerCase()
    if (n.endsWith('.png')) return 'image/png'
    if (n.endsWith('.webp')) return 'image/webp'
    return 'image/jpeg'
  }

  /**
   * Cherche une image associée à une recette .cook et retourne ses infos complètes
   */
  async function findRecipeImageInfo(cookPath: string): Promise<{ dataUri: string; path: string; sha: string } | null> {
    if (!octokit.value) return null

    const basePath = cookPath.replace(/\.cook$/, '')
    const dir = basePath.includes('/') ? basePath.substring(0, basePath.lastIndexOf('/')) : ''

    try {
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

      // Récupérer l'image via l'API (fonctionne pour les repos privés)
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
   * Cherche une image associée à une recette .cook dans le repo
   * Convention cooklang : même nom que le fichier, extension image
   * Ex : recettes/Crepes.cook → recettes/Crepes.jpg
   */
  async function findRecipeImage(cookPath: string): Promise<string | null> {
    const info = await findRecipeImageInfo(cookPath)
    return info?.dataUri ?? null
  }

  /**
   * Lit un fichier en base64 (sans le préfixe data:...)
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
   * Upload ou met à jour l'image associée à une recette.
   * Si sha fourni → update, sinon → create.
   */
  async function saveRecipeImage(cookPath: string, file: File, sha?: string): Promise<{ path: string; sha: string; dataUri: string }> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    const rawExt = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : ''
    const ext = rawExt === '.jpeg' ? '.jpg' : rawExt
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      throw new Error('Format non supporté (jpg, png, webp uniquement)')
    }

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
   * Supprime une image (par chemin + sha)
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

  async function fetchCategorySettings(): Promise<CategorySettings[]> {
    if (!octokit.value) throw new Error('GitHub non configuré')

    const { data } = await octokit.value.rest.git.getTree({
      owner: store.owner,
      repo: store.repo,
      tree_sha: store.branch,
      recursive: '1'
    })

    const categoryFiles = data.tree.filter(item =>
      item.type === 'blob' &&
      item.path?.endsWith('/.category.json') &&
      item.path.split('/').length === 2
    )

    const results: CategorySettings[] = []

    await Promise.allSettled(
      categoryFiles.map(async (item) => {
        try {
          const { content, sha: fileSha } = await fetchRecipeContent(item.path!)
          const json = JSON.parse(content)
          const folder = item.path!.split('/')[0]
          results.push(buildCategorySettings(folder, json, fileSha))
        } catch { /* fichier malformé : ignoré */ }
      })
    )

    return results
  }

  async function saveCategorySettings(folder: string, settings: CategorySettings): Promise<string> {
    const { sha: _sha, folder: _folder, ...payload } = settings
    const content = JSON.stringify(payload, null, 2) + '\n'
    return saveRecipe(`${folder}/.category.json`, content, settings.sha)
  }

  return {
    fetchRecipeList, fetchRecipeContent, saveRecipe, deleteRecipe, testConnection,
    findRecipeImage, findRecipeImageInfo, saveRecipeImage, deleteRecipeImage,
    fetchCategorySettings, saveCategorySettings
  }
}
