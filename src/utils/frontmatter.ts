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
