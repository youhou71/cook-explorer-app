<!--
  Composant réutilisable pour l'état de chargement et l'affichage d'erreur.
  Utilisé par RecipeListView, RecipeDetailView et CategorySettingsView.
-->
<template>
  <div v-if="loading" class="state-msg">
    <div class="loader"></div>
    Chargement…
  </div>
  <div v-else-if="error" class="state-msg state-msg--error">{{ error }}</div>
</template>

<script setup lang="ts">
/** Props : loading active le spinner, error affiche le message d'erreur. */
defineProps<{
  loading: boolean
  error?: string | null
}>()
</script>

<style scoped>
.state-msg {
  color: var(--color-muted);
  padding: 3rem 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.state-msg--error { color: #c0392b; }

.loader {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
