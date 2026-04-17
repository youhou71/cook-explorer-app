<!--
  Page de paramétrage des types de plats (route /categories).

  Permet de configurer visuellement chaque catégorie de recettes :
   - Réordonner les catégories par drag-and-drop (via sortablejs)
   - Modifier le nom d'affichage, les couleurs, l'icône, les heures
     de consommation typiques et une description courte
   - Sauvegarder les modifications sur GitHub (crée/met à jour un fichier
     `.category.json` dans chaque dossier de catégorie)

  Au chargement, la page fusionne :
   1. Les catégories déjà configurées (depuis GitHub ou le cache IndexedDB)
   2. Les dossiers du repo qui contiennent des recettes mais n'ont pas encore
      de `.category.json` (détectés via les paths des recettes en cache)

  Les catégories sans fichier `.category.json` apparaissent avec les valeurs
  par défaut (couleur sage, icône 📁) et seront créées sur GitHub au premier
  enregistrement.
-->

<template>
  <div class="cat-settings">
    <h1>Types de plats</h1>
    <p class="hint">
      Glisse pour réordonner, clique pour éditer.<br>
      Les modifications sont enregistrées dans un fichier <code>.category.json</code> par dossier.
    </p>

    <!-- État de chargement -->
    <div v-if="loading" class="state-msg">
      <div class="loader"></div>
      Chargement...
    </div>

    <div v-else>
      <!--
        Liste draggable des catégories.
        L'attribut `ref="listEl"` est utilisé par useSortable pour attacher
        les événements de drag-and-drop. L'option `handle: '.drag-handle'`
        restreint le drag au symbole ☰ pour ne pas interférer avec les clics
        sur le reste de la ligne.
      -->
      <div ref="listEl" class="cat-list">
        <div
          v-for="cat in localCategories"
          :key="cat.folder"
          class="cat-item"
          :data-folder="cat.folder"
        >
          <!-- En-tête de la catégorie (toujours visible) -->
          <div class="cat-header" @click="toggle(cat.folder)">
            <span class="drag-handle">☰</span>
            <span class="cat-icon">{{ cat.icon }}</span>
            <span class="cat-name">{{ cat.name }}</span>
            <!-- Pastille de prévisualisation de la couleur principale -->
            <span class="cat-swatch" :style="{ background: cat.color }"></span>
            <!-- Indicateur expand/collapse -->
            <span class="cat-expand">{{ expanded === cat.folder ? '▾' : '▸' }}</span>
          </div>

          <!-- Formulaire d'édition (affiché uniquement pour la catégorie développée) -->
          <div v-if="expanded === cat.folder" class="cat-form">
            <!-- Nom d'affichage (ex : "Plats principaux" au lieu de "plats") -->
            <div class="field">
              <label>Nom d'affichage</label>
              <input v-model="cat.name" type="text" />
            </div>

            <!-- Couleurs principale et secondaire côte à côte -->
            <div class="field-row">
              <div class="field">
                <label>Couleur principale</label>
                <div class="color-field">
                  <!-- Sélecteur natif de couleur + champ hex éditable -->
                  <input v-model="cat.color" type="color" class="color-input" />
                  <input v-model="cat.color" type="text" class="color-hex" placeholder="#6b8f71" />
                </div>
              </div>
              <div class="field">
                <label>Couleur secondaire</label>
                <div class="color-field">
                  <input v-model="cat.colorSecondary" type="color" class="color-input" />
                  <input v-model="cat.colorSecondary" type="text" class="color-hex" placeholder="#eef4ef" />
                  <!--
                    Bouton "auto" : calcule une version très claire (12% de la couleur
                    principale + 88% de blanc) pour un fond subtil.
                  -->
                  <button type="button" class="btn-auto" @click="autoSecondary(cat)" title="Calculer automatiquement">auto</button>
                </div>
              </div>
            </div>

            <!-- Icône emoji -->
            <div class="field">
              <label>Icône / Emoji</label>
              <input v-model="cat.icon" type="text" class="icon-input" />
            </div>

            <!--
              Heures de consommation typiques (ex : 12:00, 19:00 pour un plat).
              Chaque heure est affichée comme un chip avec un input[type=time]
              et un bouton de suppression.
            -->
            <div class="field">
              <label>Heures de consommation</label>
              <div class="hours-list">
                <span v-for="(h, i) in cat.hours" :key="i" class="hour-chip">
                  <input
                    :value="h"
                    type="time"
                    class="hour-input"
                    @input="(e) => cat.hours[i] = (e.target as HTMLInputElement).value"
                  />
                  <button type="button" class="hour-remove" @click="cat.hours.splice(i, 1)">×</button>
                </span>
                <button type="button" class="btn-add-hour" @click="cat.hours.push('12:00')">+ Ajouter</button>
              </div>
            </div>

            <!-- Description courte (optionnelle) -->
            <div class="field">
              <label>Description courte</label>
              <input v-model="cat.description" type="text" placeholder="Description optionnelle..." />
            </div>
          </div>
        </div>
      </div>

      <!-- Bouton de sauvegarde global -->
      <div class="actions">
        <button class="btn btn--primary" :disabled="saving" @click="saveAll">
          {{ saving ? 'Enregistrement...' : 'Enregistrer les modifications' }}
        </button>
      </div>

      <!-- Feedback après sauvegarde (succès ou erreur) -->
      <div v-if="saveResult" :class="['save-result', saveResult.success ? 'save-result--success' : 'save-result--error']">
        <span class="save-result-icon">{{ saveResult.success ? '✓' : '✗' }}</span>
        {{ saveResult.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'
import { useRecipesStore } from '@/stores/recipes'
import { useGitHub } from '@/composables/useGitHub'
import { getCategory, buildCategorySettings } from '@/utils/categories'
import type { CategorySettings } from '@/types'

const recipesStore = useRecipesStore()
const { fetchCategorySettings, saveCategorySettings } = useGitHub()

/** Indicateur de chargement initial (hydratation + fetch GitHub) */
const loading = ref(true)
/** Indicateur de sauvegarde en cours (désactive le bouton) */
const saving = ref(false)
/** Nom du dossier de la catégorie actuellement développée (null si aucune) */
const expanded = ref<string | null>(null)
/** Résultat de la dernière sauvegarde (null avant la première sauvegarde) */
const saveResult = ref<{ success: boolean; message: string } | null>(null)
/** Référence DOM de la liste draggable (utilisée par useSortable) */
const listEl = ref<HTMLElement | null>(null)

/**
 * Copie locale éditable des catégories.
 * Les modifications sont faites sur cette copie ; elles ne sont persistées
 * (GitHub + IndexedDB + store Pinia) qu'au clic sur "Enregistrer".
 */
const localCategories = ref<CategorySettings[]>([])

/** Bascule l'état développé/replié d'une catégorie dans le formulaire. */
function toggle(folder: string) {
  expanded.value = expanded.value === folder ? null : folder
}

/**
 * Calcule automatiquement la couleur secondaire à partir de la couleur principale.
 * Applique un mélange 12% couleur + 88% blanc pour obtenir un fond pastel subtil.
 * C'est l'équivalent JS de `color-mix(in srgb, color 12%, white)`.
 */
function autoSecondary(cat: CategorySettings) {
  const hex = cat.color.replace('#', '')
  if (hex.length !== 6) return
  // Extraire les composantes RGB
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  // Mélange vers le blanc (88% blanc = éclaircir fortement)
  const lr = Math.round(r + (255 - r) * 0.88)
  const lg = Math.round(g + (255 - g) * 0.88)
  const lb = Math.round(b + (255 - b) * 0.88)
  cat.colorSecondary = `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

/**
 * Recalcule le champ `order` de chaque catégorie d'après sa position dans la liste.
 * Appelé après chaque drag-and-drop (onEnd) et avant la sauvegarde.
 */
function recomputeOrder() {
  localCategories.value.forEach((cat, i) => {
    cat.order = i
  })
}

/**
 * Initialisation au montage :
 *  1. Hydrater le store Pinia depuis IndexedDB (pour avoir la liste des recettes)
 *  2. Tenter de récupérer les .category.json depuis GitHub (ou utiliser le cache)
 *  3. Fusionner les catégories configurées avec les dossiers non configurés
 *  4. Trier par ordre puis alphabétique
 *  5. Attacher le drag-and-drop via useSortable
 */
onMounted(async () => {
  await recipesStore.hydrate()

  // Tenter de charger les settings depuis GitHub
  let fromGitHub: CategorySettings[] = []
  try {
    fromGitHub = await fetchCategorySettings()
    recipesStore.setCategorySettings(fromGitHub)
  } catch { /* en cas d'erreur réseau, utiliser le cache IndexedDB */ }

  // Construire une map des catégories déjà configurées (priorité : GitHub > cache)
  const configuredMap = new Map<string, CategorySettings>()
  const source = fromGitHub.length ? fromGitHub : recipesStore.categorySettings
  for (const s of source) {
    configuredMap.set(s.folder, { ...s })
  }

  // Collecter tous les dossiers de catégories existants dans le repo
  // (déduits des paths des recettes en cache)
  const allFolders = new Set<string>()
  for (const r of recipesStore.recipes) {
    const cat = getCategory(r.path)
    if (cat) allFolders.add(cat)
  }

  // Fusionner : catégories configurées + dossiers non configurés (avec defaults)
  const merged: CategorySettings[] = []
  for (const folder of allFolders) {
    if (configuredMap.has(folder)) {
      merged.push(configuredMap.get(folder)!)
      configuredMap.delete(folder)
    } else {
      merged.push(buildCategorySettings(folder))
    }
  }
  // Ajouter les catégories configurées dont le dossier n'a plus de recettes
  for (const remaining of configuredMap.values()) {
    merged.push(remaining)
  }

  // Trier : par order croissant, puis alphabétique en cas d'égalité
  merged.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.folder.localeCompare(b.folder)
  })

  // Attribuer un order aux catégories qui n'en ont pas encore (Infinity → index)
  merged.forEach((cat, i) => {
    if (cat.order === Infinity) cat.order = i
  })

  localCategories.value = merged
  loading.value = false

  // Attacher le drag-and-drop après le prochain rendu DOM
  await nextTick()
  if (listEl.value) {
    // @ts-expect-error — les types UseSortableOptions de @vueuse/integrations n'exposent pas toutes les options sortablejs (handle, animation)
    useSortable(listEl, localCategories, {
      handle: '.drag-handle',  // Seul le symbole ☰ déclenche le drag
      animation: 200,          // Durée de l'animation de réordonnement (ms)
      onEnd: recomputeOrder    // Recalculer les `order` après chaque drop
    })
  }
})

/**
 * Sauvegarde toutes les catégories modifiées sur GitHub.
 *
 * Pour chaque catégorie, un fichier `dossier/.category.json` est créé ou mis à jour.
 * Le SHA retourné par GitHub est stocké dans la catégorie locale pour les futures
 * mises à jour. Après la sauvegarde, le store Pinia et le cache IndexedDB sont
 * synchronisés.
 */
async function saveAll() {
  saving.value = true
  saveResult.value = null

  // S'assurer que les `order` reflètent la position actuelle dans la liste
  recomputeOrder()

  let errors = 0
  for (const cat of localCategories.value) {
    try {
      const newSha = await saveCategorySettings(cat.folder, cat)
      // Mettre à jour le SHA local pour les prochaines sauvegardes (update vs create)
      cat.sha = newSha
    } catch {
      errors++
    }
  }

  // Synchroniser le store Pinia + cache IndexedDB
  recipesStore.setCategorySettings([...localCategories.value])

  // Feedback à l'utilisateur
  if (errors === 0) {
    saveResult.value = { success: true, message: `${localCategories.value.length} catégorie(s) enregistrée(s).` }
  } else {
    saveResult.value = { success: false, message: `${errors} erreur(s) lors de l'enregistrement.` }
  }

  saving.value = false
}
</script>

<style scoped>
/* ── Layout principal ──────────────────────────────────────────────────── */
.cat-settings {
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

/* ── État de chargement ────────────────────────────────────────────────── */
.state-msg {
  color: var(--color-muted);
  padding: 3rem 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.loader {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Liste draggable des catégories ────────────────────────────────────── */
.cat-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

/* Carte d'une catégorie (header + formulaire expandable) */
.cat-item {
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: box-shadow var(--transition-fast);
}

.cat-item:hover {
  box-shadow: var(--shadow-sm);
}

/* En-tête cliquable (drag handle + icône + nom + pastille couleur + chevron) */
.cat-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  user-select: none;
}

/* Poignée de drag (☰) */
.drag-handle {
  cursor: grab;
  color: var(--color-muted);
  font-size: 1rem;
  padding: 0.2rem;
}

.drag-handle:active {
  cursor: grabbing;
}

/* Icône emoji de la catégorie */
.cat-icon {
  font-size: 1.2rem;
}

/* Nom d'affichage (prend l'espace restant) */
.cat-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.92rem;
}

/* Pastille ronde de prévisualisation de la couleur principale */
.cat-swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  flex-shrink: 0;
}

/* Chevron expand/collapse */
.cat-expand {
  color: var(--color-muted);
  font-size: 0.85rem;
}

/* ── Formulaire d'édition (expandable) ─────────────────────────────────── */
.cat-form {
  padding: 0 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-top: 1px solid var(--color-border);
  padding-top: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-row {
  display: flex;
  gap: 0.75rem;
}

.field-row .field {
  flex: 1;
}

label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Champ couleur (sélecteur natif + input hex) */
.color-field {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.color-input {
  width: 36px;
  height: 32px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 2px;
  cursor: pointer;
  background: var(--color-surface);
}

.color-hex {
  flex: 1;
  min-width: 0;
}

/* Bouton "auto" pour le calcul automatique de la couleur secondaire */
.btn-auto {
  padding: 0.3rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-alt);
  color: var(--color-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.btn-auto:hover {
  border-color: var(--color-muted);
  color: var(--color-text);
}

/* Champ icône (petit, centré, grande police pour l'emoji) */
.icon-input {
  width: 80px;
  font-size: 1.2rem;
  text-align: center;
}

/* ── Heures de consommation (chips éditables) ──────────────────────────── */
.hours-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

/* Chip d'heure : input[type=time] + bouton supprimer */
.hour-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: 99px;
  padding: 0.2rem 0.4rem 0.2rem 0.6rem;
}

.hour-input {
  border: none;
  background: transparent;
  font-size: 0.85rem;
  width: 80px;
  padding: 0;
  font-family: var(--font-sans);
  color: var(--color-text);
}

/* Bouton × de suppression d'un créneau horaire */
.hour-remove {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: var(--color-border);
  color: var(--color-muted);
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  transition: all var(--transition-fast);
}

.hour-remove:hover {
  background: #e74c3c;
  color: white;
}

/* Bouton "+ Ajouter" un créneau horaire */
.btn-add-hour {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-muted);
  border: 1.5px dashed var(--color-border);
  border-radius: 99px;
  padding: 0.25rem 0.7rem;
  background: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-add-hour:hover {
  border-color: var(--color-muted);
  color: var(--color-text);
}

/* ── Actions (bouton sauvegarder) ──────────────────────────────────────── */
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--color-accent);
  color: white;
  box-shadow: 0 2px 8px rgba(196, 89, 58, 0.2);
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(196, 89, 58, 0.3);
}

/* ── Feedback de sauvegarde ────────────────────────────────────────────── */
.save-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border-left: 3px solid;
  margin-top: 1rem;
}

.save-result--success {
  background: var(--color-sage-light);
  border-color: var(--color-sage);
  color: var(--color-sage);
}

.save-result--error {
  background: #fdf2f2;
  border-color: #e74c3c;
  color: #c0392b;
}

.save-result-icon {
  font-weight: 700;
  font-size: 1rem;
}

/* ── Styles sortablejs (appliqués dynamiquement par la librairie) ───────── */

/* Élément fantôme : opacité réduite pour montrer où l'élément sera placé */
:deep(.sortable-ghost) {
  opacity: 0.4;
}

/* Élément en cours de drag : ombre portée pour l'effet de surélévation */
:deep(.sortable-chosen) {
  box-shadow: var(--shadow-md);
}
</style>
