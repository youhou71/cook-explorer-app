<!--
  Modal de liste de courses générée depuis les repas de la semaine visible.
  Consolide les ingrédients par rayon, avec mise à l'échelle des portions,
  réassignation de rayon et export presse-papier.
-->
<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h2>Liste de courses</h2>
          <span class="modal-subtitle">{{ mealCount }} recettes planifiées</span>
          <button class="modal-close" @click="$emit('close')">×</button>
        </div>
        <div class="modal-body">
          <div v-if="shoppingList.length === 0" class="modal-empty">
            Aucun ingrédient à afficher. Ajoutez des recettes au calendrier.
          </div>
          <div v-for="(group, gi) in shoppingList" :key="gi" class="shop-group">
            <h3 class="shop-group-title">
              <span class="shop-group-icon">{{ group.icon }}</span>
              {{ group.category }}
              <span class="shop-group-count">{{ group.items.length }}</span>
            </h3>
            <ul class="shop-list">
              <li v-for="(item, ii) in group.items" :key="ii" class="shop-item">
                <span class="shop-item-check">○</span>
                <span v-if="item.qty" class="shop-item-qty">{{ item.qty }}<span v-if="item.unit"> {{ item.unit }}</span></span>
                <span class="shop-item-name">{{ item.name }}</span>
                <span v-if="item.recipes.length > 1" class="shop-item-recipes" :title="item.recipes.join(', ')">× {{ item.recipes.length }}</span>
                <select class="shop-item-aisle" :value="item.aisleId" @change="reassignAisle(item.normName, ($event.target as HTMLSelectElement).value)" title="Changer de rayon">
                  <option v-for="a in AISLES" :key="a.id" :value="a.id">{{ a.icon }} {{ a.name }}</option>
                </select>
              </li>
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button class="shop-btn shop-btn--ghost" @click="copyForGoogleKeep">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            {{ copyKeepLabel }}
          </button>
          <button class="shop-btn shop-btn--primary" @click="copyShoppingList">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            {{ copyLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { CalendarMeal } from '@/types'
import { useRecipesStore } from '@/stores/recipes'
import { useCooklang } from '@/composables/useCooklang'
import { AISLES, getDefaultAisle } from '@/utils/aisles'
import { useRecipeCache } from '@/composables/useRecipeCache'

const props = defineProps<{
  visible: boolean
  meals: CalendarMeal[]
}>()

defineEmits<{ close: [] }>()

const recipesStore = useRecipesStore()
const cache = useRecipeCache()
const { parseRecipe, getTitle, getBaseServings } = useCooklang()

const copyLabel = ref('Copier')
const copyKeepLabel = ref('Pour Google Keep')
const userAisleMap = ref(new Map<string, string>())

onMounted(async () => {
  const saved = await cache.getAllIngredientAisles()
  userAisleMap.value = new Map(saved.map(m => [m.ingredient, m.aisleId]))
})

// ── Types ──

interface ShoppingItem {
  name: string
  normName: string
  qty: string
  unit: string
  recipes: string[]
  aisleId: string
}

interface ShoppingGroup {
  category: string
  icon: string
  aisleId: string
  items: ShoppingItem[]
}

// ── Helpers ──

function singularize(name: string): string {
  let s = name.toLowerCase().trim()
  s = s.replace(/œ/g, 'oe')
  if (s === 'oeufs') return 'oeuf'
  if (s.endsWith('eaux')) return s.slice(0, -4) + 'eau'
  if (s.endsWith('aux') && !s.endsWith('eaux')) return s.slice(0, -3) + 'al'
  if (s.endsWith('oux')) return s.slice(0, -1)
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1)
  return s
}

function resolveAisle(normName: string): string {
  return userAisleMap.value.get(normName) ?? getDefaultAisle(normName)
}

async function reassignAisle(normName: string, newAisleId: string) {
  userAisleMap.value.set(normName, newAisleId)
  userAisleMap.value = new Map(userAisleMap.value)
  await cache.putIngredientAisle({ ingredient: normName, aisleId: newAisleId })
}

function scaleQuantity(qty: string | number, ratio: number): string | number {
  if (ratio === 1) return qty
  if (typeof qty === 'number') return qty * ratio
  const n = parseFloat(String(qty))
  if (!Number.isNaN(n)) return n * ratio
  return qty
}

function fmtQty(n: number): string {
  if (Number.isNaN(n)) return ''
  if (Number.isInteger(n)) return n.toString()
  return parseFloat(n.toFixed(2)).toString()
}

function formatQuantity(qty: string | number): string {
  if (qty === '' || qty === undefined || qty === null) return ''
  if (typeof qty === 'number') return fmtQty(qty)
  const n = parseFloat(String(qty))
  if (!Number.isNaN(n)) return fmtQty(n)
  return String(qty)
}

function mergeQty(existingQty: string, newQty: string | number): string {
  const a = existingQty ? parseFloat(existingQty) : NaN
  const b = typeof newQty === 'number' ? newQty : parseFloat(String(newQty))
  if (!Number.isNaN(a) && !Number.isNaN(b)) return fmtQty(a + b)
  if (!existingQty) return formatQuantity(newQty)
  return existingQty
}

function getRecipeTitle(recipePath: string): string {
  const recipe = recipesStore.getByPath(recipePath)
  if (recipe?.parsed) return getTitle(recipe.parsed, recipe.name)
  return recipePath.split('/').pop()?.replace('.cook', '') ?? '?'
}

// ── Computed ──

const mealCount = computed(() => {
  let count = 0
  for (const meal of props.meals) {
    for (const group of meal.groups) {
      count += group.entries.length
    }
  }
  return count
})

const shoppingList = computed<ShoppingGroup[]>(() => {
  const itemMap = new Map<string, ShoppingItem>()

  for (const meal of props.meals) {
    for (const group of meal.groups) {
      for (const entry of group.entries) {
        const recipe = recipesStore.getByPath(entry.recipePath)
        if (!recipe) continue

        let parsed = recipe.parsed
        if (!parsed && recipe.content) {
          parsed = parseRecipe(recipe.content)
        }
        if (!parsed) continue

        const baseServings = getBaseServings(parsed) ?? entry.totalPortions
        const ratio = entry.totalPortions / baseServings
        const recipeTitle = getRecipeTitle(entry.recipePath)

        for (const ing of parsed.ingredients) {
          const normName = singularize(ing.name)
          const normUnit = singularize(ing.units ?? '')
          const key = `${normName}|${normUnit}`
          const scaledQty = scaleQuantity(ing.quantity, ratio)

          const existing = itemMap.get(key)
          if (existing) {
            existing.qty = mergeQty(existing.qty, scaledQty)
            if (!existing.recipes.includes(recipeTitle)) {
              existing.recipes.push(recipeTitle)
            }
          } else {
            itemMap.set(key, {
              name: ing.name,
              normName,
              qty: formatQuantity(scaledQty),
              unit: normUnit,
              recipes: [recipeTitle],
              aisleId: resolveAisle(normName)
            })
          }
        }
      }
    }
  }

  if (itemMap.size === 0) return []

  const grouped = new Map<string, ShoppingItem[]>()
  for (const item of itemMap.values()) {
    item.aisleId = resolveAisle(item.normName)
    const list = grouped.get(item.aisleId) ?? []
    list.push(item)
    grouped.set(item.aisleId, list)
  }

  return AISLES
    .filter(a => grouped.has(a.id))
    .map(a => ({
      category: a.name,
      icon: a.icon,
      aisleId: a.id,
      items: grouped.get(a.id)!.sort((x, y) => x.name.localeCompare(y.name, 'fr-FR'))
    }))
})

// ── Copie presse-papier ──

async function copyForGoogleKeep() {
  const lines: string[] = []
  for (const group of shoppingList.value) {
    if (lines.length > 0) lines.push('')
    lines.push(`--- ${group.icon} ${group.category} ---`)
    for (const item of group.items) {
      const qty = item.qty ? `${item.qty}${item.unit ? ' ' + item.unit : ''} ` : ''
      lines.push(`${qty}${item.name}`)
    }
  }
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copyKeepLabel.value = 'Copié ✓'
    setTimeout(() => { copyKeepLabel.value = 'Pour Google Keep' }, 2000)
  } catch {
    copyKeepLabel.value = 'Erreur'
    setTimeout(() => { copyKeepLabel.value = 'Pour Google Keep' }, 2000)
  }
}

async function copyShoppingList() {
  const lines: string[] = []
  for (const group of shoppingList.value) {
    if (lines.length > 0) lines.push('')
    lines.push(`## ${group.icon} ${group.category}`)
    for (const item of group.items) {
      const qty = item.qty ? `${item.qty}${item.unit ? ' ' + item.unit : ''} ` : ''
      lines.push(`- ${qty}${item.name}`)
    }
  }
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copyLabel.value = 'Copié ✓'
    setTimeout(() => { copyLabel.value = 'Copier' }, 2000)
  } catch {
    copyLabel.value = 'Erreur'
    setTimeout(() => { copyLabel.value = 'Copier' }, 2000)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  position: relative;
  padding: 1.5rem 1.5rem 0.75rem;
}

.modal-header h2 {
  font-family: var(--font-serif);
  font-size: 1.4rem;
  font-weight: 600;
}

.modal-subtitle {
  font-size: 0.82rem;
  color: var(--color-muted);
}

.modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 50%;
  font-size: 1.2rem;
  color: var(--color-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.5rem;
}

.modal-empty {
  color: var(--color-muted);
  text-align: center;
  padding: 2rem 0;
  font-size: 0.88rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* ── Boutons ── */
.shop-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.shop-btn--ghost {
  background: var(--color-surface);
  color: var(--color-text);
}

.shop-btn--ghost:hover {
  background: var(--color-surface-alt);
}

.shop-btn--primary {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.shop-btn--primary:hover {
  opacity: 0.9;
}

/* ── Liste de courses ── */
.shop-group {
  margin-bottom: 1.25rem;
}

.shop-group-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.6rem;
  color: var(--color-text);
}

.shop-group-icon {
  font-size: 1rem;
}

.shop-group-count {
  font-size: 0.72rem;
  color: var(--color-muted);
  background: var(--color-surface-alt);
  padding: 0.1rem 0.45rem;
  border-radius: 99px;
  font-weight: 500;
}

.shop-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.shop-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.35rem 0;
  font-size: 0.88rem;
  border-bottom: 1px solid var(--color-border);
}

.shop-item:last-child {
  border-bottom: none;
}

.shop-item-check {
  color: var(--color-border);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.shop-item-qty {
  font-weight: 600;
  color: var(--color-accent);
  white-space: nowrap;
  min-width: 3.5rem;
}

.shop-item-name {
  flex: 1;
}

.shop-item-recipes {
  font-size: 0.72rem;
  color: var(--color-muted);
  white-space: nowrap;
}

.shop-item-aisle {
  font-size: 0.68rem;
  color: var(--color-muted);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.1rem 0.3rem;
  cursor: pointer;
  flex-shrink: 0;
  max-width: 7rem;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5' fill='none' stroke='%237d7670' stroke-width='2'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.2rem center;
  padding-right: 1rem;
}

.shop-item-aisle:hover {
  border-color: var(--color-accent);
}
</style>
