/**
 * Store Pinia pour le calendrier de planification de repas.
 *
 * Gère la navigation semaine, les repas avec 3 groupes par créneau,
 * et la persistance IndexedDB par période mensuelle.
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type {
  CalendarPlan, CalendarMeal, CalendarMealGroup,
  CalendarRecipeEntry, MealGroupId, MealTimeSlot
} from '@/types'
import { useRecipeCache } from '@/composables/useRecipeCache'
import {
  addDays, getWeekDates, getRequiredPeriodKeys, monthKeyFromDate
} from '@/composables/useCalendarDates'

const MEAL_GROUPS: MealGroupId[] = ['entree', 'plat', 'dessert']

function emptyGroups(): CalendarMealGroup[] {
  return MEAL_GROUPS.map(g => ({ groupId: g, entries: [] }))
}

function createEmptyPlan(periodKey: string, targetPortions: number): CalendarPlan {
  return { periodKey, targetPortions, meals: [], updatedAt: Date.now() }
}

export const useCalendarPlanStore = defineStore('calendarPlan', () => {
  const cache = useRecipeCache()

  const viewDate = ref(new Date())
  const plans = ref(new Map<string, CalendarPlan>())
  const targetPortions = useLocalStorage('calendar-target-portions', 4)
  const loading = ref(false)

  const visibleDates = computed<Date[]>(() => getWeekDates(viewDate.value))

  const periodKeys = computed(() => getRequiredPeriodKeys(visibleDates.value))

  // ── Accès aux données ─────────────────────────────────────────────────

  function getPlan(periodKey: string): CalendarPlan {
    return plans.value.get(periodKey) ?? createEmptyPlan(periodKey, targetPortions.value)
  }

  function getMeal(date: string, slot: MealTimeSlot): CalendarMeal | undefined {
    const key = monthKeyFromDate(new Date(date + 'T00:00:00'))
    const plan = plans.value.get(key)
    return plan?.meals.find(m => m.date === date && m.slot === slot)
  }

  function getOrCreateMeal(date: string, slot: MealTimeSlot): { plan: CalendarPlan, meal: CalendarMeal } {
    const key = monthKeyFromDate(new Date(date + 'T00:00:00'))
    let plan = plans.value.get(key)
    if (!plan) {
      plan = createEmptyPlan(key, targetPortions.value)
      plans.value.set(key, plan)
    }
    let meal = plan.meals.find(m => m.date === date && m.slot === slot)
    if (!meal) {
      meal = { date, slot, groups: emptyGroups() }
      plan.meals.push(meal)
    }
    return { plan, meal }
  }

  /** Retourne toutes les entrées actives pour une date/slot/groupe (y compris les spans d'autres jours). */
  function getActiveEntries(date: string, slot: MealTimeSlot, groupId: MealGroupId): CalendarRecipeEntry[] {
    const result: CalendarRecipeEntry[] = []
    for (const plan of plans.value.values()) {
      for (const meal of plan.meals) {
        if (meal.slot !== slot) continue
        const group = meal.groups.find(g => g.groupId === groupId)
        if (!group) continue
        for (const entry of group.entries) {
          const start = new Date(entry.startDate + 'T00:00:00')
          const end = addDays(start, entry.span - 1)
          const target = new Date(date + 'T00:00:00')
          if (target >= start && target <= end) {
            result.push(entry)
          }
        }
      }
    }
    return result
  }

  /** Retourne les entrées qui démarrent exactement à cette date/slot/groupe. */
  function getStartingEntries(date: string, slot: MealTimeSlot, groupId: MealGroupId): CalendarRecipeEntry[] {
    const meal = getMeal(date, slot)
    if (!meal) return []
    const group = meal.groups.find(g => g.groupId === groupId)
    return group?.entries ?? []
  }

  // ── Chargement / Sauvegarde ───────────────────────────────────────────

  async function loadPeriods() {
    loading.value = true
    try {
      const loaded = await cache.getCalendarPlansForKeys(periodKeys.value)
      for (const plan of loaded) {
        plans.value.set(plan.periodKey, plan)
      }
    } finally {
      loading.value = false
    }
  }

  async function savePlan(periodKey: string) {
    const plan = plans.value.get(periodKey)
    if (!plan) return
    plan.updatedAt = Date.now()
    plan.targetPortions = targetPortions.value
    const raw: CalendarPlan = JSON.parse(JSON.stringify(plan))
    await cache.putCalendarPlan(raw)
  }

  watch(() => periodKeys.value.join(','), () => loadPeriods(), { immediate: true })

  // ── Actions CRUD ──────────────────────────────────────────────────────

  async function addEntry(date: string, slot: MealTimeSlot, groupId: MealGroupId, recipePath: string, portions: number) {
    const { plan, meal } = getOrCreateMeal(date, slot)
    let group = meal.groups.find(g => g.groupId === groupId)
    if (!group) {
      group = { groupId, entries: [] }
      meal.groups.push(group)
    }
    const entry: CalendarRecipeEntry = {
      id: crypto.randomUUID(),
      recipePath,
      startDate: date,
      span: 1,
      totalPortions: portions
    }
    group.entries.push(entry)
    await savePlan(plan.periodKey)
    return entry.id
  }

  async function removeEntry(date: string, slot: MealTimeSlot, groupId: MealGroupId, entryId: string) {
    const { plan, meal } = getOrCreateMeal(date, slot)
    const group = meal.groups.find(g => g.groupId === groupId)
    if (!group) return
    const idx = group.entries.findIndex(e => e.id === entryId)
    if (idx >= 0) {
      group.entries.splice(idx, 1)
      await savePlan(plan.periodKey)
    }
  }

  function findEntry(entryId: string): { plan: CalendarPlan, meal: CalendarMeal, group: CalendarMealGroup, entry: CalendarRecipeEntry } | null {
    for (const plan of plans.value.values()) {
      for (const meal of plan.meals) {
        for (const group of meal.groups) {
          const entry = group.entries.find(e => e.id === entryId)
          if (entry) return { plan, meal, group, entry }
        }
      }
    }
    return null
  }

  async function moveEntry(entryId: string, toDate: string, toSlot: MealTimeSlot, toGroupId: MealGroupId) {
    const found = findEntry(entryId)
    if (!found) return

    const { plan: fromPlan, group: fromGroup, entry } = found
    const idx = fromGroup.entries.findIndex(e => e.id === entryId)
    if (idx >= 0) fromGroup.entries.splice(idx, 1)

    entry.startDate = toDate
    const { plan: toPlan, meal: toMeal } = getOrCreateMeal(toDate, toSlot)
    let toGroup = toMeal.groups.find(g => g.groupId === toGroupId)
    if (!toGroup) {
      toGroup = { groupId: toGroupId, entries: [] }
      toMeal.groups.push(toGroup)
    }
    toGroup.entries.push(entry)

    await savePlan(fromPlan.periodKey)
    if (fromPlan.periodKey !== toPlan.periodKey) {
      await savePlan(toPlan.periodKey)
    }
  }

  async function updateSpan(entryId: string, newSpan: number) {
    const found = findEntry(entryId)
    if (!found) return
    found.entry.span = Math.max(1, newSpan)
    await savePlan(found.plan.periodKey)
  }

  async function updatePortions(entryId: string, portions: number) {
    const found = findEntry(entryId)
    if (!found) return
    found.entry.totalPortions = Math.max(1, portions)
    await savePlan(found.plan.periodKey)
  }

  // ── Navigation ────────────────────────────────────────────────────────

  function navigatePrev() {
    viewDate.value = addDays(viewDate.value, -7)
  }

  function navigateNext() {
    viewDate.value = addDays(viewDate.value, 7)
  }

  function goToToday() {
    viewDate.value = new Date()
  }

  async function clearPeriod(periodKey: string) {
    plans.value.delete(periodKey)
    await cache.deleteCalendarPlan(periodKey)
  }

  return {
    viewDate, plans, targetPortions, loading,
    visibleDates, periodKeys,
    getPlan, getMeal, getActiveEntries, getStartingEntries,
    loadPeriods, savePlan,
    addEntry, removeEntry, moveEntry, updateSpan, updatePortions, findEntry,
    navigatePrev, navigateNext, goToToday, clearPeriod
  }
})
