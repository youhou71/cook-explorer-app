import type { CategorySettings } from '@/types'

const LEGACY_ORDER = ['entree', 'plat', 'dessert', 'snack']

function normalize(cat: string): string {
  return cat
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/s$/, '')
}

export function categoryOrder(cat: string, settingsMap?: Map<string, CategorySettings>): number {
  if (settingsMap?.size) {
    const settings = settingsMap.get(cat)
    if (settings) return settings.order
    for (const [folder, s] of settingsMap) {
      if (normalize(folder) === normalize(cat)) return s.order
    }
    return Infinity
  }
  const idx = LEGACY_ORDER.indexOf(normalize(cat))
  return idx === -1 ? LEGACY_ORDER.length : idx
}

export function compareCategories(a: string, b: string, settingsMap?: Map<string, CategorySettings>): number {
  const orderA = categoryOrder(a, settingsMap)
  const orderB = categoryOrder(b, settingsMap)
  if (orderA !== orderB) return orderA - orderB
  return a.localeCompare(b)
}

const DEFAULTS: Omit<CategorySettings, 'folder'> = {
  name: '',
  color: '#6b8f71',
  colorSecondary: '#eef4ef',
  order: Infinity,
  hours: [],
  icon: '📁',
  description: ''
}

export function buildCategorySettings(folder: string, json: Record<string, unknown> = {}, sha?: string): CategorySettings {
  return {
    folder,
    name: typeof json.name === 'string' && json.name ? json.name : folder,
    color: typeof json.color === 'string' ? json.color : DEFAULTS.color,
    colorSecondary: typeof json.colorSecondary === 'string'
      ? json.colorSecondary
      : typeof json.color_secondary === 'string'
        ? json.color_secondary
        : DEFAULTS.colorSecondary,
    order: typeof json.order === 'number' ? json.order : DEFAULTS.order,
    hours: Array.isArray(json.hours) ? json.hours.filter((h): h is string => typeof h === 'string') : DEFAULTS.hours,
    icon: typeof json.icon === 'string' ? json.icon : DEFAULTS.icon,
    description: typeof json.description === 'string' ? json.description : DEFAULTS.description,
    sha
  }
}

export function defaultCategorySettings(folder: string): CategorySettings {
  return buildCategorySettings(folder)
}

export function getCategory(path: string): string {
  const idx = path.indexOf('/')
  return idx === -1 ? '' : path.substring(0, idx)
}
