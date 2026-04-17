/**
 * Configuration du routeur Vue Router.
 *
 * Routes de l'application :
 *  - `/`                → redirige vers /recipes (si configuré) ou /settings
 *  - `/settings`        → configuration GitHub (token, repo, branche)
 *  - `/categories`      → paramétrage des types de plats (couleurs, ordre, icônes…)
 *  - `/recipes`         → liste des recettes avec recherche et filtres
 *  - `/recipes/new`     → création d'une nouvelle recette
 *  - `/recipes/:path/edit` → édition d'une recette existante
 *  - `/recipes/:path`   → détail d'une recette
 *
 * Les routes marquées `meta: { requiresConfig: true }` sont protégées par un
 * guard de navigation qui redirige vers /settings si GitHub n'est pas configuré.
 *
 * Tous les composants de vue sont chargés en lazy-loading (import dynamique)
 * pour réduire la taille du bundle initial.
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useGitHubStore } from '@/stores/github'

const router = createRouter({
  /**
   * Mode HTML5 history avec base URL dynamique.
   * `import.meta.env.BASE_URL` est injecté par Vite depuis la config `base`
   * (ex : '/cook-explorer-app/' en production, '/' en développement).
   */
  history: createWebHistory(import.meta.env.BASE_URL),
  /** Scroll en haut de page à chaque navigation */
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' }
  },
  routes: [
    {
      path: '/',
      redirect: () => {
        const store = useGitHubStore()
        return store.isConfigured ? '/recipes' : '/settings'
      }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/CategorySettingsView.vue'),
      meta: { requiresConfig: true }
    },
    {
      path: '/recipes',
      name: 'recipes',
      component: () => import('@/views/RecipeListView.vue'),
      meta: { requiresConfig: true }
    },
    {
      path: '/recipes/new',
      name: 'recipe-new',
      component: () => import('@/views/RecipeEditView.vue'),
      meta: { requiresConfig: true }
    },
    {
      path: '/recipes/:path(.*)/edit',
      name: 'recipe-edit',
      component: () => import('@/views/RecipeEditView.vue'),
      meta: { requiresConfig: true }
    },
    {
      path: '/recipes/:path(.*)',
      name: 'recipe-detail',
      component: () => import('@/views/RecipeDetailView.vue'),
      meta: { requiresConfig: true }
    }
  ]
})

/** Guard de navigation : redirige vers /settings si le repo GitHub n'est pas configuré. */
router.beforeEach((to) => {
  if (to.meta.requiresConfig) {
    const store = useGitHubStore()
    if (!store.isConfigured) {
      return { name: 'settings' }
    }
  }
})

export default router
