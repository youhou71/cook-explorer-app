/**
 * Store Pinia pour la configuration de connexion GitHub.
 *
 * Persiste les identifiants (token PAT, owner, repo, branche) dans
 * `localStorage` via `@vueuse/core/useLocalStorage`. Les valeurs survivent
 * au rechargement de la page et aux redémarrages du navigateur.
 *
 * Le computed `isConfigured` sert de guard global : tant qu'il est false,
 * les routes protégées (`meta.requiresConfig`) redirigent vers /settings.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { GitHubConfig } from '@/types'

export const useGitHubStore = defineStore('github', () => {
  /** Personal Access Token GitHub (persisté dans localStorage). */
  const token = useLocalStorage<string>('github_token', '')
  /** Propriétaire du repo (utilisateur ou organisation). */
  const owner = useLocalStorage<string>('github_owner', '')
  /** Nom du repo contenant les fichiers .cook. */
  const repo = useLocalStorage<string>('github_repo', '')
  /** Branche cible (défaut : "main"). */
  const branch = useLocalStorage<string>('github_branch', 'main')

  /** True si les 3 champs obligatoires (token, owner, repo) sont renseignés. */
  const isConfigured = computed(() =>
    !!(token.value && owner.value && repo.value)
  )

  /** Objet GitHubConfig reconstruit à partir des valeurs réactives individuelles. */
  const config = computed<GitHubConfig>(() => ({
    token: token.value,
    owner: owner.value,
    repo: repo.value,
    branch: branch.value
  }))

  /** Enregistre une nouvelle configuration (écrase les valeurs dans localStorage). */
  function saveConfig(cfg: GitHubConfig) {
    token.value = cfg.token
    owner.value = cfg.owner
    repo.value = cfg.repo
    branch.value = cfg.branch || 'main'
  }

  /** Efface la configuration (réinitialise toutes les valeurs). */
  function clearConfig() {
    token.value = ''
    owner.value = ''
    repo.value = ''
    branch.value = 'main'
  }

  return { token, owner, repo, branch, isConfigured, config, saveConfig, clearConfig }
})
