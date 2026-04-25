/**
 * Utilitaires de dates pour le calendrier de planification.
 *
 * Fournit les fonctions de calcul de grilles mensuelles/hebdomadaires
 * et de formatage pour l'interface du calendrier.
 */

/** Formate une Date en chaîne ISO YYYY-MM-DD (fuseau local). */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Retourne la clé de période mensuelle pour une date : "2026-04". */
export function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Retourne le lundi de la semaine contenant `date`. */
export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Ajoute N jours à une date (retourne une nouvelle Date). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Retourne les 7 dates (lundi→dimanche) de la semaine contenant `anchorDate`.
 */
export function getWeekDates(anchorDate: Date): Date[] {
  const monday = getMonday(anchorDate)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/**
 * Retourne toutes les dates de la grille mensuelle (6 lignes × 7 colonnes = 42 jours).
 * Commence au lundi de la première semaine affichée et termine au dimanche
 * de la dernière semaine.
 */
export function getMonthGridDates(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  const monday = getMonday(firstOfMonth)
  return Array.from({ length: 42 }, (_, i) => addDays(monday, i))
}

/**
 * Retourne les clés de périodes mensuelles nécessaires pour couvrir une plage de dates.
 * Utile quand une semaine chevauche deux mois.
 */
export function getRequiredPeriodKeys(dates: Date[]): string[] {
  const keys = new Set<string>()
  for (const d of dates) {
    keys.add(monthKeyFromDate(d))
  }
  return Array.from(keys).sort()
}

/** Vérifie si deux dates ISO (YYYY-MM-DD) représentent le même jour. */
export function isSameDay(a: string, b: string): boolean {
  return a === b
}

/** Vérifie si une date ISO tombe aujourd'hui. */
export function isToday(dateISO: string): boolean {
  return dateISO === toISODate(new Date())
}

/** Vérifie si une date tombe dans le mois donné (year, month 0-indexed). */
export function isInMonth(dateISO: string, year: number, month: number): boolean {
  const d = new Date(dateISO + 'T00:00:00')
  return d.getFullYear() === year && d.getMonth() === month
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const
const DAY_NAMES_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'] as const

/** Retourne le nom court du jour (Lun, Mar…) pour un index 0-6 (0=lundi). */
export function dayName(index: number): string {
  return DAY_NAMES[index]
}

/** Retourne le nom complet du jour pour un index 0-6 (0=lundi). */
export function dayNameFull(index: number): string {
  return DAY_NAMES_FULL[index]
}

/** Retourne le nom du mois pour un index 0-11. */
export function monthName(index: number): string {
  return MONTH_NAMES[index]
}

/** Retourne l'index jour-de-semaine 0-6 (0=lundi) pour une Date. */
export function dayOfWeekIndex(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

/** Formate une date en label lisible : "Lundi 21 avril". */
export function formatDateLabel(date: Date): string {
  const dow = dayNameFull(dayOfWeekIndex(date))
  const d = date.getDate()
  const m = MONTH_NAMES[date.getMonth()].toLowerCase()
  return `${dow} ${d} ${m}`
}
