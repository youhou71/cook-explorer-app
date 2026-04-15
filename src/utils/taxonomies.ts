/**
 * Taxonomies structurées des recettes : origine géographique et saisons.
 *
 * Ces valeurs sont stockées comme tags préfixés (`origine:italien`, `saison:été`)
 * dans la liste `tags` du frontmatter YAML des fichiers .cook, et parsées à la
 * lecture pour être affichées séparément des tags libres.
 */

export interface OriginCountry {
  value: string
  label: string
  flag: string
}

export interface Season {
  value: string
  label: string
  icon: string
}

export const ORIGIN_PREFIX = 'origine:'
export const SEASON_PREFIX = 'saison:'

/** Liste de pays courants en cuisine — extensible en éditant ce tableau. */
export const ORIGIN_COUNTRIES: readonly OriginCountry[] = [
  { value: 'algérien', label: 'Algérien', flag: '🇩🇿' },
  { value: 'allemand', label: 'Allemand', flag: '🇩🇪' },
  { value: 'américain', label: 'Américain', flag: '🇺🇸' },
  { value: 'anglais', label: 'Anglais', flag: '🇬🇧' },
  { value: 'argentin', label: 'Argentin', flag: '🇦🇷' },
  { value: 'australien', label: 'Australien', flag: '🇦🇺' },
  { value: 'autrichien', label: 'Autrichien', flag: '🇦🇹' },
  { value: 'belge', label: 'Belge', flag: '🇧🇪' },
  { value: 'brésilien', label: 'Brésilien', flag: '🇧🇷' },
  { value: 'canadien', label: 'Canadien', flag: '🇨🇦' },
  { value: 'chinois', label: 'Chinois', flag: '🇨🇳' },
  { value: 'coréen', label: 'Coréen', flag: '🇰🇷' },
  { value: 'cubain', label: 'Cubain', flag: '🇨🇺' },
  { value: 'égyptien', label: 'Égyptien', flag: '🇪🇬' },
  { value: 'espagnol', label: 'Espagnol', flag: '🇪🇸' },
  { value: 'éthiopien', label: 'Éthiopien', flag: '🇪🇹' },
  { value: 'français', label: 'Français', flag: '🇫🇷' },
  { value: 'grec', label: 'Grec', flag: '🇬🇷' },
  { value: 'hongrois', label: 'Hongrois', flag: '🇭🇺' },
  { value: 'indien', label: 'Indien', flag: '🇮🇳' },
  { value: 'indonésien', label: 'Indonésien', flag: '🇮🇩' },
  { value: 'italien', label: 'Italien', flag: '🇮🇹' },
  { value: 'japonais', label: 'Japonais', flag: '🇯🇵' },
  { value: 'libanais', label: 'Libanais', flag: '🇱🇧' },
  { value: 'marocain', label: 'Marocain', flag: '🇲🇦' },
  { value: 'mexicain', label: 'Mexicain', flag: '🇲🇽' },
  { value: 'péruvien', label: 'Péruvien', flag: '🇵🇪' },
  { value: 'philippin', label: 'Philippin', flag: '🇵🇭' },
  { value: 'polonais', label: 'Polonais', flag: '🇵🇱' },
  { value: 'portugais', label: 'Portugais', flag: '🇵🇹' },
  { value: 'russe', label: 'Russe', flag: '🇷🇺' },
  { value: 'sénégalais', label: 'Sénégalais', flag: '🇸🇳' },
  { value: 'sud-africain', label: 'Sud-africain', flag: '🇿🇦' },
  { value: 'suédois', label: 'Suédois', flag: '🇸🇪' },
  { value: 'suisse', label: 'Suisse', flag: '🇨🇭' },
  { value: 'thaïlandais', label: 'Thaïlandais', flag: '🇹🇭' },
  { value: 'tunisien', label: 'Tunisien', flag: '🇹🇳' },
  { value: 'turc', label: 'Turc', flag: '🇹🇷' },
  { value: 'vietnamien', label: 'Vietnamien', flag: '🇻🇳' },
]

export const SEASONS: readonly Season[] = [
  { value: 'printemps', label: 'Printemps', icon: '🌸' },
  { value: 'été', label: 'Été', icon: '☀️' },
  { value: 'automne', label: 'Automne', icon: '🍂' },
  { value: 'hiver', label: 'Hiver', icon: '❄️' },
]

/** Première lettre en majuscule (locale fr), reste inchangé. */
function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1)
}

/**
 * Sépare une liste de tags bruts en leurs trois composantes taxonomiques.
 * - La première valeur `origine:*` rencontrée gagne (valeur unique par recette).
 * - Toutes les valeurs `saison:*` sont collectées.
 * - Le reste va dans `free`.
 */
export function splitTags(rawTags: string[]): {
  origin: string | null
  seasons: string[]
  free: string[]
} {
  let origin: string | null = null
  const seasons: string[] = []
  const free: string[] = []

  for (const raw of rawTags) {
    const tag = raw.trim()
    if (!tag) continue

    if (tag.toLowerCase().startsWith(ORIGIN_PREFIX)) {
      const value = tag.substring(ORIGIN_PREFIX.length).trim()
      if (value && origin === null) origin = value.toLowerCase()
      continue
    }

    if (tag.toLowerCase().startsWith(SEASON_PREFIX)) {
      const value = tag.substring(SEASON_PREFIX.length).trim().toLowerCase()
      if (value && !seasons.includes(value)) seasons.push(value)
      continue
    }

    free.push(tag)
  }

  return { origin, seasons, free }
}

/**
 * Reconstruit une liste de tags à plat à partir des trois composantes.
 * Ordre : tags libres d'abord (préserve l'ordre d'origine), puis origine, puis saisons.
 */
export function buildTags(free: string[], origin: string | null, seasons: string[]): string[] {
  const out: string[] = [...free]
  if (origin) out.push(`${ORIGIN_PREFIX}${origin}`)
  for (const s of seasons) out.push(`${SEASON_PREFIX}${s}`)
  return out
}

/**
 * Métadonnées d'affichage pour une origine (drapeau + libellé).
 * Fallback 🌍 si la valeur n'est pas dans la liste prédéfinie (saisie libre).
 */
export function getOriginMeta(value: string | null | undefined): { label: string; flag: string } {
  if (!value) return { label: '', flag: '' }
  const found = ORIGIN_COUNTRIES.find(c => c.value === value.toLowerCase())
  if (found) return { label: found.label, flag: found.flag }
  return { label: capitalize(value), flag: '🌍' }
}

/**
 * Métadonnées d'affichage pour une saison (icône + libellé).
 * Fallback 🗓 si la valeur n'est pas reconnue.
 */
export function getSeasonMeta(value: string | null | undefined): { label: string; icon: string } {
  if (!value) return { label: '', icon: '' }
  const found = SEASONS.find(s => s.value === value.toLowerCase())
  if (found) return { label: found.label, icon: found.icon }
  return { label: capitalize(value), icon: '🗓' }
}
