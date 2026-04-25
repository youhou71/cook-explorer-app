<!--
  Grille hebdomadaire structurée par lignes de groupes.
  Chaque combo (slot, groupe) est une sous-grille 7 colonnes.
  Les entrées multi-jours utilisent grid-column: span N pour couvrir
  naturellement plusieurs colonnes sans chevauchement.
-->
<template>
  <div class="week-grid">
    <!-- En-têtes des jours -->
    <div class="week-grid__header">
      <div v-for="(date, i) in dates" :key="i" class="week-grid__header-cell">
        <span class="week-grid__day-name">{{ dayNameFull(dayOfWeekIndex(date)) }}</span>
        <span class="week-grid__day-num" :class="{ 'week-grid__day-num--today': isToday(toISODate(date)) }">
          {{ date.getDate() }}
        </span>
      </div>
    </div>

    <!-- Pour chaque créneau (déjeuner, dîner) -->
    <div v-for="slot in slots" :key="slot" class="week-grid__slot">
      <div class="week-grid__slot-header">{{ slotLabels[slot] }}</div>

      <!-- Pour chaque groupe (entrée, plat, dessert) -->
      <div v-for="gid in groupIds" :key="gid" class="week-grid__group">
        <div class="week-grid__group-label" :class="`week-grid__group-label--${gid}`">
          {{ groupLabels[gid] }}
        </div>

        <!-- Grille 7 colonnes : cellules + barres spanning -->
        <div
          class="week-grid__group-grid"
          @dragover="(e: DragEvent) => onGridDragOver(e, slot, gid)"
          @dragleave="dnd.onDragLeave()"
          @drop="(e: DragEvent) => onGridDrop(e, slot, gid)"
          @click="(e: MouseEvent) => onGridClick(e, slot, gid)"
        >
          <!-- Highlight de drop pleine hauteur -->
          <div
            v-if="getDropCol(slot, gid) >= 0"
            class="week-grid__drop-highlight"
            :style="dropHighlightStyle(getDropCol(slot, gid))"
          />

          <!-- Cellules visuelles pour chaque jour -->
          <div
            v-for="(date, col) in dates"
            :key="toISODate(date)"
            class="week-grid__cell"
            :style="{ gridColumn: col + 1, gridRow: 1 }"
          >
            <!-- Entrées single-day uniquement -->
            <CalendarRecipeChip
              v-for="entry in getSingleDayEntries(toISODate(date), slot, gid)"
              :key="entry.id"
              :entry="entry"
              @remove="store.removeEntry(toISODate(date), slot, gid, entry.id)"
              @update-portions="(p: number) => store.updatePortions(entry.id, p)"
              @drag-start="(e: DragEvent) => dnd.startDragFromCalendar(e, entry.id, entry.recipePath, toISODate(date), slot, gid)"
              @drag-end="dnd.onDragEnd()"
              @resize-start="(e: MouseEvent) => onResizeStart(e, entry)"
            />
          </div>

          <!-- Barres spanning (multi-jours) au même niveau grid -->
          <div
            v-for="span in getSpanningEntries(slot, gid)"
            :key="span.entry.id"
            class="week-grid__span-bar"
            :style="{ gridColumn: `${span.startCol + 1} / span ${span.visibleSpan}`, gridRow: span.row }"
          >
            <CalendarRecipeChip
              :entry="span.entry"
              @remove="store.removeEntry(span.entry.startDate, slot, gid, span.entry.id)"
              @update-portions="(p: number) => store.updatePortions(span.entry.id, p)"
              @drag-start="(e: DragEvent) => dnd.startDragFromCalendar(e, span.entry.id, span.entry.recipePath, span.entry.startDate, slot, gid)"
              @drag-end="dnd.onDragEnd()"
              @resize-start="(e: MouseEvent) => onResizeStart(e, span.entry)"
            />
          </div>
        </div>

        <!-- Barres de portions, une par jour -->
        <div class="week-grid__portion-row">
          <CalendarPortionBar
            v-for="(date, col) in dates"
            :key="toISODate(date)"
            :filled="getAllocationFn(toISODate(date), slot, gid).filled"
            :target="getAllocationFn(toISODate(date), slot, gid).target"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MealTimeSlot, MealGroupId, CalendarRecipeEntry } from '@/types'
import type { GroupAllocation } from '@/composables/usePortionAllocation'
import { toISODate, dayNameFull, dayOfWeekIndex, isToday } from '@/composables/useCalendarDates'
import type { useCalendarDnD } from '@/composables/useCalendarDnD'
import { useCalendarPlanStore } from '@/stores/calendarPlan'
import CalendarRecipeChip from './CalendarRecipeChip.vue'
import CalendarPortionBar from './CalendarPortionBar.vue'

const slots: MealTimeSlot[] = ['lunch', 'dinner']
const groupIds: MealGroupId[] = ['entree', 'plat', 'dessert']

const slotLabels: Record<MealTimeSlot, string> = { lunch: 'Déjeuner', dinner: 'Dîner' }
const groupLabels: Record<MealGroupId, string> = { entree: 'Entrée', plat: 'Plat', dessert: 'Dessert' }

const props = defineProps<{
  dates: Date[]
  dnd: ReturnType<typeof useCalendarDnD>
  getAllocationFn: (date: string, slot: MealTimeSlot, groupId: MealGroupId) => GroupAllocation
}>()

const emit = defineEmits<{
  'resize-start': [e: MouseEvent, entry: CalendarRecipeEntry]
}>()

const store = useCalendarPlanStore()

const dateISOs = () => props.dates.map(d => toISODate(d))

function getSingleDayEntries(date: string, slot: MealTimeSlot, groupId: MealGroupId): CalendarRecipeEntry[] {
  return store.getStartingEntries(date, slot, groupId).filter(e => e.span <= 1)
}

interface SpanInfo {
  entry: CalendarRecipeEntry
  startCol: number
  visibleSpan: number
  row: number
}

function columnsOverlap(startA: number, spanA: number, startB: number, spanB: number): boolean {
  return startA < startB + spanB && startB < startA + spanA
}

function getSpanningEntries(slot: MealTimeSlot, groupId: MealGroupId): SpanInfo[] {
  const isos = dateISOs()
  const result: SpanInfo[] = []
  for (let col = 0; col < isos.length; col++) {
    const entries = store.getStartingEntries(isos[col], slot, groupId).filter(e => e.span > 1)
    for (const entry of entries) {
      const visibleSpan = Math.min(entry.span, 7 - col)
      let row = 2
      while (result.some(o => o.row === row && columnsOverlap(col, visibleSpan, o.startCol, o.visibleSpan))) {
        row++
      }
      result.push({ entry, startCol: col, visibleSpan, row })
    }
  }
  return result
}

function getColFromGridEvent(e: { clientX: number, currentTarget: EventTarget | null }): number {
  const grid = e.currentTarget as HTMLElement
  const rect = grid.getBoundingClientRect()
  const x = e.clientX - rect.left
  return Math.min(6, Math.max(0, Math.floor(x / (rect.width / 7))))
}

function onGridDragOver(e: DragEvent, slot: MealTimeSlot, gid: MealGroupId) {
  const col = getColFromGridEvent(e)
  const isos = dateISOs()
  if (isos[col]) props.dnd.onDragOver(e, isos[col], slot, gid)
}

function onGridDrop(e: DragEvent, slot: MealTimeSlot, gid: MealGroupId) {
  const col = getColFromGridEvent(e)
  const isos = dateISOs()
  if (isos[col]) props.dnd.onDrop(e, isos[col], slot, gid, store.targetPortions)
}

function onGridClick(e: MouseEvent, slot: MealTimeSlot, gid: MealGroupId) {
  if (!props.dnd.touchPlacement.value) return
  const col = getColFromGridEvent(e)
  const isos = dateISOs()
  if (isos[col]) props.dnd.completeTouchPlacement(isos[col], slot, gid, store.targetPortions)
}

function getDropCol(slot: MealTimeSlot, gid: MealGroupId): number {
  const t = props.dnd.dropTarget.value
  if (!t || t.slot !== slot || t.groupId !== gid) return -1
  const isos = dateISOs()
  return isos.indexOf(t.date)
}

function dropHighlightStyle(col: number): Record<string, string> {
  return {
    left: `calc(${col} * (100% + 4px) / 7)`,
    width: `calc((100% - 24px) / 7)`
  }
}

function onResizeStart(e: MouseEvent, entry: CalendarRecipeEntry) {
  emit('resize-start', e, entry)
}
</script>

<style scoped>
.week-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── En-têtes jours ── */
.week-grid__header {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 4px;
}

.week-grid__header-cell {
  text-align: center;
  padding: 6px 4px;
  border-right: 1px solid var(--color-border);
}

.week-grid__header-cell:last-child {
  border-right: none;
}


.week-grid__day-name {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.week-grid__day-num {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.week-grid__day-num--today {
  background: var(--color-accent);
  color: white;
}

/* ── Créneau (déjeuner/dîner) ── */
.week-grid__slot {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  margin-bottom: 8px;
  overflow: hidden;
}

.week-grid__slot-header {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text);
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-alt);
}

/* ── Groupe (entrée/plat/dessert) ── */
.week-grid__group {
  padding: 4px 8px 8px;
}

.week-grid__group-label {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
  padding: 2px 4px;
}

.week-grid__group-label--entree { color: var(--color-warm); }
.week-grid__group-label--plat { color: var(--color-accent); }
.week-grid__group-label--dessert { color: var(--color-plum); }

/* ── Grille 7 colonnes par groupe ── */
.week-grid__group-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  min-height: 32px;
  align-items: start;
  position: relative;
  background-image: linear-gradient(
    to right,
    transparent calc(100% - 3px),
    var(--color-border) calc(100% - 3px),
    var(--color-border) calc(100% - 2px),
    transparent calc(100% - 2px)
  );
  background-size: calc((100% + 4px) / 7) 100%;
  background-repeat: repeat-x;
}

.week-grid__cell {
  min-height: 28px;
  padding: 2px;
  border-radius: 4px;
  border: 1px dashed transparent;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.week-grid__cell:hover {
  background: var(--color-surface-alt);
}

.week-grid__drop-highlight {
  position: absolute;
  top: 0;
  bottom: 0;
  border: 1px dashed var(--color-accent);
  background: var(--color-accent-light);
  border-radius: 4px;
  pointer-events: none;
  z-index: 1;
}

/* ── Barre spanning multi-jours ── */
.week-grid__span-bar {
  z-index: 2;
  padding: 2px;
}

/* ── Barres de portions ── */
.week-grid__portion-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  padding: 0 2px;
}

@media (max-width: 768px) {
  .week-grid__header {
    display: none;
  }
  .week-grid__group-grid {
    grid-template-columns: 1fr;
  }
  .week-grid__portion-row {
    grid-template-columns: 1fr;
  }
}
</style>
