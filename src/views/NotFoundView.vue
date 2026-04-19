<!--
  Page 404 affichée pour toute URL ne correspondant à aucune route définie.
  Route catch-all `/:pathMatch(.*)*` dans le routeur.
-->
<template>
  <div class="not-found">
    <h1>Page introuvable</h1>
    <p>Cette page n'existe pas.</p>
    <RouterLink to="/recipes" class="back-link">← Retour aux recettes</RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 2rem;
}

.not-found h1 {
  font-family: var(--font-serif);
  font-size: 2rem;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.not-found p {
  color: var(--color-muted);
  margin-bottom: 2rem;
}

.back-link {
  color: var(--color-accent);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition-fast);
}

.back-link:hover {
  color: var(--color-accent-hover);
}
</style>
