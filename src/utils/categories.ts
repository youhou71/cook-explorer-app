/**
 * Ordre prioritaire des types de plat.
 * Les autres catégories apparaissent après, par ordre alphabétique.
 */
const PRIORITY_ORDER = ['entree', 'plat', 'dessert', 'snack']

/** Normalise une catégorie pour comparaison : lowercase, sans accents, sans pluriel final */
function normalize(cat: string): string {
  return cat
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/s$/, '')
}

/** Retourne l'index de priorité d'une catégorie (les catégories prioritaires ont un index bas) */
export function categoryOrder(cat: string): number {
  const idx = PRIORITY_ORDER.indexOf(normalize(cat))
  return idx === -1 ? PRIORITY_ORDER.length : idx
}

/** Comparateur pour trier les catégories : prioritaires d'abord, puis alphabétique */
export function compareCategories(a: string, b: string): number {
  const orderA = categoryOrder(a)
  const orderB = categoryOrder(b)
  if (orderA !== orderB) return orderA - orderB
  return a.localeCompare(b)
}
