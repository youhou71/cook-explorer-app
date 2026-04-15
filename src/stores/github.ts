import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { GitHubConfig } from '@/types'

export const useGitHubStore = defineStore('github', () => {
  // Persisté dans localStorage
  const token = useLocalStorage<string>('github_token', '')
  const owner = useLocalStorage<string>('github_owner', '')
  const repo = useLocalStorage<string>('github_repo', '')
  const branch = useLocalStorage<string>('github_branch', 'main')

  const isConfigured = computed(() =>
    !!(token.value && owner.value && repo.value)
  )

  const config = computed<GitHubConfig>(() => ({
    token: token.value,
    owner: owner.value,
    repo: repo.value,
    branch: branch.value
  }))

  function saveConfig(cfg: GitHubConfig) {
    token.value = cfg.token
    owner.value = cfg.owner
    repo.value = cfg.repo
    branch.value = cfg.branch || 'main'
  }

  function clearConfig() {
    token.value = ''
    owner.value = ''
    repo.value = ''
    branch.value = 'main'
  }

  return { token, owner, repo, branch, isConfigured, config, saveConfig, clearConfig }
})
