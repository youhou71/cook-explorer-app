/**
 * Utilitaires de manipulation du frontmatter YAML d'un fichier .cook
 *
 * Les fichiers .cook de cette app utilisent un bloc YAML délimité par "---"
 * en tête du fichier pour stocker les métadonnées (title, servings, tags, etc.).
 * Ce module fournit les fonctions nécessaires pour lire et injecter les dates
 * created_at / updated_at sans casser le reste du frontmatter.
 */

/** Clé de date de création */
const CREATED_AT_KEY = 'created_at'
/** Clé de date de dernière modification */
const UPDATED_AT_KEY = 'updated_at'
/** Clé de la liste de tags */
const TAGS_KEY = 'tags'
/** Clé du titre affichable */
const TITLE_KEY = 'title'

/**
 * Sépare un fichier .cook en (frontmatter | body).
 * - Si aucun frontmatter n'est présent, frontmatter = null et body = raw entier.
 * - Le frontmatter est retourné SANS les délimiteurs "---".
 */
function splitFrontmatter(raw: string): { frontmatter: string | null; body: string } {
  const trimmedStart = raw.trimStart()
  if (!trimmedStart.startsWith('---')) {
    return { frontmatter: null, body: raw }
  }

  // Le délimiteur de fin doit être sur sa propre ligne
  const afterOpening = trimmedStart.substring(3)
  const endMatch = afterOpening.match(/\r?\n---\s*(\r?\n|$)/)
  if (!endMatch || endMatch.index === undefined) {
    // Frontmatter mal formé → on traite comme absent
    return { frontmatter: null, body: raw }
  }

  const frontmatter = afterOpening.substring(0, endMatch.index).replace(/^\r?\n/, '')
  const body = afterOpening.substring(endMatch.index + endMatch[0].length)
  return { frontmatter, body }
}

/**
 * Parse une ligne "key: value" du frontmatter et retourne la clé si présente.
 * Ignore les items de liste YAML ("- foo") et les lignes vides.
 */
function getLineKey(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('- ') || trimmed.startsWith('#')) return null
  const colonIdx = trimmed.indexOf(':')
  if (colonIdx <= 0) return null
  return trimmed.substring(0, colonIdx).trim()
}

/**
 * Lit la valeur d'une clé simple (inline) du frontmatter.
 * Retourne undefined si la clé est absente ou si c'est une liste YAML.
 */
function readScalarKey(frontmatter: string, key: string): string | undefined {
  for (const rawLine of frontmatter.split('\n')) {
    const line = rawLine.trim()
    const colonIdx = line.indexOf(':')
    if (colonIdx <= 0) continue
    const currentKey = line.substring(0, colonIdx).trim()
    if (currentKey !== key) continue
    const value = line.substring(colonIdx + 1).trim()
    // Retirer d'éventuels guillemets
    return value.replace(/^["']|["']$/g, '')
  }
  return undefined
}

/**
 * Retourne les dates created_at / updated_at d'une recette (ou undefined si absentes).
 */
export function readRecipeDates(raw: string): { createdAt?: string; updatedAt?: string } {
  const { frontmatter } = splitFrontmatter(raw)
  if (!frontmatter) return {}
  return {
    createdAt: readScalarKey(frontmatter, CREATED_AT_KEY),
    updatedAt: readScalarKey(frontmatter, UPDATED_AT_KEY)
  }
}

/**
 * Injecte ou met à jour created_at et updated_at dans le frontmatter d'une recette.
 *
 * - Si isNew est vrai : created_at = now (écrase s'il existe, ce qui n'arrive en pratique pas)
 * - Sinon             : created_at est conservé si présent, ajouté avec now sinon
 * - updated_at est toujours mis à now
 *
 * Si aucun frontmatter n'existe, un bloc minimal est créé.
 */
export function upsertRecipeDates(raw: string, options: { isNew: boolean; now?: Date } = { isNew: false }): string {
  const now = (options.now ?? new Date()).toISOString()
  const { frontmatter, body } = splitFrontmatter(raw)

  // Cas 1 : pas de frontmatter existant → en créer un
  if (frontmatter === null) {
    const newFrontmatter = `---\n${CREATED_AT_KEY}: ${now}\n${UPDATED_AT_KEY}: ${now}\n---\n`
    // On conserve un éventuel séparateur si body commence déjà par du contenu
    return newFrontmatter + (body.startsWith('\n') ? body : (body ? '\n' + body : ''))
  }

  // Cas 2 : frontmatter existant → reconstruire ligne par ligne
  const lines = frontmatter.split('\n')
  const outLines: string[] = []
  let existingCreatedAt: string | undefined

  for (const line of lines) {
    const key = getLineKey(line)
    if (key === CREATED_AT_KEY) {
      // On capture la valeur existante mais on omet la ligne : elle sera ré-émise à la fin
      const colonIdx = line.indexOf(':')
      existingCreatedAt = line.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
      continue
    }
    if (key === UPDATED_AT_KEY) {
      continue // sera ré-émise à la fin
    }
    outLines.push(line)
  }

  // Nettoyer les lignes vides en queue
  while (outLines.length && outLines[outLines.length - 1].trim() === '') {
    outLines.pop()
  }

  const createdAt = options.isNew
    ? now
    : (existingCreatedAt && existingCreatedAt.length > 0 ? existingCreatedAt : now)

  outLines.push(`${CREATED_AT_KEY}: ${createdAt}`)
  outLines.push(`${UPDATED_AT_KEY}: ${now}`)

  const newFrontmatter = outLines.join('\n')
  return `---\n${newFrontmatter}\n---\n${body.startsWith('\n') ? body.substring(1) : body}`
}

/**
 * Formate une liste de tags en bloc YAML :
 *   tags:
 *     - tag1
 *     - tag2
 */
function formatTagsBlock(tags: string[]): string {
  return `${TAGS_KEY}:\n${tags.map(t => `  - ${t}`).join('\n')}`
}

/**
 * Injecte ou remplace la clé `tags` du frontmatter avec la liste fournie,
 * au format bloc YAML (une entrée par ligne).
 *
 * - Si `tags` est vide, la clé est retirée du frontmatter.
 * - Les doublons et chaînes vides sont nettoyés (ordre d'apparition préservé).
 * - Si aucun frontmatter n'existe et qu'il y a au moins un tag, un bloc minimal est créé.
 * - Gère les deux formats YAML existants : valeur inline (`tags: foo, bar`)
 *   ou liste bloc (`tags:\n  - foo\n  - bar`).
 */
export function upsertTags(raw: string, tags: string[]): string {
  // Normalisation : trim + dédoublonnage en préservant l'ordre d'apparition
  const cleanTags: string[] = []
  const seen = new Set<string>()
  for (const t of tags) {
    const tr = t.trim()
    if (!tr || seen.has(tr)) continue
    seen.add(tr)
    cleanTags.push(tr)
  }

  const { frontmatter, body } = splitFrontmatter(raw)

  // Cas 1 : aucun frontmatter existant
  if (frontmatter === null) {
    if (cleanTags.length === 0) return raw
    const block = formatTagsBlock(cleanTags)
    const newFrontmatter = `---\n${block}\n---\n`
    return newFrontmatter + (body.startsWith('\n') ? body : (body ? '\n' + body : ''))
  }

  // Cas 2 : reconstruire en supprimant l'ancienne clé `tags` et ses items de liste
  const lines = frontmatter.split('\n')
  const outLines: string[] = []
  let inTagsList = false

  for (const line of lines) {
    const trimmed = line.trim()

    // En mode « drop » sous une ligne `tags:` bloc, on saute les items (- ...) et les lignes vides
    if (inTagsList) {
      if (trimmed === '' || trimmed.startsWith('- ') || trimmed === '-') continue
      // Nouvelle clé rencontrée : on sort du mode drop et on retraite cette ligne normalement
      inTagsList = false
    }

    const key = getLineKey(line)
    if (key === TAGS_KEY) {
      inTagsList = true
      continue
    }
    outLines.push(line)
  }

  // Nettoyer les lignes vides en queue pour une sortie propre
  while (outLines.length && outLines[outLines.length - 1].trim() === '') {
    outLines.pop()
  }

  if (cleanTags.length > 0) {
    outLines.push(formatTagsBlock(cleanTags))
  }

  const newFrontmatter = outLines.join('\n')
  // Si le frontmatter devient vide après retrait des tags, on supprime le bloc complet
  if (!newFrontmatter.trim()) {
    return body.startsWith('\n') ? body.substring(1) : body
  }

  return `---\n${newFrontmatter}\n---\n${body.startsWith('\n') ? body.substring(1) : body}`
}

/**
 * Formate une valeur scalaire YAML : ajoute des guillemets si elle contient
 * des caractères qui pourraient être mal interprétés par un parser YAML
 * (séparateur `:`, caractères de contrôle en début, mots-clés booléens…).
 */
function formatScalarValue(value: string): string {
  const needsQuotes =
    /[:#]/.test(value) ||
    /^[-?!&*@|>%]/.test(value) ||
    /^(true|false|null|yes|no)$/i.test(value) ||
    value.startsWith(' ') || value.endsWith(' ')
  if (!needsQuotes) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Injecte / remplace / supprime une clé scalaire dans le frontmatter YAML.
 *
 * - Si `value` est vide → la clé est retirée
 * - Si la clé existait → la nouvelle ligne est insérée à la position de l'ancienne
 * - Sinon → la nouvelle ligne est ajoutée en tête du frontmatter
 * - Si aucun frontmatter n'existe et qu'il y a une valeur, un bloc minimal est créé
 */
function upsertScalarKey(raw: string, key: string, value: string): string {
  const trimmed = value.trim()
  const { frontmatter, body } = splitFrontmatter(raw)

  // Cas 1 : pas de frontmatter existant
  if (frontmatter === null) {
    if (!trimmed) return raw
    const formatted = formatScalarValue(trimmed)
    const newFrontmatter = `---\n${key}: ${formatted}\n---\n`
    return newFrontmatter + (body.startsWith('\n') ? body : (body ? '\n' + body : ''))
  }

  // Cas 2 : reconstruire en retirant l'ancienne ligne (on mémorise sa position)
  const lines = frontmatter.split('\n')
  const outLines: string[] = []
  let previousIdx = -1

  for (const line of lines) {
    const k = getLineKey(line)
    if (k === key) {
      if (previousIdx === -1) previousIdx = outLines.length
      continue
    }
    outLines.push(line)
  }

  // Cas 2a : valeur vide → suppression pure
  if (!trimmed) {
    while (outLines.length && outLines[outLines.length - 1].trim() === '') {
      outLines.pop()
    }
    const newFrontmatter = outLines.join('\n')
    if (!newFrontmatter.trim()) {
      return body.startsWith('\n') ? body.substring(1) : body
    }
    return `---\n${newFrontmatter}\n---\n${body.startsWith('\n') ? body.substring(1) : body}`
  }

  // Cas 2b : insertion à la position d'origine (ou en tête)
  const newLine = `${key}: ${formatScalarValue(trimmed)}`
  if (previousIdx === -1) outLines.unshift(newLine)
  else outLines.splice(previousIdx, 0, newLine)

  while (outLines.length && outLines[outLines.length - 1].trim() === '') {
    outLines.pop()
  }

  const newFrontmatter = outLines.join('\n')
  return `---\n${newFrontmatter}\n---\n${body.startsWith('\n') ? body.substring(1) : body}`
}

/** Lit la valeur de la clé `title` depuis le frontmatter (undefined si absente). */
export function readTitle(raw: string): string | undefined {
  const { frontmatter } = splitFrontmatter(raw)
  if (!frontmatter) return undefined
  return readScalarKey(frontmatter, TITLE_KEY)
}

/**
 * Injecte / remplace / supprime la clé `title` dans le frontmatter.
 * Une chaîne vide retire la clé.
 */
export function upsertTitle(raw: string, title: string): string {
  return upsertScalarKey(raw, TITLE_KEY, title)
}

/**
 * Lit la liste de tags actuelle depuis le frontmatter (inline ou bloc).
 * Retourne [] si absente.
 */
export function readTags(raw: string): string[] {
  const { frontmatter } = splitFrontmatter(raw)
  if (!frontmatter) return []

  const lines = frontmatter.split('\n')
  const result: string[] = []
  let inTagsList = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (inTagsList) {
      if (trimmed === '') continue
      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim().replace(/^["']|["']$/g, '')
        if (value) result.push(value)
        continue
      }
      // Nouvelle clé : fin de la liste
      inTagsList = false
    }

    const key = getLineKey(line)
    if (key === TAGS_KEY) {
      const colonIdx = line.indexOf(':')
      const inlineValue = line.substring(colonIdx + 1).trim()
      if (inlineValue) {
        // Format "tags: foo, bar, baz"
        for (const raw of inlineValue.split(',')) {
          const v = raw.trim().replace(/^["']|["']$/g, '')
          if (v) result.push(v)
        }
      } else {
        // Début d'un bloc YAML : on lit les items suivants
        inTagsList = true
      }
    }
  }

  return result
}
