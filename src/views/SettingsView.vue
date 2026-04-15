<template>
  <div class="settings">
    <h1>Configuration GitHub</h1>
    <p class="hint">
      Connecte ton repo GitHub contenant tes fichiers <code>.cook</code>.<br>
      Le token est stocké localement dans le navigateur, il ne transite jamais par un serveur.
    </p>

    <form class="form" @submit.prevent="save">
      <div class="card">
        <div class="field">
          <label>Personal Access Token</label>
          <input
            v-model="form.token"
            type="password"
            placeholder="ghp_xxxxxxxxxxxx"
            autocomplete="off"
          />
          <small>
            Nécessite les droits <code>repo</code> (ou <code>contents:read+write</code> pour un token fine-grained).
            <a href="https://github.com/settings/tokens/new" target="_blank">Créer un token →</a>
          </small>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Propriétaire</label>
            <input v-model="form.owner" placeholder="monpseudo" />
          </div>
          <div class="field">
            <label>Repo</label>
            <input v-model="form.repo" placeholder="mes-recettes" />
          </div>
          <div class="field field--sm">
            <label>Branche</label>
            <input v-model="form.branch" placeholder="main" />
          </div>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn btn--ghost" @click="testConn" :disabled="testing">
          {{ testing ? 'Test en cours...' : 'Tester la connexion' }}
        </button>
        <button type="submit" class="btn btn--primary">Enregistrer</button>
      </div>

      <div v-if="testResult" :class="['test-result', testResult.success ? 'test-result--success' : 'test-result--error']">
        <span class="test-result-icon">{{ testResult.success ? '✓' : '✗' }}</span>
        {{ testResult.message }}
      </div>
    </form>

    <div v-if="github.isConfigured" class="danger-zone">
      <h2>Zone de danger</h2>
      <p>Supprimer la configuration enregistrée dans ce navigateur.</p>
      <button class="btn btn--danger" @click="github.clearConfig()">
        Effacer la configuration
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGitHubStore } from '@/stores/github'
import { useGitHub } from '@/composables/useGitHub'

const github = useGitHubStore()
const router = useRouter()
const { testConnection } = useGitHub()

const form = reactive({
  token: github.token,
  owner: github.owner,
  repo: github.repo,
  branch: github.branch || 'main'
})

const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

async function testConn() {
  // Applique temporairement pour tester
  github.saveConfig({ ...form })
  testing.value = true
  testResult.value = null
  testResult.value = await testConnection()
  testing.value = false
}

function save() {
  github.saveConfig({ ...form })
  router.push('/recipes')
}
</script>

<style scoped>
.settings {
  max-width: 560px;
}

h1 {
  font-family: var(--font-serif);
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
  letter-spacing: -0.01em;
}

.hint {
  color: var(--color-muted);
  font-size: 0.9rem;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card {
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-row {
  display: flex;
  gap: 0.75rem;
}

.field-row .field { flex: 1; }
.field-row .field--sm { flex: 0 0 100px; }

label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

small {
  font-size: 0.78rem;
  color: var(--color-muted);
  line-height: 1.5;
}

code {
  font-size: 0.85em;
  background: var(--color-surface-alt);
  padding: 1px 5px;
  border-radius: 4px;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.btn {
  padding: 0.55rem 1.2rem;
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--primary {
  background: var(--color-accent);
  color: white;
  box-shadow: 0 2px 8px rgba(196, 89, 58, 0.2);
}

.btn--primary:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(196, 89, 58, 0.3);
}

.btn--ghost {
  border: 1.5px solid var(--color-border);
  color: var(--color-text);
}

.btn--ghost:hover {
  background: var(--color-surface-alt);
  border-color: var(--color-muted);
}

.btn--danger {
  border: 1.5px solid #e74c3c;
  color: #e74c3c;
}

.btn--danger:hover {
  background: #fdf2f2;
  transform: translateY(-1px);
}

.test-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border-left: 3px solid;
}

.test-result--success {
  background: var(--color-sage-light);
  border-color: var(--color-sage);
  color: var(--color-sage);
}

.test-result--error {
  background: #fdf2f2;
  border-color: #e74c3c;
  color: #c0392b;
}

.test-result-icon {
  font-weight: 700;
  font-size: 1rem;
}

.danger-zone {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1.5px solid var(--color-border);
}

.danger-zone h2 {
  font-family: var(--font-serif);
  font-size: 1rem;
  color: #e74c3c;
  margin-bottom: 0.35rem;
}

.danger-zone p {
  font-size: 0.85rem;
  color: var(--color-muted);
  margin-bottom: 1rem;
}
</style>
