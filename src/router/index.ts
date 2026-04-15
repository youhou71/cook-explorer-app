import { createRouter, createWebHistory } from 'vue-router'
import { useGitHubStore } from '@/stores/github'

const router = createRouter({
  history: createWebHistory(),
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

// Guard : redirige vers settings si non configuré
router.beforeEach((to) => {
  if (to.meta.requiresConfig) {
    const store = useGitHubStore()
    if (!store.isConfigured) {
      return { name: 'settings' }
    }
  }
})

export default router
