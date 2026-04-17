/**
 * Couche de cache persistante basée sur IndexedDB.
 *
 * Ce composable gère le stockage local de toutes les données récupérées depuis
 * GitHub, permettant un affichage instantané au démarrage et un fonctionnement
 * offline (PWA). La base IndexedDB `cookexplorer-cache` contient trois stores :
 *
 *  - **recipes** : contenu des fichiers .cook (brut + parsé), images en data URI,
 *    titres. Clé primaire : `path` (chemin dans le repo).
 *
 *  - **tags** : association tag → couleur pour l'affichage des badges colorés.
 *    Clé primaire : `name` (nom du tag).
 *
 *  - **categories** : paramètres de personnalisation par type de plat, lus depuis
 *    les fichiers `.category.json`. Clé primaire : `folder` (nom du dossier).
 *
 * Le versionnement de la base (DB_VERSION) déclenche le callback `upgrade` lors
 * de la première ouverture après un changement de version. Les gardes
 * `db.objectStoreNames.contains(...)` assurent que les stores existants ne sont
 * pas recréés lors des montées de version incrémentales.
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { CategorySettings } from '@/types'

/** Nom de la base IndexedDB */
const DB_NAME = 'cookexplorer-cache'

/**
 * Version du schéma IndexedDB.
 * Historique : v1 = recipes, v2 = +tags, v3 = +categories.
 * Bumper ce numéro à chaque ajout/modification de store.
 */
const DB_VERSION = 3

/**
 * Structure d'une recette en cache IndexedDB.
 * Le contenu parsé est sérialisé en JSON string pour éviter les problèmes
 * de clonage structuré d'IndexedDB avec certains objets complexes.
 */
interface CachedRecipe {
  /** Chemin dans le repo, sert de clé primaire (ex : "plats/poulet-roti.cook") */
  path: string
  /** Nom du fichier sans extension */
  name: string
  /** SHA Git du blob (pour détecter les changements) */
  sha: string
  /** Contenu brut du fichier .cook (frontmatter + corps) */
  content?: string
  /** CooklangRecipe sérialisé en JSON (évite de re-parser au chargement) */
  parsedJson?: string
  /** Image associée encodée en data URI (base64), null si aucune image */
  image?: string | null
  /** Titre extrait du frontmatter (pour affichage rapide en liste) */
  title?: string
  /** Timestamp de dernière écriture en cache (Date.now()) */
  updatedAt: number
}

/** Structure d'un tag en cache : association nom → clé de couleur du thème. */
export interface CachedTag {
  /** Nom du tag (clé primaire) */
  name: string
  /** Clé de couleur parmi la palette du thème : 'sage' | 'warm' | 'accent' | 'plum' | 'sky' | 'rose' */
  color: string
}

/** Palette de 6 couleurs pour l'attribution automatique aux tags (round-robin équilibré). */
const TAG_COLORS = ['sage', 'warm', 'accent', 'plum', 'sky', 'rose']

/**
 * Promise singleton de la connexion IndexedDB.
 * Initialisée une seule fois par `getDb()`, partagée entre tous les appels.
 */
let dbPromise: Promise<IDBPDatabase> | null = null

/**
 * Ouvre (ou réutilise) la connexion à la base IndexedDB.
 * Le callback `upgrade` est appelé lors de la création initiale ou d'un
 * changement de `DB_VERSION` — il crée les stores manquants.
 */
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store des recettes (v1+)
        if (!db.objectStoreNames.contains('recipes')) {
          db.createObjectStore('recipes', { keyPath: 'path' })
        }
        // Store des tags (v2+)
        if (!db.objectStoreNames.contains('tags')) {
          db.createObjectStore('tags', { keyPath: 'name' })
        }
        // Store des catégories (v3+)
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'folder' })
        }
      }
    })
  }
  return dbPromise
}

/**
 * Composable fournissant les opérations CRUD sur les trois stores IndexedDB.
 * Chaque méthode ouvre une transaction, effectue l'opération et attend sa complétion.
 */
export function useRecipeCache() {

  // ── Recipes ──────────────────────────────────────────────────────────────

  /** Lit toutes les recettes en cache. */
  async function getAllRecipes(): Promise<CachedRecipe[]> {
    const db = await getDb()
    return db.getAll('recipes')
  }

  /** Lit une recette en cache par son chemin. */
  async function getRecipe(path: string): Promise<CachedRecipe | undefined> {
    const db = await getDb()
    return db.get('recipes', path)
  }

  /**
   * Écrit ou met à jour une recette en cache.
   * Les champs fournis écrasent les valeurs existantes ; les champs absents
   * conservent la valeur précédente (merge partiel).
   */
  async function putRecipe(data: Partial<CachedRecipe> & { path: string }) {
    const db = await getDb()
    const existing = await db.get('recipes', data.path)
    const merged: CachedRecipe = {
      path: data.path,
      name: data.name ?? existing?.name ?? '',
      sha: data.sha ?? existing?.sha ?? '',
      content: data.content ?? existing?.content,
      parsedJson: data.parsedJson ?? existing?.parsedJson,
      image: data.image !== undefined ? data.image : existing?.image,
      title: data.title ?? existing?.title,
      updatedAt: Date.now()
    }
    await db.put('recipes', merged)
  }

  /**
   * Écrit plusieurs recettes en une seule transaction IndexedDB.
   * Plus performant que des `putRecipe` individuels car la transaction
   * n'est commitée qu'une fois à la fin.
   */
  async function putMany(items: Array<Partial<CachedRecipe> & { path: string }>) {
    const db = await getDb()
    const tx = db.transaction('recipes', 'readwrite')
    for (const item of items) {
      const existing = await tx.store.get(item.path)
      const merged: CachedRecipe = {
        path: item.path,
        name: item.name ?? existing?.name ?? '',
        sha: item.sha ?? existing?.sha ?? '',
        content: item.content ?? existing?.content,
        parsedJson: item.parsedJson ?? existing?.parsedJson,
        image: item.image !== undefined ? item.image : existing?.image,
        title: item.title ?? existing?.title,
        updatedAt: Date.now()
      }
      await tx.store.put(merged)
    }
    await tx.done
  }

  /** Supprime une recette du cache par son chemin. */
  async function deleteRecipe(path: string) {
    const db = await getDb()
    await db.delete('recipes', path)
  }

  /** Vide entièrement le store des recettes. */
  async function clearAll() {
    const db = await getDb()
    await db.clear('recipes')
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  /** Lit tous les tags en cache avec leurs couleurs assignées. */
  async function getAllTags(): Promise<CachedTag[]> {
    const db = await getDb()
    return db.getAll('tags')
  }

  /**
   * Synchronise les tags en cache avec la liste actuelle des noms de tags.
   * - Les tags existants conservent leur couleur.
   * - Les nouveaux tags reçoivent la couleur la moins utilisée (round-robin équilibré).
   * - Les tags obsolètes (absents de `currentTagNames`) sont supprimés.
   *
   * @param currentTagNames - Liste complète des noms de tags actuellement utilisés
   * @returns La liste synchronisée des tags avec leurs couleurs
   */
  async function syncTags(currentTagNames: string[]): Promise<CachedTag[]> {
    const db = await getDb()
    const existing = await db.getAll('tags') as CachedTag[]
    const existingMap = new Map(existing.map(t => [t.name, t]))
    const usedColors = new Set(existing.map(t => t.color))

    // Compteur pour le round-robin des couleurs
    let colorIndex = 0
    /** Retourne la couleur la moins représentée parmi les tags existants. */
    function nextColor(): string {
      const colorCounts = TAG_COLORS.map(c => ({
        color: c,
        count: existing.filter(t => t.color === c).length
      }))
      colorCounts.sort((a, b) => a.count - b.count)
      return colorCounts[colorIndex++ % colorCounts.length].color
    }

    const result: CachedTag[] = []
    const tx = db.transaction('tags', 'readwrite')

    // Conserver les tags existants, créer les nouveaux
    for (const name of currentTagNames) {
      if (existingMap.has(name)) {
        result.push(existingMap.get(name)!)
      } else {
        const tag: CachedTag = { name, color: nextColor() }
        await tx.store.put(tag)
        result.push(tag)
      }
    }

    // Supprimer les tags qui n'existent plus dans les recettes
    const currentSet = new Set(currentTagNames)
    for (const tag of existing) {
      if (!currentSet.has(tag.name)) {
        await tx.store.delete(tag.name)
      }
    }

    await tx.done
    return result
  }

  // ── Categories ───────────────────────────────────────────────────────────

  /** Lit tous les paramètres de catégories en cache. */
  async function getAllCategories(): Promise<CategorySettings[]> {
    const db = await getDb()
    return db.getAll('categories')
  }

  /**
   * Écrit plusieurs catégories en une seule transaction IndexedDB.
   * Écrase les entrées existantes ayant le même `folder`.
   */
  async function putManyCategories(items: CategorySettings[]) {
    const db = await getDb()
    const tx = db.transaction('categories', 'readwrite')
    for (const item of items) {
      await tx.store.put(item)
    }
    await tx.done
  }

  /** Vide entièrement le store des catégories. */
  async function clearCategories() {
    const db = await getDb()
    await db.clear('categories')
  }

  return {
    // Recipes
    getAllRecipes, getRecipe, putRecipe, putMany, deleteRecipe, clearAll,
    // Tags
    getAllTags, syncTags,
    // Categories
    getAllCategories, putManyCategories, clearCategories
  }
}
