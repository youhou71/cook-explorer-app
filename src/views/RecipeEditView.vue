<template>
  <div class="edit-view">
    <h1>{{ isNew ? 'Nouvelle recette' : `Modifier : ${filename}` }}</h1>

    <div class="edit-layout">
      <!-- Éditeur -->
      <div class="editor-panel">
        <div class="field">
          <label>Type de plat</label>
          <div class="category-picker">
            <select v-model="categoryChoice" class="category-select">
              <option value="">— Sans catégorie —</option>
              <option v-for="cat in existingCategories" :key="cat" :value="cat">{{ cat }}</option>
              <option value="__new__">+ Nouveau type…</option>
            </select>
            <input
              v-if="categoryChoice === '__new__'"
              v-model="newCategory"
              placeholder="ex : desserts"
              class="category-new-input"
            />
          </div>
        </div>

        <div class="field">
          <label>Nom de la recette</label>
          <input v-model="recipeName" placeholder="tarte-citron" />
          <p class="field-hint" v-if="targetPath">
            <template v-if="pathWillChange">
              <span class="field-hint-move">↪ Déplacement :</span>
              <code>{{ path }}</code> → <code>{{ targetPath }}</code>
            </template>
            <template v-else>
              Fichier : <code>{{ targetPath }}</code>
            </template>
          </p>
        </div>

        <!-- Image -->
        <div class="field">
          <label>Image</label>
          <div class="image-uploader">
            <div v-if="imagePreview" class="image-preview-wrap">
              <img :src="imagePreview" :alt="filename" class="image-preview" />
              <div class="image-preview-actions">
                <button type="button" class="image-action" @click="pickImage" title="Remplacer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
                <button type="button" class="image-action image-action--danger" @click="removeImage" title="Supprimer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
            <button v-else type="button" class="image-drop" @click="pickImage">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Ajouter une image</span>
              <span class="image-drop-hint">JPG, PNG ou WEBP</span>
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="image-input"
              @change="onFileChange"
            />
          </div>
        </div>

        <label class="editor-label">Contenu Cooklang</label>
        <textarea
          v-model="content"
          class="editor"
          spellcheck="false"
          placeholder=">> title: Ma recette

Faire revenir @oignons{2} dans @huile d'olive{2%cl} pendant ~{10%min}."
        />

        <div class="edit-actions">
          <RouterLink :to="isNew ? '/recipes' : `/recipes/${path}`" class="btn btn--ghost">
            Annuler
          </RouterLink>
          <button class="btn btn--primary" @click="save" :disabled="saving">
            {{ saving ? 'Enregistrement...' : 'Enregistrer sur GitHub' }}
          </button>
        </div>

        <div v-if="saveError" class="msg msg--error">{{ saveError }}</div>
      </div>

      <!-- Prévisualisation -->
      <div class="preview-panel">
        <div class="preview-header">
          <span class="preview-dot"></span>
          Aperçu en direct
        </div>
        <div v-if="parsed" class="preview-content">
          <div class="preview-title" v-if="parsed.metadata.title">
            {{ parsed.metadata.title }}
          </div>

          <div v-if="previewSummary" class="preview-badges">
            <span v-if="previewSummary.servings" class="preview-badge preview-badge--sage">
              👥 {{ previewSummary.servings }}
            </span>
            <span v-if="previewSummary.prepTime" class="preview-badge preview-badge--warm">
              🥘 Prépa {{ previewSummary.prepTime }}
            </span>
            <span v-if="previewSummary.cookTime" class="preview-badge preview-badge--accent">
              🔥 Cuisson {{ previewSummary.cookTime }}
            </span>
            <span v-if="previewSummary.totalTime" class="preview-badge preview-badge--muted">
              ⏱ Total {{ previewSummary.totalTime }}
            </span>
          </div>

          <div v-if="previewSummary?.tags?.length" class="preview-tags">
            <span
              v-for="tag in previewSummary.tags"
              :key="tag"
              class="preview-tag"
              :class="'preview-tag--' + recipesStore.getTagColor(tag)"
            >{{ tag }}</span>
          </div>

          <div class="preview-section">
            <h3>Ingrédients ({{ parsed.ingredients.length }})</h3>
            <template v-for="(sec, si) in previewIngredientSections" :key="si">
              <h4 v-if="sec.title" class="preview-section-title">{{ sec.title }}</h4>
              <ul class="preview-list">
                <li v-for="(ing, i) in sec.ingredients" :key="i">{{ formatIngredient(ing) }}</li>
              </ul>
            </template>
          </div>

          <div class="preview-section">
            <h3>Étapes</h3>
            <template v-for="(sec, si) in parsed.sections" :key="si">
              <h4 v-if="sec.title" class="preview-section-title">{{ sec.title }}</h4>
              <ol class="preview-steps">
                <li v-for="(step, i) in sec.steps" :key="i" v-html="renderStep(step)" />
              </ol>
            </template>
          </div>

          <div v-if="parsed.notes?.length" class="preview-section">
            <h3>Notes</h3>
            <div class="preview-notes">
              <div v-for="(note, i) in parsed.notes" :key="i" class="preview-note">
                <span class="preview-note-icon">💡</span>
                <span>{{ note }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="preview-empty">
          <span class="preview-empty-icon">📝</span>
          <p>L'aperçu s'affiche ici...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useRecipesStore } from '@/stores/recipes'
import { useGitHub } from '@/composables/useGitHub'
import { useCooklang } from '@/composables/useCooklang'
import type { CooklangRecipe } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { compareCategories } from '@/utils/categories'
import { upsertRecipeDates } from '@/utils/frontmatter'

const route = useRoute()
const router = useRouter()
const recipesStore = useRecipesStore()
const { fetchRecipeContent, saveRecipe, deleteRecipe, findRecipeImageInfo, saveRecipeImage, deleteRecipeImage } = useGitHub()
const { parseRecipe, formatIngredient, renderStep, getSummary } = useCooklang()

const path = computed(() => route.params.path as string)
const isNew = computed(() => route.name === 'recipe-new')
const filename = computed(() => path.value?.split('/').pop() ?? '')

const categoryChoice = ref('')
const newCategory = ref('')
const recipeName = ref('')
const content = ref('')
const sha = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)
const parsed = ref<CooklangRecipe | null>(null)

const previewSummary = computed(() => parsed.value ? getSummary(parsed.value) : null)

/** Sections avec au moins 1 ingrédient (panneau ingrédients du preview) */
const previewIngredientSections = computed(() =>
  (parsed.value?.sections ?? []).filter(s => s.ingredients.length > 0)
)

/** Liste des types de plat existants (dossiers racine contenant des .cook) */
const existingCategories = computed(() => {
  const set = new Set<string>()
  for (const r of recipesStore.recipes) {
    const idx = r.path.indexOf('/')
    if (idx > 0) set.add(r.path.substring(0, idx))
  }
  return [...set].sort(compareCategories)
})

/** Chemin final construit depuis catégorie + nom de recette */
const targetPath = computed(() => {
  const cat = categoryChoice.value === '__new__'
    ? newCategory.value.trim()
    : categoryChoice.value
  const name = recipeName.value.trim()
  if (!name) return ''
  const fileName = name.endsWith('.cook') ? name : name + '.cook'
  return cat ? `${cat}/${fileName}` : fileName
})

/** True si le chemin va changer (et donc qu'un déplacement GitHub est requis) */
const pathWillChange = computed(() =>
  !isNew.value && targetPath.value && targetPath.value !== path.value
)

// ── Image management ──
const fileInput = ref<HTMLInputElement | null>(null)
const imagePreview = ref<string | null>(null)
const imageFile = ref<File | null>(null)
const existingImagePath = ref<string | null>(null)
const existingImageSha = ref<string | null>(null)
const imageMarkedForRemoval = ref(false)

function pickImage() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    imagePreview.value = reader.result as string
    imageFile.value = file
    imageMarkedForRemoval.value = false
  }
  reader.readAsDataURL(file)
  // Reset l'input pour permettre de re-sélectionner le même fichier
  input.value = ''
}

function removeImage() {
  imagePreview.value = null
  imageFile.value = null
  // Si une image existe sur GitHub, la marquer pour suppression au save
  if (existingImagePath.value) imageMarkedForRemoval.value = true
}

// Parse en temps réel avec debounce
const debouncedParse = useDebounceFn(() => {
  try {
    parsed.value = content.value.trim() ? parseRecipe(content.value) : null
  } catch { parsed.value = null }
}, 400)

watch(content, debouncedParse)

onMounted(async () => {
  // Hydrater le store pour alimenter la liste des catégories existantes
  await recipesStore.hydrate()

  if (!isNew.value) {
    try {
      // Pré-remplir catégorie + nom depuis le path actuel
      const currentPath = path.value
      const slashIdx = currentPath.indexOf('/')
      if (slashIdx > 0) {
        categoryChoice.value = currentPath.substring(0, slashIdx)
        recipeName.value = currentPath.substring(slashIdx + 1).replace(/\.cook$/, '')
      } else {
        categoryChoice.value = ''
        recipeName.value = currentPath.replace(/\.cook$/, '')
      }

      const cached = recipesStore.getByPath(currentPath)
      if (cached?.content) {
        content.value = cached.content
        sha.value = cached.sha
      } else {
        const result = await fetchRecipeContent(currentPath)
        content.value = result.content
        sha.value = result.sha
      }
      // Charger l'image existante
      const info = await findRecipeImageInfo(currentPath)
      if (info) {
        imagePreview.value = info.dataUri
        existingImagePath.value = info.path
        existingImageSha.value = info.sha
      }
    } catch (e: any) {
      saveError.value = e.message
    }
  }
})

async function save() {
  saveError.value = null
  const finalPath = targetPath.value
  if (!finalPath) {
    saveError.value = 'Le nom de la recette est requis'
    return
  }
  if (!finalPath.endsWith('.cook')) {
    saveError.value = 'Le chemin doit se terminer par .cook'
    return
  }

  const oldPath = path.value
  const isMove = pathWillChange.value

  saving.value = true
  try {
    // 1. Injecter / mettre à jour created_at + updated_at dans le frontmatter
    // - Nouvelle recette OU déplacement sans sha précédent → created_at = now
    // - Édition d'une recette existante → created_at conservé s'il existe, sinon ajouté
    // updated_at est toujours mis à now
    const dated = upsertRecipeDates(content.value, { isNew: isNew.value })
    content.value = dated
    try {
      parsed.value = parseRecipe(dated)
    } catch {
      // Si le parse échoue ici (contenu invalide), on laisse parsed.value tel quel
    }

    // 2. Écrire le .cook au nouveau chemin
    // - Création si nouvelle recette ou déplacement (pas de sha)
    // - Update sinon (avec sha)
    const newSha = await saveRecipe(
      finalPath,
      dated,
      isNew.value || isMove ? undefined : sha.value
    )
    recipesStore.upsertRecipe({
      name: finalPath.split('/').pop()!.replace('.cook', ''),
      path: finalPath,
      sha: newSha,
      content: dated,
      parsed: parsed.value ?? undefined
    })

    // 3. Gestion de l'image
    let finalImageDataUri: string | null | undefined = undefined // undefined = pas de changement

    const newImageExt = (p: string) => p.substring(p.lastIndexOf('.'))

    if (imageFile.value) {
      // L'utilisateur a sélectionné un nouveau fichier
      const rawExt = '.' + imageFile.value.name.split('.').pop()!.toLowerCase()
      const normalizedExt = rawExt === '.jpeg' ? '.jpg' : rawExt
      const newImagePath = finalPath.replace(/\.cook$/, '') + normalizedExt

      // Si une image existe déjà à un autre chemin → delete-and-create
      if (existingImagePath.value && existingImagePath.value !== newImagePath && existingImageSha.value) {
        try { await deleteRecipeImage(existingImagePath.value, existingImageSha.value) } catch { /* ignore */ }
        const result = await saveRecipeImage(finalPath, imageFile.value)
        finalImageDataUri = result.dataUri
      } else {
        // Même chemin → update avec sha, sinon création pure
        const result = await saveRecipeImage(
          finalPath,
          imageFile.value,
          existingImagePath.value === newImagePath ? existingImageSha.value ?? undefined : undefined
        )
        finalImageDataUri = result.dataUri
      }
    } else if (imageMarkedForRemoval.value && existingImagePath.value && existingImageSha.value) {
      // L'utilisateur a supprimé l'image
      await deleteRecipeImage(existingImagePath.value, existingImageSha.value)
      finalImageDataUri = null
    } else if (isMove && existingImagePath.value && existingImageSha.value && imagePreview.value) {
      // Déplacement sans changement d'image : copier vers le nouveau chemin et supprimer l'ancien
      const ext = newImageExt(existingImagePath.value)
      const newImagePath = finalPath.replace(/\.cook$/, '') + ext
      // Récupérer la base64 depuis la dataUri déjà chargée
      const dataUri = imagePreview.value
      const base64 = dataUri.substring(dataUri.indexOf(',') + 1)
      // Convertir en File pour réutiliser saveRecipeImage
      const byteChars = atob(base64)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const mime = dataUri.substring(5, dataUri.indexOf(';'))
      const fakeFile = new File([bytes], `img${ext}`, { type: mime })
      const result = await saveRecipeImage(finalPath, fakeFile)
      try { await deleteRecipeImage(existingImagePath.value, existingImageSha.value) } catch { /* ignore */ }
      finalImageDataUri = result.dataUri
      // Mettre à jour la ref pour le nouveau chemin
      existingImagePath.value = newImagePath
    }

    // 4. Mettre à jour le cache d'image
    if (finalImageDataUri !== undefined) {
      recipesStore.cacheImage(finalPath, finalImageDataUri)
    } else if (isMove && imagePreview.value) {
      // Si pas de changement d'image mais déplacement, propager la dataUri existante
      recipesStore.cacheImage(finalPath, imagePreview.value)
    }

    // 5. Si déplacement, nettoyer l'ancien fichier + entrée locale
    if (isMove && sha.value) {
      try { await deleteRecipe(oldPath, sha.value) } catch { /* ignore */ }
      recipesStore.removeRecipe(oldPath)
    }

    router.push(`/recipes/${finalPath}`)
  } catch (e: any) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
h1 {
  font-family: var(--font-serif);
  font-size: 1.8rem;
  margin-bottom: 1.75rem;
  letter-spacing: -0.01em;
}

.edit-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 700px) {
  .edit-layout { grid-template-columns: 1fr; }
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.25rem;
}

label, .editor-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Category picker */
.category-picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.category-select {
  width: 100%;
  padding: 0.6rem 0.85rem;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.category-select:focus {
  outline: none;
  border-color: var(--color-sage);
  box-shadow: 0 0 0 3px var(--color-sage-light);
}

.category-new-input {
  animation: slide-in 0.2s ease;
}

@keyframes slide-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.field-hint {
  font-size: 0.78rem;
  color: var(--color-muted);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  margin-top: 0.15rem;
}

.field-hint code {
  background: var(--color-surface-alt);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  color: var(--color-text);
}

.field-hint-move {
  color: var(--color-accent);
  font-weight: 500;
  margin-right: 0.25rem;
}

/* Image uploader */
.image-uploader {
  position: relative;
}

.image-input {
  display: none;
}

.image-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 1.75rem 1rem;
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-muted);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.image-drop:hover {
  border-color: var(--color-sage);
  color: var(--color-sage);
  background: var(--color-sage-light);
}

.image-drop-hint {
  font-size: 0.72rem;
  font-weight: 400;
  opacity: 0.75;
}

.image-preview-wrap {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface-alt);
}

.image-preview {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.image-preview-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.35rem;
}

.image-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-muted);
  backdrop-filter: blur(6px);
  transition: all var(--transition-fast);
}

.image-action:hover {
  background: white;
  color: var(--color-text);
  transform: scale(1.08);
}

.image-action--danger:hover {
  color: #e74c3c;
}

/* Editor */
.editor {
  width: 100%;
  min-height: 420px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 0.84rem;
  line-height: 1.7;
  resize: vertical;
  padding: 1rem;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  color: var(--color-text);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.editor:focus {
  outline: none;
  border-color: var(--color-sage);
  box-shadow: 0 0 0 3px var(--color-sage-light);
}

/* Actions */
.edit-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.btn {
  padding: 0.55rem 1.2rem;
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: all var(--transition-fast);
}

.btn--primary {
  background: var(--color-accent);
  color: white;
  border: none;
  box-shadow: 0 2px 8px rgba(196, 89, 58, 0.2);
}

.btn--primary:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(196, 89, 58, 0.3);
  text-decoration: none;
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn--ghost {
  border: 1.5px solid var(--color-border);
  color: var(--color-text);
  background: none;
}

.btn--ghost:hover {
  background: var(--color-surface-alt);
  border-color: var(--color-muted);
  text-decoration: none;
}

/* Error msg */
.msg {
  margin-top: 1rem;
  font-size: 0.85rem;
  padding: 0.7rem 1rem;
  border-radius: var(--radius-md);
  border-left: 3px solid;
}

.msg--error {
  background: #fdf2f2;
  border-color: #e74c3c;
  color: #922b21;
}

/* Preview panel */
.preview-panel {
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: sticky;
  top: 70px;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-surface-alt);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-muted);
}

.preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-sage);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.preview-content {
  padding: 1.5rem 1.25rem;
}

.preview-title {
  font-family: var(--font-serif);
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

/* Preview badges (servings + durations) */
.preview-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.6rem;
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.22rem 0.6rem;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 500;
}

.preview-badge--sage { background: var(--color-sage-light); color: var(--color-sage); }
.preview-badge--warm { background: var(--color-warm-light); color: var(--color-warm); }
.preview-badge--accent { background: var(--color-accent-light); color: var(--color-accent); }
.preview-badge--muted { background: var(--color-surface-alt); color: var(--color-muted); }

/* Preview tags */
.preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 1rem;
}

.preview-tag {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 0.15rem 0.55rem;
  border-radius: 99px;
}

.preview-tag--sage { background: var(--color-sage-light); color: var(--color-sage); }
.preview-tag--warm { background: var(--color-warm-light); color: var(--color-warm); }
.preview-tag--accent { background: var(--color-accent-light); color: var(--color-accent); }
.preview-tag--plum { background: var(--color-plum-light); color: var(--color-plum); }
.preview-tag--sky { background: var(--color-sky-light); color: var(--color-sky); }
.preview-tag--rose { background: var(--color-rose-light); color: var(--color-rose); }

/* Preview notes */
.preview-notes {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-note {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--color-warm-light);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--color-text);
}

.preview-note-icon {
  flex-shrink: 0;
  font-size: 0.9rem;
}

.preview-section {
  margin-bottom: 1.25rem;
}

h3 {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-muted);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.preview-list {
  list-style: none;
  font-size: 0.88rem;
}

.preview-list li {
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--color-border);
}

.preview-list li:last-child {
  border-bottom: none;
}

.preview-steps {
  padding-left: 1.25rem;
  font-size: 0.88rem;
  line-height: 1.65;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.preview-section-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.88rem;
  color: var(--color-text);
  margin-top: 0.85rem;
  margin-bottom: 0.5rem;
  padding-left: 0.45rem;
  border-left: 2.5px solid var(--color-sage);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}

.preview-section-title:first-of-type {
  margin-top: 0.25rem;
}

.preview-steps + .preview-steps {
  margin-top: 0.85rem;
}

.preview-empty {
  padding: 3rem 1.25rem;
  text-align: center;
  color: var(--color-muted);
}

.preview-empty-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.75rem;
  opacity: 0.5;
}

.preview-empty p {
  font-size: 0.85rem;
}
</style>
