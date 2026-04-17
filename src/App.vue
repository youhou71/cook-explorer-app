<template>
  <div id="app">
    <div class="route-progress" :class="{ 'route-progress--active': navigating }" />

    <header class="app-header">
      <nav class="nav">
        <RouterLink :to="github.isConfigured ? '/recipes' : '/settings'" class="logo">
          <span class="logo-icon">🍳</span>
          <span class="logo-text">CookExplorer</span>
          <span v-if="github.isConfigured" class="logo-repo">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            {{ github.owner }}/{{ github.repo }}
          </span>
        </RouterLink>
        <div class="nav-links">
          <RouterLink v-if="github.isConfigured" to="/categories" class="nav-link nav-link--icon" title="Types de plats">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </RouterLink>
          <RouterLink to="/settings" class="nav-link nav-link--icon" title="Paramètres">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </RouterLink>
        </div>
      </nav>
    </header>

    <main class="app-main">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useGitHubStore } from '@/stores/github'

const github = useGitHubStore()
const navigating = ref(false)
const router = useRouter()

router.beforeEach(() => {
  navigating.value = true
})

router.afterEach(() => {
  // Laisser l'animation de la barre terminer avant de la cacher
  setTimeout(() => {
    navigating.value = false
  }, 400)
})
</script>

<style scoped>
/* ── Progress bar ── */
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  width: 0;
  background: linear-gradient(90deg, var(--color-accent), var(--color-sage), var(--color-warm));
  background-size: 200% 100%;
  z-index: 100;
  border-radius: 0 2px 2px 0;
  opacity: 0;
  pointer-events: none;
}

.route-progress--active {
  animation: progress-bar 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes progress-bar {
  0%   { width: 0; opacity: 1; }
  60%  { width: 70%; opacity: 1; }
  90%  { width: 100%; opacity: 1; }
  100% { width: 100%; opacity: 0; }
}

/* ── Page transitions ── */
.page-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-leave-active {
  transition: opacity 0.12s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(250, 248, 245, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  padding: 0 1.5rem;
}

@media (prefers-color-scheme: dark) {
  .app-header {
    background: rgba(22, 21, 20, 0.8);
  }
}

.nav {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 58px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}

.logo-icon {
  font-size: 1.4rem;
}

.logo-text {
  font-family: var(--font-serif);
  font-size: 1.2rem;
  color: var(--color-text);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.logo-repo {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: 0.5rem;
  padding: 0.15rem 0.55rem;
  background: var(--color-surface-alt);
  color: var(--color-muted);
  border-radius: 99px;
  font-size: 0.7rem;
  font-weight: 500;
  font-family: var(--font-sans);
  letter-spacing: 0;
  transition: all var(--transition-fast);
}

.logo:hover .logo-repo {
  color: var(--color-text);
}

@media (max-width: 500px) {
  .logo-repo { display: none; }
}

.nav-links {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.nav-link {
  color: var(--color-muted);
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 500;
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.nav-link:hover {
  color: var(--color-text);
  background: var(--color-surface-alt);
}

.nav-link.router-link-active {
  color: var(--color-accent);
  background: var(--color-accent-light);
}

.nav-link--icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem;
  border-radius: 50%;
}

.app-main {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

/* ── Impression : masquer la chrome de l'app ── */
@media print {
  .app-header,
  .route-progress {
    display: none !important;
  }

  .app-main {
    max-width: none;
    padding: 0;
  }

  /* Pas de transitions parasites pendant l'impression */
  .page-enter-active,
  .page-leave-active {
    transition: none !important;
  }

  .page-enter-from,
  .page-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>
