/**
 * Algorithme d'allocation gloutonne des portions avec report jour→jour.
 *
 * Chaque créneau (lunch/dinner) et chaque groupe (entrée/plat/dessert) sont
 * traités indépendamment. Les portions non consommées d'une entrée sont
 * automatiquement reportées au jour suivant dans le même créneau/groupe.
 */

import { computed, type Ref } from 'vue'
import type {
  CalendarMeal, CalendarRecipeEntry, MealGroupId, MealTimeSlot
} from '@/types'

export interface EntryAllocation {
  entryId: string
  recipePath: string
  used: number
  isCarryOver: boolean
}

export interface GroupAllocation {
  date: string
  slot: MealTimeSlot
  groupId: MealGroupId
  target: number
  filled: number
  entries: EntryAllocation[]
}

type AllocationKey = string

function makeKey(date: string, slot: MealTimeSlot, groupId: MealGroupId): AllocationKey {
  return `${date}|${slot}|${groupId}`
}

const SLOTS: MealTimeSlot[] = ['lunch', 'dinner']
const GROUPS: MealGroupId[] = ['entree', 'plat', 'dessert']

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function computeAllocations(
  meals: CalendarMeal[],
  targetPortions: number,
  sortedDates: string[]
): Map<AllocationKey, GroupAllocation> {
  const result = new Map<AllocationKey, GroupAllocation>()

  for (const slot of SLOTS) {
    for (const groupId of GROUPS) {
      const entryRemaining = new Map<string, { remaining: number, recipePath: string, startDate: string }>()

      // Collecter toutes les entrées pour ce slot/groupe
      for (const meal of meals) {
        if (meal.slot !== slot) continue
        const group = meal.groups.find(g => g.groupId === groupId)
        if (!group) continue
        for (const entry of group.entries) {
          if (!entryRemaining.has(entry.id)) {
            entryRemaining.set(entry.id, {
              remaining: entry.totalPortions,
              recipePath: entry.recipePath,
              startDate: entry.startDate
            })
          }
        }
      }

      for (const date of sortedDates) {
        const alloc: GroupAllocation = {
          date, slot, groupId,
          target: targetPortions,
          filled: 0,
          entries: []
        }
        let remaining = targetPortions

        // Collecter les entrées actives ce jour (soit par span, soit par startDate)
        const carryOverEntries: CalendarRecipeEntry[] = []
        const newEntries: CalendarRecipeEntry[] = []

        for (const meal of meals) {
          if (meal.slot !== slot) continue
          const group = meal.groups.find(g => g.groupId === groupId)
          if (!group) continue
          for (const entry of group.entries) {
            const endDate = addDaysISO(entry.startDate, entry.span - 1)
            if (date >= entry.startDate && date <= endDate) {
              if (entry.startDate < date) {
                carryOverEntries.push(entry)
              } else if (entry.startDate === date) {
                newEntries.push(entry)
              }
            }
          }
        }

        // 1. Consommer les reports (carry-over) d'abord
        for (const entry of carryOverEntries) {
          if (remaining <= 0) break
          const info = entryRemaining.get(entry.id)
          if (!info || info.remaining <= 0) continue
          const take = Math.min(info.remaining, remaining)
          alloc.entries.push({
            entryId: entry.id,
            recipePath: info.recipePath,
            used: take,
            isCarryOver: true
          })
          info.remaining -= take
          remaining -= take
          alloc.filled += take
        }

        // 2. Consommer les nouvelles entrées du jour
        for (const entry of newEntries) {
          if (remaining <= 0) break
          const info = entryRemaining.get(entry.id)
          if (!info || info.remaining <= 0) continue
          const take = Math.min(info.remaining, remaining)
          alloc.entries.push({
            entryId: entry.id,
            recipePath: info.recipePath,
            used: take,
            isCarryOver: false
          })
          info.remaining -= take
          remaining -= take
          alloc.filled += take
        }

        result.set(makeKey(date, slot, groupId), alloc)
      }
    }
  }

  return result
}

/**
 * Composable réactif pour le calcul d'allocation des portions.
 */
export function usePortionAllocation(
  meals: Ref<CalendarMeal[]>,
  targetPortions: Ref<number>,
  dateRange: Ref<string[]>
) {
  const allocations = computed(() =>
    computeAllocations(meals.value, targetPortions.value, dateRange.value)
  )

  function getAllocation(date: string, slot: MealTimeSlot, groupId: MealGroupId): GroupAllocation {
    return allocations.value.get(makeKey(date, slot, groupId)) ?? {
      date, slot, groupId,
      target: targetPortions.value,
      filled: 0,
      entries: []
    }
  }

  return { allocations, getAllocation }
}
