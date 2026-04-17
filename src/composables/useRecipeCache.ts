import { openDB, type IDBPDatabase } from 'idb'
import type { CategorySettings } from '@/types'

const DB_NAME = 'cookexplorer-cache'
const DB_VERSION = 3

interface CachedRecipe {
  path: string
  name: string
  sha: string
  content?: string
  parsedJson?: string // CooklangRecipe sérialisé
  image?: string | null // data URI
  title?: string
  updatedAt: number
}

export interface CachedTag {
  name: string
  color: string // clé de couleur : 'sage' | 'warm' | 'accent' | 'plum' | 'sky' | 'rose'
}

const TAG_COLORS = ['sage', 'warm', 'accent', 'plum', 'sky', 'rose']

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('recipes')) {
          db.createObjectStore('recipes', { keyPath: 'path' })
        }
        if (!db.objectStoreNames.contains('tags')) {
          db.createObjectStore('tags', { keyPath: 'name' })
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'folder' })
        }
      }
    })
  }
  return dbPromise
}

export function useRecipeCache() {

  // ── Recipes ──

  async function getAllRecipes(): Promise<CachedRecipe[]> {
    const db = await getDb()
    return db.getAll('recipes')
  }

  async function getRecipe(path: string): Promise<CachedRecipe | undefined> {
    const db = await getDb()
    return db.get('recipes', path)
  }

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

  async function deleteRecipe(path: string) {
    const db = await getDb()
    await db.delete('recipes', path)
  }

  async function clearAll() {
    const db = await getDb()
    await db.clear('recipes')
  }

  // ── Tags ──

  async function getAllTags(): Promise<CachedTag[]> {
    const db = await getDb()
    return db.getAll('tags')
  }

  /** Synchronise les tags : ajoute les nouveaux avec une couleur, supprime les obsolètes */
  async function syncTags(currentTagNames: string[]): Promise<CachedTag[]> {
    const db = await getDb()
    const existing = await db.getAll('tags') as CachedTag[]
    const existingMap = new Map(existing.map(t => [t.name, t]))
    const usedColors = new Set(existing.map(t => t.color))

    // Trouver la prochaine couleur libre (round-robin)
    let colorIndex = 0
    function nextColor(): string {
      // Prendre la première couleur la moins utilisée
      const colorCounts = TAG_COLORS.map(c => ({
        color: c,
        count: existing.filter(t => t.color === c).length
      }))
      colorCounts.sort((a, b) => a.count - b.count)
      return colorCounts[colorIndex++ % colorCounts.length].color
    }

    const result: CachedTag[] = []
    const tx = db.transaction('tags', 'readwrite')

    // Ajouter les nouveaux tags
    for (const name of currentTagNames) {
      if (existingMap.has(name)) {
        result.push(existingMap.get(name)!)
      } else {
        const tag: CachedTag = { name, color: nextColor() }
        await tx.store.put(tag)
        result.push(tag)
      }
    }

    // Supprimer les tags qui n'existent plus
    const currentSet = new Set(currentTagNames)
    for (const tag of existing) {
      if (!currentSet.has(tag.name)) {
        await tx.store.delete(tag.name)
      }
    }

    await tx.done
    return result
  }

  // ── Categories ──

  async function getAllCategories(): Promise<CategorySettings[]> {
    const db = await getDb()
    return db.getAll('categories')
  }

  async function putManyCategories(items: CategorySettings[]) {
    const db = await getDb()
    const tx = db.transaction('categories', 'readwrite')
    for (const item of items) {
      await tx.store.put(item)
    }
    await tx.done
  }

  async function clearCategories() {
    const db = await getDb()
    await db.clear('categories')
  }

  return { getAllRecipes, getRecipe, putRecipe, putMany, deleteRecipe, clearAll, getAllTags, syncTags, getAllCategories, putManyCategories, clearCategories }
}
