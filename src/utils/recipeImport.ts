/**
 * Moteur d'import de recettes depuis une URL.
 *
 * Fonctions pures pour :
 *  - extraire les données structurées schema.org/Recipe (JSON-LD) depuis du HTML
 *  - parser les lignes d'ingrédients françaises en (quantité, unité, nom)
 *  - assembler un fichier .cook complet avec matching niveau 3
 *    (injection des @ingrédients directement dans les étapes)
 */

// ── Types ──────────────────────────────────────────────────────────────────

/** Recette brute extraite du JSON-LD schema.org */
export interface ImportedRecipe {
  name: string
  ingredients: string[]
  steps: string[]
  prepTime?: string
  cookTime?: string
  totalTime?: string
  servings?: string
  image?: string
  sourceUrl: string
  category?: string
}

/** Ingrédient parsé avec champs structurés */
export interface ParsedIngredient {
  raw: string
  quantity: string | null
  unit: string | null
  name: string
  nameNormalized: string
}

// ── Normalisation française ────────────────────────────────────────────────

/** Minuscule + suppression des diacritiques (NFD + strip combining marks). */
export function normalizeFR(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
}

const SINGULAR_EXCEPTIONS: Record<string, string> = {
  oeufs: 'oeuf',
  aulx: 'ail',
  yeux: 'oeil',
}

/** Singularisation basique du français pour le vocabulaire alimentaire. */
export function singularizeFR(word: string): string {
  const lower = word.toLowerCase()
  if (SINGULAR_EXCEPTIONS[lower]) return SINGULAR_EXCEPTIONS[lower]
  if (lower.endsWith('eaux')) return lower.slice(0, -1)
  if (lower.endsWith('s') && !lower.endsWith('is') && !lower.endsWith('us') && !lower.endsWith('as')) {
    return lower.slice(0, -1)
  }
  if (lower.endsWith('x') && lower.length > 2) {
    if (lower.endsWith('oux') || lower.endsWith('aux')) return lower.slice(0, -1)
  }
  return lower
}

// ── Durées ISO 8601 ────────────────────────────────────────────────────────

/** Convertit une durée ISO 8601 (ex: "PT1H30M") en format lisible ("1h30"). */
export function parseIsoDuration(iso: string | undefined | null): string | null {
  if (!iso) return null
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return null
  const hours = m[1] ? parseInt(m[1]) : 0
  const minutes = m[2] ? parseInt(m[2]) : 0
  if (hours === 0 && minutes === 0) return null
  if (hours > 0 && minutes > 0) return `${hours}h${String(minutes).padStart(2, '0')}`
  if (hours > 0) return `${hours}h`
  return `${minutes} min`
}

// ── Extraction JSON-LD ─────────────────────────────────────────────────────

/** Cherche un objet Recipe dans un nœud JSON-LD (direct, array, ou @graph). */
function findRecipeNode(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item)
      if (found) return found
    }
    return null
  }

  const obj = data as Record<string, unknown>

  const type = obj['@type']
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
    return obj
  }

  if (Array.isArray(obj['@graph'])) {
    return findRecipeNode(obj['@graph'])
  }

  return null
}

/** Extrait le texte des instructions (gère string[], HowToStep[], HowToSection[]). */
function extractSteps(instructions: unknown): string[] {
  if (!instructions) return []
  if (typeof instructions === 'string') {
    return instructions
      .split(/\n+/)
      .map(s => stripHtml(s).trim())
      .filter(Boolean)
  }
  if (!Array.isArray(instructions)) return []

  const result: string[] = []
  for (const item of instructions) {
    if (typeof item === 'string') {
      const cleaned = stripHtml(item).trim()
      if (cleaned) result.push(cleaned)
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      if (obj['@type'] === 'HowToSection' && Array.isArray(obj.itemListElement)) {
        result.push(...extractSteps(obj.itemListElement))
      } else if (obj.text && typeof obj.text === 'string') {
        const cleaned = stripHtml(obj.text).trim()
        if (cleaned) result.push(cleaned)
      }
    }
  }
  return result
}

/** Retire les balises HTML d'une chaîne. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Extrait le nombre de portions depuis `recipeYield`. */
function extractServings(yield_: unknown): string | undefined {
  if (!yield_) return undefined
  const str = Array.isArray(yield_) ? String(yield_[0]) : String(yield_)
  const m = str.match(/\d+/)
  return m ? m[0] : str
}

/**
 * Extrait les données schema.org/Recipe depuis une chaîne HTML.
 * Utilise DOMParser (disponible dans le navigateur).
 */
export function extractRecipeJsonLd(html: string, sourceUrl: string): ImportedRecipe | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')

  let recipeNode: Record<string, unknown> | null = null

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent ?? '')
      recipeNode = findRecipeNode(data)
      if (recipeNode) break
    } catch {
      // JSON malformé, on passe au suivant
    }
  }

  if (!recipeNode) return null

  const name = String(recipeNode.name ?? '')
  if (!name) return null

  const ingredients = Array.isArray(recipeNode.recipeIngredient)
    ? (recipeNode.recipeIngredient as string[]).map(s => stripHtml(String(s)).trim()).filter(Boolean)
    : []

  const steps = extractSteps(recipeNode.recipeInstructions)

  const image = Array.isArray(recipeNode.image)
    ? String((recipeNode.image as unknown[])[0] ?? '')
    : typeof recipeNode.image === 'object' && recipeNode.image !== null
      ? String((recipeNode.image as Record<string, unknown>).url ?? '')
      : typeof recipeNode.image === 'string'
        ? recipeNode.image
        : undefined

  return {
    name,
    ingredients,
    steps,
    prepTime: typeof recipeNode.prepTime === 'string' ? recipeNode.prepTime : undefined,
    cookTime: typeof recipeNode.cookTime === 'string' ? recipeNode.cookTime : undefined,
    totalTime: typeof recipeNode.totalTime === 'string' ? recipeNode.totalTime : undefined,
    servings: extractServings(recipeNode.recipeYield),
    image: image || undefined,
    sourceUrl,
    category: typeof recipeNode.recipeCategory === 'string' ? recipeNode.recipeCategory : undefined,
  }
}

// ── Parsing d'ingrédients français ─────────────────────────────────────────

const UNICODE_FRACTIONS: Record<string, string> = {
  '\u00BC': '1/4',
  '\u00BD': '1/2',
  '\u00BE': '3/4',
  '\u2153': '1/3',
  '\u2154': '2/3',
  '\u215B': '1/8',
  '\u215C': '3/8',
  '\u215D': '5/8',
  '\u215E': '7/8',
}

/** Unités françaises, triées par longueur décroissante pour matcher les composées d'abord. */
const UNITS_FR = [
  'cuillères à soupe', 'cuillere a soupe', 'cuillères à café', 'cuillere a cafe',
  'cuillères à dessert', 'cuillere a dessert',
  'cuillère à soupe', 'cuillère à café', 'cuillère à dessert',
  'c. à soupe', 'c. à café', 'c. à dessert',
  'c.à soupe', 'c.à café',
  'c à soupe', 'c à café', 'c à dessert',
  'c à s', 'c à c', 'c. à s.', 'c. à c.',
  'poignées', 'poignée', 'poignees', 'poignee',
  'rondelles', 'rondelle',
  'tranches', 'tranche',
  'branches', 'branche',
  'feuilles', 'feuille',
  'morceaux', 'morceau',
  'gousses', 'gousse',
  'pincées', 'pincée', 'pincees', 'pincee',
  'sachets', 'sachet',
  'boîtes', 'boîte', 'boites', 'boite',
  'litres', 'litre',
  'bottes', 'botte',
  'verres', 'verre',
  'tasses', 'tasse',
  'noisettes', 'noisette',
  'filets', 'filet',
  'traits', 'trait',
  'brins', 'brin',
  'noix',
  'pots', 'pot',
  'cas', 'cac', 'c.s', 'c.c',
  'kg', 'mg',
  'ml', 'cl', 'dl',
  'cs', 'cc',
  'g', 'l',
]

const CONNECTORS_RE = /^(?:de\s+la\s+|de\s+l['']\s*|d['']\s*|du\s+|des\s+|de\s+)/i

const QTY_RE = /^(\d+\s*[.,/]\s*\d+|\d+)(\s+\d+\s*\/\s*\d+)?/

/**
 * Parse une ligne d'ingrédient française en composants structurés.
 *
 * Gère : entiers, décimaux, fractions, fractions Unicode, quantités textuelles,
 * unités composées (cuillère à soupe), connecteurs français (de, d', du, de la).
 */
export function parseIngredientFR(raw: string): ParsedIngredient {
  let text = raw.trim()
  if (!text) return { raw, quantity: null, unit: null, name: raw, nameNormalized: '' }

  // Remplacer les fractions Unicode
  for (const [char, frac] of Object.entries(UNICODE_FRACTIONS)) {
    text = text.replace(char, frac)
  }

  let quantity: string | null = null
  let unit: string | null = null
  let rest = text

  // 1. Extraire la quantité
  const qtyMatch = rest.match(QTY_RE)
  if (qtyMatch) {
    const main = qtyMatch[1].replace(/\s/g, '')
    const frac = qtyMatch[2]?.trim().replace(/\s/g, '') ?? ''
    quantity = frac ? `${main} ${frac}` : main.replace(',', '.')
    rest = rest.slice(qtyMatch[0].length).trim()
  }

  // 2. Extraire l'unité
  const restNorm = normalizeFR(rest)
  for (const u of UNITS_FR) {
    const uNorm = normalizeFR(u)
    if (restNorm.startsWith(uNorm)) {
      const afterUnit = restNorm.slice(uNorm.length)
      if (afterUnit === '' || /^[\s,.]/.test(afterUnit) || CONNECTORS_RE.test(afterUnit.trimStart())) {
        unit = rest.slice(0, uNorm.length)
        rest = rest.slice(uNorm.length).trim()
        break
      }
    }
  }

  // 3. Retirer le connecteur
  rest = rest.replace(CONNECTORS_RE, '').trim()

  // Si pas de quantité et pas d'unité, le tout est le nom
  const name = rest || text
  const nameNormalized = normalizeFR(singularizeFR(name))

  return { raw, quantity, unit, name, nameNormalized }
}

// ── Matching niveau 3 + assemblage .cook ───────────────────────────────────

/** Map des lettres de base → classe regex incluant les variantes accentuées. */
const ACCENT_MAP: Record<string, string> = {
  a: '[aàâä]',
  e: '[eéèêë]',
  i: '[iîï]',
  o: '[oôö]',
  u: '[uùûü]',
  c: '[cç]',
}

/** Construit une regex flexible depuis un nom d'ingrédient : accent-aware, pluriel tolérant. */
function flexiblePattern(name: string): string {
  const normalized = normalizeFR(name)
  const chars = [...normalized]
  let pattern = ''
  let i = 0
  while (i < chars.length) {
    const ch = chars[i]
    // Gérer les ligatures : oe ↔ œ, ae ↔ æ
    if (ch === 'o' && chars[i + 1] === 'e') {
      pattern += `(?:œ|${ACCENT_MAP['o']}${ACCENT_MAP['e']})`
      i += 2
      continue
    }
    if (ch === 'a' && chars[i + 1] === 'e') {
      pattern += `(?:æ|${ACCENT_MAP['a']}${ACCENT_MAP['e']})`
      i += 2
      continue
    }
    if (ACCENT_MAP[ch]) {
      pattern += ACCENT_MAP[ch]
    } else if (/[a-z0-9]/.test(ch)) {
      pattern += ch
    } else if (ch === ' ' || ch === '-') {
      pattern += "[\\s'-]+"
    } else {
      pattern += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    i++
  }
  // Tolérance au pluriel
  if (!normalized.endsWith('s') && !normalized.endsWith('x')) {
    pattern += '[sx]?'
  }
  return pattern
}

const ARTICLE_PREFIX = "(?:le |la |l[''']|les |du |de la |de l[''']|des |un |une |d[''']|au |aux )?"

// ── Détection de durées dans les étapes ────────────────────────────────────

/** Convertit heures + minutes en total minutes. */
function hmsToMinutes(h: number, m: number): number {
  return h * 60 + m
}

/**
 * Détecte les durées dans un texte et les remplace par des timers Cooklang ~{qty%unit}.
 *
 * Les formats composés (1h30) sont convertis en minutes pour compatibilité
 * avec la lib cooklang qui n'accepte que des nombres simples.
 * Les plages (10 à 15 min) deviennent deux timers séparés.
 */
function annotateTimers(text: string): string {
  // Forme composée longue : "1 heure 30", "2 heures 15 minutes"
  text = text.replace(
    /(?<!\{)(\d+)\s*(?:heures?)\s+(\d{1,2})(?:\s*(?:min(?:utes?)?))?\b/gi,
    (_, h, m) => `~{${hmsToMinutes(+h, +m)}%min}`,
  )

  // Forme courte : "1h30" (collé ou espacé)
  text = text.replace(
    /(?<!\{)(\d+)\s*h\s*(\d{1,2})(?!\s*[°])(?![^{]*})/gi,
    (_, h, m) => `~{${hmsToMinutes(+h, +m)}%min}`,
  )

  // Plage : "10 à 15 minutes" → deux timers
  text = text.replace(
    /(?<!\{)(\d+)\s*(à|a|-)\s*(\d+)\s*(minutes?|min|heures?|h|secondes?|sec|s)\b/gi,
    (_, lo, sep, hi, u) => {
      const unit = normalizeTimeUnit(u)
      return `~{${lo}%${unit}} ${sep === '-' ? 'à' : sep} ~{${hi}%${unit}}`
    },
  )

  // Forme simple : "30 minutes", "2 heures", "1 heure", "10 min", "45 secondes"
  text = text.replace(
    /(?<!\{)(\d+)\s*(minutes?|min|heures?|h(?![a-z])|secondes?|sec)\b/gi,
    (_, qty, u) => `~{${qty}%${normalizeTimeUnit(u)}}`,
  )

  // Workaround : la lib cooklang déduplique les timers identiques dans une même étape.
  // On rend chaque timer unique en ajoutant un suffixe invisible au nom si doublon.
  const seen = new Map<string, number>()
  text = text.replace(/~(\w*)\{([^}]+)\}/g, (full, name, body) => {
    const key = `${name}{${body}}`
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    if (count > 1) return `~timer ${count}{${body}}`
    return full
  })

  return text
}

/** Normalise les unités de temps pour le format Cooklang. */
function normalizeTimeUnit(u: string): string {
  const lower = u.toLowerCase()
  if (lower.startsWith('min')) return 'min'
  if (lower.startsWith('heure') || lower === 'h') return 'h'
  if (lower.startsWith('sec')) return 's'
  return lower
}

/** Formate un ingrédient en syntaxe Cooklang `@nom{qty%unit}`. */
function formatCooklang(ing: ParsedIngredient): string {
  const name = ing.name
  if (!ing.quantity && !ing.unit) return `@${name}{}`
  if (ing.quantity && !ing.unit) return `@${name}{${ing.quantity}}`
  if (ing.quantity && ing.unit) return `@${name}{${ing.quantity}%${ing.unit}}`
  return `@${name}{%${ing.unit}}`
}

/**
 * Assemble le contenu .cook complet depuis une recette importée.
 *
 * Niveau 3 : les ingrédients sont injectés dans les étapes via matching fuzzy.
 * Les ingrédients non trouvés apparaissent dans une ligne dédiée en haut du body.
 */
export function buildCooklangContent(
  imported: ImportedRecipe,
  parsedIngredients: ParsedIngredient[],
): string {
  // ── Frontmatter YAML ──
  const fmLines: string[] = ['---']
  fmLines.push(`title: ${imported.name}`)
  if (imported.servings) fmLines.push(`servings: ${imported.servings}`)
  const prepTime = parseIsoDuration(imported.prepTime)
  if (prepTime) fmLines.push(`prep_time: ${prepTime}`)
  const cookTime = parseIsoDuration(imported.cookTime)
  if (cookTime) fmLines.push(`cook_time: ${cookTime}`)
  const totalTime = parseIsoDuration(imported.totalTime)
  if (totalTime) fmLines.push(`total_time: ${totalTime}`)
  if (imported.sourceUrl) fmLines.push(`source: ${imported.sourceUrl}`)
  fmLines.push('---')

  // ── Matching niveau 3 ──
  // Trier par longueur de nom décroissante pour éviter les matchs partiels
  const sortedIndices = parsedIngredients
    .map((_, i) => i)
    .sort((a, b) => parsedIngredients[b].name.length - parsedIngredients[a].name.length)

  const annotated = new Set<number>()
  const annotatedSteps: string[] = []

  for (const step of imported.steps) {
    let workingText = step

    for (const idx of sortedIndices) {
      if (annotated.has(idx)) continue
      const ing = parsedIngredients[idx]
      if (!ing.nameNormalized) continue

      // Candidats de matching : nom complet, forme singulière, puis premier mot
      const candidates: string[] = [ing.name]
      const singular = singularizeFR(ing.name)
      if (singular !== ing.name.toLowerCase()) candidates.push(singular)
      const words = ing.name.split(/\s+/)
      if (words.length > 1 && words[0].length >= 3) {
        candidates.push(words[0])
      }

      let matched = false
      for (const candidate of candidates) {
        // (?![\wà-ÿ]) : le match ne doit pas être suivi d'une lettre (évite "beurre" dans "beurrer")
        const pattern = ARTICLE_PREFIX + flexiblePattern(candidate) + '(?![\\wà-ÿ])'
        const regex = new RegExp(pattern, 'i')
        const match = workingText.match(regex)

        if (match && match.index !== undefined) {
          const replacement = formatCooklang(ing)
          workingText =
            workingText.slice(0, match.index) +
            replacement +
            workingText.slice(match.index + match[0].length)
          annotated.add(idx)
          matched = true
          break
        }
      }
    }

    // Détecter et annoter les durées
    workingText = annotateTimers(workingText)

    annotatedSteps.push(workingText)
  }

  // ── Fallback : ingrédients non matchés ──
  const unmatched = parsedIngredients.filter((_, i) => !annotated.has(i))

  // ── Assemblage final ──
  const parts: string[] = [fmLines.join('\n'), '']

  if (unmatched.length > 0) {
    const list = unmatched.map(ing => formatCooklang(ing)).join(', ')
    parts.push(`Aussi nécessaire : ${list}.`)
    parts.push('')
  }

  for (const step of annotatedSteps) {
    parts.push(step)
    parts.push('')
  }

  return parts.join('\n').trimEnd() + '\n'
}
