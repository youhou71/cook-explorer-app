/**
 * Normalisation d'un nom de recette en slug de fichier sans accents ni espaces.
 *
 * - Supprime les diacritiques via NFD (`é` → `e`, `ç` → `c`…)
 * - Force en minuscules
 * - Remplace toute séquence non-alphanumérique par un tiret
 * - Retire les tirets en tête et en queue
 *
 * Exemples :
 *   "Tarte au citron meringuée" → "tarte-au-citron-meringuee"
 *   "   Œufs à la   coque !!! " → "-ufs-a-la-coque"  → "ufs-a-la-coque"
 *     (note : `œ` n'est pas décomposable en NFD, il est considéré comme séparateur)
 */
export function slugify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
