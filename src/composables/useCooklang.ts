/**
 * Composable de parsing et de rendu des fichiers Cooklang (.cook).
 *
 * Ce module est le cœur du traitement des recettes. Il convertit un fichier
 * `.cook` brut (texte avec frontmatter YAML + syntaxe Cooklang) en un objet
 * structuré `CooklangRecipe` exploitable par les vues.
 *
 * Pipeline de parsing :
 *  1. **convertFrontmatter** : traduit le bloc YAML (--- ... ---) en métadonnées
 *     `>> key: value` compréhensibles par la lib `cooklang`.
 *  2. **Nettoyage** : suppression des commentaires Cooklang (-- et [- ... -]),
 *     extraction des notes (> ...) et des sections (= ...).
 *  3. **Parsing** : la lib `cooklang` transforme le texte nettoyé en steps,
 *     ingrédients, ustensiles et timers.
 *  4. **Structuration** : regroupement des steps par section, déduplication
 *     des ingrédients par section et au global, extraction des métadonnées.
 *
 * Fonctions de rendu :
 *  - `renderStep` : génère le HTML d'une étape (highlight ingrédients, timers, ustensiles)
 *  - `formatIngredient` : formate un ingrédient avec quantité mise à l'échelle
 *  - `formatQty` : arrondi élégant des quantités numériques
 *
 * Fonctions d'extraction :
 *  - `getTitle` / `getSummary` / `getBaseServings` : extraient les métadonnées
 *    utiles depuis le `CooklangRecipe` parsé.
 */

import { Recipe, Ingredient, Cookware, Timer } from 'cooklang'
import type { CooklangRecipe, CooklangSection, CooklangStep, CooklangIngredient, CooklangTimer, CooklangCookware, CooklangSummary } from '@/types'
import { splitTags } from '@/utils/taxonomies'

/** Regex des commentaires Cooklang : ligne (--) et bloc ([- ... -]). Retirés avant le parsing. */
const COMMENT_REGEX = /(--.*)|(\[-(.|\n)+?-\])/g

/** Échappe les caractères HTML dangereux pour prévenir l'injection XSS via v-html. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function useCooklang() {
  /**
   * Convertit le frontmatter YAML (--- ... ---) en métadonnées >> key: value
   * pour que la lib cooklang puisse les parser.
   */
  function convertFrontmatter(raw: string): string {
    const trimmed = raw.trimStart()
    if (!trimmed.startsWith('---')) return raw

    const endIndex = trimmed.indexOf('---', 3)
    if (endIndex === -1) return raw

    const frontmatter = trimmed.substring(3, endIndex)
    const rest = trimmed.substring(endIndex + 3)

    const results: string[] = []
    let currentKey = ''
    let listItems: string[] = []

    const flushList = () => {
      if (currentKey && listItems.length) {
        results.push(`>> ${currentKey}: ${listItems.join(', ')}`)
      }
      currentKey = ''
      listItems = []
    }

    for (const rawLine of frontmatter.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue

      // Item de liste YAML (  - valeur)
      if (line.startsWith('- ') && currentKey) {
        listItems.push(line.substring(2).trim())
        continue
      }

      // Nouvelle clé — flush la liste en cours
      flushList()

      if (!line.includes(':')) continue
      const colonIndex = line.indexOf(':')
      const key = line.substring(0, colonIndex).trim()
      const value = line.substring(colonIndex + 1).trim()

      if (value) {
        // Valeur inline : key: value
        results.push(`>> ${key}: ${value}`)
      } else {
        // Valeur vide → attend des items de liste
        currentKey = key
      }
    }
    flushList()

    return results.join('\n') + '\n' + rest
  }

  /**
   * Parse un fichier .cook brut en objet structuré
   */
  function parseRecipe(raw: string): CooklangRecipe {
    const converted = convertFrontmatter(raw)

    // Retirer les commentaires en amont pour que le comptage de steps soit fiable
    // (la lib cooklang les retirerait de toutes façons ; opération idempotente)
    const decommented = converted.replace(COMMENT_REGEX, '')

    // Extraire les notes (lignes > ...) et les sections (lignes = ... / == ...)
    // en comptant au passage les steps qui précèdent chaque section.
    const notes: string[] = []
    const rawSections: { title: string | null; startStepIndex: number }[] = []
    let stepCount = 0

    const cleanedLines = decommented.split('\n').filter(line => {
      const trimmed = line.trim()

      // Lignes vides : conservées pour la lisibilité, ne comptent pas
      if (!trimmed) return true

      // Notes : "> ..." (mais pas ">>" qui est une metadata)
      if (trimmed.startsWith('>') && !trimmed.startsWith('>>')) {
        notes.push(trimmed.replace(/^>\s*/, '').trim())
        return false
      }

      // Sections : "= Titre" ou "== Titre ==" (les = en fin sont optionnels)
      if (trimmed.startsWith('=')) {
        const title = trimmed.replace(/^=+\s*/, '').replace(/\s*=+$/, '').trim()
        rawSections.push({ title: title || null, startStepIndex: stepCount })
        return false
      }

      // Metadata ">> key: value" : garde la ligne mais ne compte pas comme step
      if (trimmed.startsWith('>>')) return true

      // Toute autre ligne non-vide = 1 step (la lib cooklang traite ligne par ligne)
      stepCount++
      return true
    })

    // Backslash en fin de ligne = retour à la ligne visuel dans la même étape (spec cooklang)
    const cleanedText = cleanedLines.join('\n').replace(/\\\n/g, '<<BR>>')
    const recipe = new Recipe(cleanedText)

    // Convertir metadata[] en Record<string, string>
    const metadata: Record<string, string> = {}
    for (const m of recipe.metadata ?? []) {
      if (m.key) metadata[m.key] = m.value ?? ''
    }

    // Convertir les steps : extraire .line et tagger chaque élément
    const steps: CooklangStep[] = (recipe.steps ?? []).map(step => {
      return (step.line ?? []).map(item => {
        if (typeof item === 'string') return item
        if (item instanceof Ingredient) return { type: 'ingredient' as const, name: item.name ?? '', quantity: item.quantity ?? item.amount ?? '', units: item.units ?? '' }
        if (item instanceof Cookware) return { type: 'cookware' as const, name: item.name ?? '', quantity: 1 }
        if (item instanceof Timer) return { type: 'timer' as const, name: item.name ?? '', quantity: item.quantity ?? 0, units: item.units ?? '' }
        return String(item)
      })
    })

    // Grouper les steps par section selon les positions détectées en amont.
    // Les startStepIndex sont clampés à steps.length pour éviter tout dépassement
    // si notre compteur pré-parse ne coïncide pas exactement avec la lib.
    const sections = groupStepsBySections(steps, rawSections)

    // Tagger les ingrédients
    const ingredients = (recipe.ingredients ?? []).map(ing => ({
      type: 'ingredient' as const,
      name: ing.name ?? '',
      quantity: ing.quantity ?? ing.amount ?? '',
      units: ing.units ?? ''
    }))

    // Tagger le matériel + dédupliquer par nom (insensible à la casse),
    // en conservant l'ordre d'apparition dans la recette.
    const cookwareSeen = new Set<string>()
    const cookware = (recipe.cookware ?? []).reduce<{ type: 'cookware'; name: string; quantity: number }[]>((acc, cw) => {
      const name = cw.name ?? ''
      const key = name.toLowerCase().trim()
      if (!key || cookwareSeen.has(key)) return acc
      cookwareSeen.add(key)
      acc.push({ type: 'cookware' as const, name, quantity: 1 })
      return acc
    }, [])

    // Tagger les timers
    const timers = (recipe.timers ?? []).map(t => ({
      type: 'timer' as const,
      name: t.name ?? '',
      quantity: t.quantity ?? 0,
      units: t.units ?? ''
    }))

    return { steps, sections, metadata, ingredients, cookware, timers, notes }
  }

  /**
   * Construit la liste des sections à partir des steps plats + positions extraites.
   * - Si aucune section détectée → une unique section sans titre.
   * - Si des steps précèdent la 1re section, on crée une section implicite (title=null).
   * - Les sections vides avec titre sont conservées (repère visuel).
   * - Les sections vides sans titre sont filtrées.
   */
  function groupStepsBySections(
    allSteps: CooklangStep[],
    rawSections: { title: string | null; startStepIndex: number }[]
  ): CooklangSection[] {
    if (rawSections.length === 0) {
      return allSteps.length ? [{ title: null, steps: allSteps, ingredients: collectIngredients(allSteps) }] : []
    }

    // Tri stable par index + clamp contre le nombre réel de steps
    const sorted = [...rawSections]
      .map(s => ({ ...s, startStepIndex: Math.min(Math.max(s.startStepIndex, 0), allSteps.length) }))
      .sort((a, b) => a.startStepIndex - b.startStepIndex)

    // Section implicite pour les steps orphelins en tête
    if (sorted[0].startStepIndex > 0) {
      sorted.unshift({ title: null, startStepIndex: 0 })
    }

    const result: CooklangSection[] = []
    for (let i = 0; i < sorted.length; i++) {
      const sec = sorted[i]
      const next = sorted[i + 1]
      const end = next ? next.startStepIndex : allSteps.length
      const steps = allSteps.slice(sec.startStepIndex, end)
      // On drop uniquement les sections implicites vides ; on garde les sections avec titre vides
      if (steps.length === 0 && !sec.title) continue
      result.push({ title: sec.title, steps, ingredients: collectIngredients(steps) })
    }
    return result
  }

  /**
   * Parcourt les steps d'une section et en extrait les ingrédients, dédupliqués
   * par (nom, unité). Les quantités numériques sont sommées, sinon concaténées.
   */
  function collectIngredients(steps: CooklangStep[]): CooklangIngredient[] {
    const map = new Map<string, CooklangIngredient>()
    const order: string[] = []
    for (const step of steps) {
      for (const item of step) {
        if (typeof item === 'string' || item.type !== 'ingredient') continue
        const ing = item as CooklangIngredient
        const key = `${(ing.name ?? '').toLowerCase().trim()}|${(ing.units ?? '').toLowerCase().trim()}`
        const existing = map.get(key)
        if (!existing) {
          map.set(key, { type: 'ingredient', name: ing.name ?? '', quantity: ing.quantity ?? '', units: ing.units ?? '' })
          order.push(key)
          continue
        }
        existing.quantity = mergeQuantities(existing.quantity, ing.quantity)
      }
    }
    return order.map(k => map.get(k)!).filter(Boolean)
  }

  /**
   * Fusionne deux quantités d'un même ingrédient.
   * - Deux valeurs purement numériques → somme
   * - Une vide + une non-vide → on garde la non-vide
   * - Sinon → concaténation lisible "a + b"
   */
  function mergeQuantities(a: string | number, b: string | number): string | number {
    const isEmpty = (v: string | number) => v === '' || v === undefined || v === null
    if (isEmpty(a)) return b
    if (isEmpty(b)) return a

    const toNum = (v: string | number): number | null => {
      if (typeof v === 'number') return Number.isNaN(v) ? null : v
      const s = String(v).trim()
      if (!/^-?\d+(\.\d+)?$/.test(s)) return null
      const n = parseFloat(s)
      return Number.isNaN(n) ? null : n
    }

    const numA = toNum(a)
    const numB = toNum(b)
    if (numA !== null && numB !== null) return numA + numB
    return `${a} + ${b}`
  }

  /**
   * Extrait le titre depuis les métadonnées ou le nom de fichier
   */
  function getTitle(parsed: CooklangRecipe, fallback = 'Recette'): string {
    return parsed.metadata?.title ?? parsed.metadata?.name ?? fallback
  }

  /**
   * Extrait les métadonnées utiles pour l'affichage en liste.
   * Les tags préfixés (`origine:*`, `saison:*`) sont séparés dans `origin` / `seasons` ;
   * le champ `tags` ne contient plus que les tags libres.
   */
  function getSummary(parsed: CooklangRecipe): CooklangSummary {
    const rawTags = parsed.metadata?.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) ?? []
    const { origin, seasons, free } = splitTags(rawTags)
    return {
      title: getTitle(parsed),
      servings: parsed.metadata?.servings,
      prepTime: parsed.metadata?.prep_time ?? parsed.metadata?.['prep time'] ?? parsed.metadata?.['prep_time'],
      cookTime: parsed.metadata?.cook_time ?? parsed.metadata?.['cook time'] ?? parsed.metadata?.['cook_time'],
      totalTime: parsed.metadata?.total_time ?? parsed.metadata?.['total time'] ?? parsed.metadata?.['total_time'] ?? parsed.metadata?.time,
      tags: free,
      origin,
      seasons,
      ingredientCount: parsed.ingredients.length,
      createdAt: parsed.metadata?.created_at ?? parsed.metadata?.['created at'],
      updatedAt: parsed.metadata?.updated_at ?? parsed.metadata?.['updated at']
    }
  }

  /**
   * Formate une quantité pour l'affichage (évite les décimales inutiles)
   */
  function formatQty(n: number): string {
    if (Number.isNaN(n)) return ''
    if (Number.isInteger(n)) return n.toString()
    // Afficher au plus 2 décimales, sans trailing zeros
    return parseFloat(n.toFixed(2)).toString()
  }

  /**
   * Extrait le nombre de portions depuis les métadonnées
   */
  function getBaseServings(parsed: CooklangRecipe): number | null {
    const raw = parsed.metadata?.servings
    if (!raw) return null
    const n = parseFloat(raw)
    return Number.isNaN(n) ? null : n
  }

  /**
   * Formate les ingrédients pour l'affichage, avec ratio de mise à l'échelle
   */
  function formatIngredient(ing: CooklangIngredient, ratio = 1): string {
    if (!ing.quantity && ing.quantity !== 0) return ing.name
    let qty: string
    if (typeof ing.quantity === 'number' && !Number.isNaN(ing.quantity)) {
      qty = formatQty(ing.quantity * ratio)
    } else {
      // Quantité non numérique (ex: "½"), on essaie de parser
      const parsed = parseFloat(String(ing.quantity))
      if (!Number.isNaN(parsed)) {
        qty = formatQty(parsed * ratio)
      } else {
        qty = String(ing.quantity)
      }
    }
    if (!qty) return ing.name
    return ing.units
      ? `${qty} ${ing.units} ${ing.name}`
      : `${qty} ${ing.name}`
  }

  /**
   * Formate les étapes en HTML simple (highlight ingrédients/timers).
   * Toutes les valeurs utilisateur sont échappées via escapeHtml() pour
   * prévenir l'injection XSS (le résultat est injecté via v-html).
   */
  /** Élément individuel d'une étape : texte brut ou composant sémantique. */
  type StepItem = string | CooklangIngredient | CooklangTimer | CooklangCookware

  function renderStep(step: CooklangStep | { line: StepItem[] }): string {
    const items: StepItem[] = Array.isArray(step) ? step : step.line ?? []
    return items.map((item: StepItem) => {
      if (typeof item === 'string') return escapeHtml(item).replace(/&lt;&lt;BR&gt;&gt;/g, '<br>')
      if (item.type === 'ingredient') {
        return `<mark class="ingredient">${escapeHtml(item.name)}</mark>`
      }
      if (item.type === 'timer') {
        const displayName = item.name && !item.name.startsWith('timer ') ? item.name : ''
        const label = displayName
          ? `${escapeHtml(displayName)} (${escapeHtml(String(item.quantity))} ${escapeHtml(item.units)})`
          : `${escapeHtml(String(item.quantity))} ${escapeHtml(item.units)}`
        return `<span class="timer">⏱ ${label}</span>`
      }
      if (item.type === 'cookware') {
        return `<span class="cookware">${escapeHtml(item.name)}</span>`
      }
      return ''
    }).join('')
  }

  /**
   * Met une majuscule à la première lettre (le reste est inchangé).
   * Idempotent : si la chaîne commence déjà par une majuscule, rien ne change.
   */
  function capitalize(s: string): string {
    if (!s) return s
    return s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1)
  }

  return { parseRecipe, getTitle, getSummary, getBaseServings, formatIngredient, renderStep, capitalize }
}
