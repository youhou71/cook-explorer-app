<!--
  Barre d'outils du calendrier : navigation semaine et contrôle de l'objectif de portions.
-->
<template>
  <div class="cal-toolbar">
    <div class="cal-toolbar__nav">
      <button class="cal-toolbar__btn" @click="store.navigatePrev()" title="Semaine précédente">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="cal-toolbar__btn cal-toolbar__btn--today" @click="store.goToToday()">Aujourd'hui</button>
      <button class="cal-toolbar__btn" @click="store.navigateNext()" title="Semaine suivante">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <h2 class="cal-toolbar__title">{{ periodLabel }}</h2>
    </div>

    <div class="cal-toolbar__actions">
      <div class="cal-toolbar__portions">
        <label class="cal-toolbar__portions-label">Objectif</label>
        <button class="cal-toolbar__btn cal-toolbar__btn--sm" @click="decreaseTarget">−</button>
        <span class="cal-toolbar__portions-value">{{ store.targetPortions }}p</span>
        <button class="cal-toolbar__btn cal-toolbar__btn--sm" @click="increaseTarget">+</button>
      </div>

      <button class="cal-toolbar__btn cal-toolbar__btn--shop" @click="$emit('open-shopping')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        Liste de courses
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarPlanStore } from '@/stores/calendarPlan'

defineEmits<{ 'open-shopping': [] }>()

import { monthName, getMonday, addDays } from '@/composables/useCalendarDates'

const store = useCalendarPlanStore()

const periodLabel = computed(() => {
  const monday = getMonday(store.viewDate)
  const sunday = addDays(monday, 6)
  const mLabel = `${monday.getDate()} ${monthName(monday.getMonth()).slice(0, 3).toLowerCase()}`
  const sLabel = `${sunday.getDate()} ${monthName(sunday.getMonth()).slice(0, 3).toLowerCase()} ${sunday.getFullYear()}`
  return `${mLabel} — ${sLabel}`
})

function increaseTarget() {
  store.targetPortions++
}

function decreaseTarget() {
  if (store.targetPortions > 1) store.targetPortions--
}
</script>

<style scoped>
.cal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  flex-wrap: wrap;
}

.cal-toolbar__nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cal-toolbar__title {
  font-family: var(--font-serif);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  margin-left: 0.5rem;
}

.cal-toolbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.cal-toolbar__btn:hover {
  background: var(--color-surface-alt);
}

.cal-toolbar__btn--today {
  padding: 0.35rem 0.75rem;
}

.cal-toolbar__btn--sm {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  font-size: 0.75rem;
}

.cal-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cal-toolbar__portions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.cal-toolbar__portions-label {
  font-size: 0.75rem;
  color: var(--color-muted);
  font-weight: 500;
  margin-right: 0.25rem;
}

.cal-toolbar__portions-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
  min-width: 24px;
  text-align: center;
}

.cal-toolbar__btn--shop {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.cal-toolbar__btn--shop:hover {
  opacity: 0.9;
  background: var(--color-accent);
}

@media (max-width: 600px) {
  .cal-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .cal-toolbar__actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
