// Types Cooklang (basés sur la spec officielle)
export interface CooklangIngredient {
  type: 'ingredient'
  name: string
  quantity: string | number
  units: string
}

export interface CooklangTimer {
  type: 'timer'
  name?: string
  quantity: number
  units: string
}

export interface CooklangCookware {
  type: 'cookware'
  name: string
  quantity: number
}

export type CooklangStep = Array<string | CooklangIngredient | CooklangTimer | CooklangCookware>

/** Groupe d'étapes introduit par une ligne "= Titre" dans le .cook */
export interface CooklangSection {
  /** Titre de la section (null pour la section implicite sans titre qui précède la première "=") */
  title: string | null
  steps: CooklangStep[]
  /** Ingrédients utilisés dans les étapes de cette section, dédupliqués par (name, units) */
  ingredients: CooklangIngredient[]
}

export interface CooklangRecipe {
  /** Toutes les étapes à plat, dans l'ordre du fichier (conservé pour rétrocompat) */
  steps: CooklangStep[]
  /** Étapes groupées par section. Il y a toujours au moins 1 entrée si des steps existent. */
  sections: CooklangSection[]
  metadata: Record<string, string>
  ingredients: CooklangIngredient[]
  cookware: CooklangCookware[]
  timers: CooklangTimer[]
  notes: string[]
}

// Types GitHub
export interface GitHubConfig {
  token: string
  owner: string
  repo: string
  branch: string
}

export interface RecipeFile {
  name: string         // nom du fichier sans extension
  path: string         // chemin dans le repo
  sha: string          // SHA pour les mises à jour
  content?: string     // contenu brut .cook
  parsed?: CooklangRecipe
  lastModified?: string
}

export interface RecipeDirectory {
  name: string
  path: string
  files: RecipeFile[]
  subdirs: RecipeDirectory[]
}
