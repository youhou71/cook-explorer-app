/**
 * Logique de drag & drop pour le calendrier de planification.
 *
 * Encapsule le state du drag en cours et les handlers d'événements HTML5.
 * Gère le drag depuis la sidebar (nouvelle recette) et depuis le calendrier
 * (déplacement d'une entrée existante).
 */

import { ref } from 'vue'
import type { MealGroupId, MealTimeSlot } from '@/types'
import type { useCalendarPlanStore } from '@/stores/calendarPlan'

export interface DragState {
  type: 'sidebar' | 'calendar'
  recipePath: string
  entryId?: string
  fromDate?: string
  fromSlot?: MealTimeSlot
  fromGroupId?: MealGroupId
}

export interface DropTarget {
  date: string
  slot: MealTimeSlot
  groupId: MealGroupId
}

export function useCalendarDnD(store: ReturnType<typeof useCalendarPlanStore>) {
  const dragState = ref<DragState | null>(null)
  const dropTarget = ref<DropTarget | null>(null)
  /** Mode "placement" tactile : recette sélectionnée en attente de tap sur une zone cible. */
  const touchPlacement = ref<{ recipePath: string } | null>(null)

  function startDragFromSidebar(e: DragEvent, recipePath: string) {
    dragState.value = { type: 'sidebar', recipePath }
    e.dataTransfer!.effectAllowed = 'copy'
    e.dataTransfer!.setData('text/plain', recipePath)
  }

  function startDragFromCalendar(
    e: DragEvent,
    entryId: string,
    recipePath: string,
    date: string,
    slot: MealTimeSlot,
    groupId: MealGroupId
  ) {
    dragState.value = {
      type: 'calendar',
      recipePath,
      entryId,
      fromDate: date,
      fromSlot: slot,
      fromGroupId: groupId
    }
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData('text/plain', recipePath)
  }

  function onDragOver(e: DragEvent, date: string, slot: MealTimeSlot, groupId: MealGroupId) {
    e.preventDefault()
    e.dataTransfer!.dropEffect = dragState.value?.type === 'calendar' ? 'move' : 'copy'
    dropTarget.value = { date, slot, groupId }
  }

  function onDragLeave() {
    dropTarget.value = null
  }

  async function onDrop(e: DragEvent, date: string, slot: MealTimeSlot, groupId: MealGroupId, defaultPortions: number) {
    e.preventDefault()
    dropTarget.value = null

    if (!dragState.value) return

    if (dragState.value.type === 'calendar' && dragState.value.entryId) {
      await store.moveEntry(dragState.value.entryId, date, slot, groupId)
    } else {
      await store.addEntry(date, slot, groupId, dragState.value.recipePath, defaultPortions)
    }

    dragState.value = null
  }

  function onDragEnd() {
    dragState.value = null
    dropTarget.value = null
  }

  // ── Mode tactile ──────────────────────────────────────────────────────

  function startTouchPlacement(recipePath: string) {
    touchPlacement.value = { recipePath }
  }

  function cancelTouchPlacement() {
    touchPlacement.value = null
  }

  async function completeTouchPlacement(date: string, slot: MealTimeSlot, groupId: MealGroupId, defaultPortions: number) {
    if (!touchPlacement.value) return
    await store.addEntry(date, slot, groupId, touchPlacement.value.recipePath, defaultPortions)
    touchPlacement.value = null
  }

  function isDropTarget(date: string, slot: MealTimeSlot, groupId: MealGroupId): boolean {
    const t = dropTarget.value
    return t !== null && t.date === date && t.slot === slot && t.groupId === groupId
  }

  return {
    dragState, dropTarget, touchPlacement,
    startDragFromSidebar, startDragFromCalendar,
    onDragOver, onDragLeave, onDrop, onDragEnd,
    startTouchPlacement, cancelTouchPlacement, completeTouchPlacement,
    isDropTarget
  }
}
