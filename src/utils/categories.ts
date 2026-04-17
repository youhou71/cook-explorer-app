/**
 * Utilitaires pour la gestion des catégories (types de plats).
 *
 * Dans CookExplorer, une « catégorie » correspond au dossier racine dans lequel
 * une recette est rangée (ex : `plats/poulet-roti.cook` → catégorie "plats").
 *
 * Ce module fournit :
 *  - Le tri des catégories, paramétrable via un `Map<string, CategorySettings>`.
 *    Quand aucun settings n'est fourni, un ordre legacy codé en dur est utilisé.
 *  - La construction d'un objet `CategorySettings` complet à partir d'un JSON
 *    partiel lu depuis un fichier `.category.json`, avec des valeurs par défaut.
 *  - L'extraction du nom de catégorie depuis le chemin d'un fichier recette.
 */

import type { CategorySettings } from '@/types'

/**
 * Ordre de priorité historique, utilisé quand aucun `.category.json` n'est configuré.
 * Les catégories absentes de cette liste apparaissent après, triées alphabétiquement.
 */
const LEGACY_ORDER = ['entree', 'plat', 'dessert', 'snack']

/**
 * Normalise un nom de catégorie pour la comparaison :
 * minuscule, sans accents (NFD + strip diacritiques), sans pluriel final.
 * Permet de matcher "Entrées" avec "entree", "Plats" avec "plat", etc.
 */
function normalize(cat: string): string {
  return cat
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/s$/, '')
}

/**
 * Retourne l'index de tri d'une catégorie.
 *
 * @param cat - Nom de la catégorie (nom du dossier, ex : "plats")
 * @param settingsMap - Map folder→CategorySettings (optionnel). Si fourni et non
 *   vide, l'ordre est lu depuis le champ `order` des settings. Sinon, fallback
 *   sur l'ordre legacy (`LEGACY_ORDER`).
 * @returns Un nombre : plus il est bas, plus la catégorie apparaît en premier.
 *   `Infinity` si la catégorie n'est pas trouvée dans les settings.
 */
export function categoryOrder(cat: string, settingsMap?: Map<string, CategorySettings>): number {
  if (settingsMap?.size) {
    // Recherche directe par nom de dossier
    const settings = settingsMap.get(cat)
    if (settings) return settings.order
    // Recherche normalisée (gère les différences d'accent / pluriel)
    for (const [folder, s] of settingsMap) {
      if (normalize(folder) === normalize(cat)) return s.order
    }
    return Infinity
  }
  // Fallback : ordre legacy codé en dur
  const idx = LEGACY_ORDER.indexOf(normalize(cat))
  return idx === -1 ? LEGACY_ORDER.length : idx
}

/**
 * Comparateur pour trier un tableau de noms de catégories.
 * Tri principal par `order` (croissant), tri secondaire alphabétique.
 *
 * @param a - Première catégorie
 * @param b - Deuxième catégorie
 * @param settingsMap - Map folder→CategorySettings (optionnel)
 * @returns Nombre négatif si a < b, positif si a > b, 0 si égaux.
 *
 * @example
 * // Tri avec settings dynamiques depuis le store Pinia :
 * categories.sort((a, b) => compareCategories(a, b, recipesStore.categoryMap))
 *
 * // Tri avec l'ordre legacy (sans settings) :
 * categories.sort(compareCategories)
 */
export function compareCategories(a: string, b: string, settingsMap?: Map<string, CategorySettings>): number {
  const orderA = categoryOrder(a, settingsMap)
  const orderB = categoryOrder(b, settingsMap)
  if (orderA !== orderB) return orderA - orderB
  return a.localeCompare(b)
}

/**
 * Valeurs par défaut pour tous les champs d'un CategorySettings (sauf `folder`).
 * Utilisées quand un champ est absent ou invalide dans le `.category.json`.
 */
const DEFAULTS: Omit<CategorySettings, 'folder'> = {
  name: '',             // fallback : le nom du dossier sera utilisé
  color: '#6b8f71',     // vert sauge (couleur primaire du thème)
  colorSecondary: '#eef4ef', // vert sauge clair
  order: Infinity,      // apparaîtra après les catégories ordonnées
  hours: [],            // aucune heure de consommation par défaut
  icon: '📁',           // icône générique
  description: ''       // pas de description
}

/**
 * Construit un objet `CategorySettings` complet à partir d'un JSON partiel
 * provenant d'un fichier `.category.json`. Chaque champ est validé et
 * remplacé par sa valeur par défaut si absent ou de mauvais type.
 *
 * @param folder - Nom du dossier (clé primaire, ex : "plats")
 * @param json - Objet JSON brut lu depuis le fichier `.category.json`. Peut être
 *   vide (`{}`) pour obtenir un settings entièrement par défaut.
 * @param sha - SHA Git du fichier `.category.json` (nécessaire pour les mises à jour
 *   via l'API GitHub). Absent si le fichier n'existe pas encore.
 * @returns Un objet `CategorySettings` complet, prêt à être stocké en cache.
 */
export function buildCategorySettings(folder: string, json: Record<string, unknown> = {}, sha?: string): CategorySettings {
  return {
    folder,
    // Nom d'affichage : utiliser le nom fourni ou le nom du dossier en fallback
    name: typeof json.name === 'string' && json.name ? json.name : folder,
    // Couleur principale
    color: typeof json.color === 'string' ? json.color : DEFAULTS.color,
    // Couleur secondaire : accepte `colorSecondary` (camelCase) ou `color_secondary` (snake_case)
    colorSecondary: typeof json.colorSecondary === 'string'
      ? json.colorSecondary
      : typeof json.color_secondary === 'string'
        ? json.color_secondary
        : DEFAULTS.colorSecondary,
    // Ordre de tri (doit être un nombre)
    order: typeof json.order === 'number' ? json.order : DEFAULTS.order,
    // Heures de consommation (tableau de strings "HH:MM")
    hours: Array.isArray(json.hours) ? json.hours.filter((h): h is string => typeof h === 'string') : DEFAULTS.hours,
    // Icône emoji
    icon: typeof json.icon === 'string' ? json.icon : DEFAULTS.icon,
    // Description courte
    description: typeof json.description === 'string' ? json.description : DEFAULTS.description,
    // SHA Git du fichier .category.json
    sha
  }
}

/**
 * Crée un `CategorySettings` entièrement par défaut pour un dossier donné.
 * Utilisé comme fallback quand aucun `.category.json` n'existe pour cette catégorie.
 *
 * @param folder - Nom du dossier (ex : "desserts")
 */
export function defaultCategorySettings(folder: string): CategorySettings {
  return buildCategorySettings(folder)
}

/**
 * Extrait le nom de catégorie (premier dossier) depuis le chemin d'un fichier recette.
 *
 * @param path - Chemin du fichier dans le repo (ex : "plats/poulet-roti.cook")
 * @returns Le nom du dossier racine (ex : "plats"), ou chaîne vide si le fichier
 *   est à la racine du repo (pas de `/` dans le chemin).
 *
 * @example
 * getCategory('plats/poulet-roti.cook') // → "plats"
 * getCategory('recette.cook')           // → ""
 */
export function getCategory(path: string): string {
  const idx = path.indexOf('/')
  return idx === -1 ? '' : path.substring(0, idx)
}
