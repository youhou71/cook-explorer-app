/**
 * Store Pinia pour la planification de repas.
 *
 * Gère le planning hebdomadaire (assignation recette → jour/créneau) avec
 * persistance IndexedDB. Le planning est identifié par la date ISO du lundi
 * de la semaine (`weekStart`).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MealPlan, MealSlot } from '@/types'
import { useRecipeCache } from '@/composables/useRecipeCache'

/**
 * Retourne la date ISO (YYYY-MM-DD) du lundi de la semaine contenant `date`.
 */
export function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export const useMealPlanStore = defineStore('mealplan', () => {
  const cache = useRecipeCache()

  /** Date ISO du lundi de la semaine affichée. */
  const weekStart = ref(getMonday(new Date()))

  /** Liste des repas assignés pour la semaine courante. */
  const meals = ref<MealSlot[]>([])

  /** Charge le planning de la semaine depuis IndexedDB. */
  async function loadWeek(monday: string) {
    weekStart.value = monday
    const plan = await cache.getMealPlan(monday)
    meals.value = plan?.meals ?? []
  }

  /** Persiste le planning courant dans IndexedDB (clone les données pour éviter les Proxy Vue). */
  async function save() {
    await cache.putMealPlan({
      weekStart: weekStart.value,
      meals: meals.value.map(m => ({ day: m.day, slot: m.slot, recipePath: m.recipePath, servings: m.servings, span: m.span }))
    })
  }

  /** Ajoute une recette à un créneau (jour + slot). */
  async function addMeal(day: number, slot: 'lunch' | 'dinner', recipePath: string, servings: number) {
    meals.value.push({ day, slot, recipePath, servings, span: 1 })
    await save()
  }

  /** Retire un repas par position exacte (day + slot + recipePath). */
  async function removeMeal(day: number, slot: 'lunch' | 'dinner', recipePath: string) {
    const idx = meals.value.findIndex(
      m => m.day === day && m.slot === slot && m.recipePath === recipePath
    )
    if (idx >= 0) {
      meals.value.splice(idx, 1)
      await save()
    }
  }

  /** Met à jour le nombre de portions d'un repas. */
  async function updateServings(day: number, slot: 'lunch' | 'dinner', recipePath: string, servings: number) {
    const meal = meals.value.find(
      m => m.day === day && m.slot === slot && m.recipePath === recipePath
    )
    if (meal) {
      meal.servings = Math.max(1, servings)
      await save()
    }
  }

  /** Déplace un repas vers un autre jour/créneau. */
  async function moveMeal(fromDay: number, fromSlot: 'lunch' | 'dinner', recipePath: string, toDay: number, toSlot: 'lunch' | 'dinner') {
    const meal = meals.value.find(
      m => m.day === fromDay && m.slot === fromSlot && m.recipePath === recipePath
    )
    if (meal) {
      meal.day = toDay
      meal.slot = toSlot
      await save()
    }
  }

  /** Met à jour le nombre de jours couverts par un repas. */
  async function updateSpan(day: number, slot: 'lunch' | 'dinner', recipePath: string, span: number) {
    const meal = meals.value.find(
      m => m.day === day && m.slot === slot && m.recipePath === recipePath
    )
    if (meal) {
      meal.span = Math.max(1, Math.min(span, 7 - meal.day))
      await save()
    }
  }

  /** Retourne les repas qui commencent à ce créneau. */
  function getMeals(day: number, slot: 'lunch' | 'dinner'): MealSlot[] {
    return meals.value.filter(m => m.day === day && m.slot === slot)
  }

  /** Retourne les repas d'un jour précédent qui s'étendent jusqu'à ce créneau. */
  function getSpannedInto(day: number, slot: 'lunch' | 'dinner'): MealSlot[] {
    return meals.value.filter(m =>
      m.slot === slot && m.day < day && m.day + m.span > day
    )
  }

  /** Navigue vers la semaine précédente. */
  async function prevWeek() {
    const d = new Date(weekStart.value)
    d.setDate(d.getDate() - 7)
    await loadWeek(getMonday(d))
  }

  /** Navigue vers la semaine suivante. */
  async function nextWeek() {
    const d = new Date(weekStart.value)
    d.setDate(d.getDate() + 7)
    await loadWeek(getMonday(d))
  }

  /** Vide le planning de la semaine courante. */
  async function clearWeek() {
    meals.value = []
    await cache.deleteMealPlan(weekStart.value)
  }

  return {
    weekStart, meals,
    loadWeek, addMeal, removeMeal, moveMeal, updateServings, updateSpan, getMeals, getSpannedInto,
    prevWeek, nextWeek, clearWeek
  }
})
