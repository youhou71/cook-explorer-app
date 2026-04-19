/**
 * Définitions TypeScript centrales de l'application CookExplorer.
 *
 * Ce fichier regroupe toutes les interfaces partagées entre les composables,
 * les stores Pinia et les vues Vue. Il est organisé en trois blocs :
 *
 *  1. **Types Cooklang** — représentation du contenu d'un fichier .cook après
 *     parsing par la bibliothèque `cooklang` : ingrédients, minuteurs, ustensiles,
 *     étapes, sections et recette complète.
 *
 *  2. **Types GitHub** — structures liées à l'intégration GitHub (config du repo,
 *     fichier de recette avec métadonnées Git, arborescence de dossiers).
 *
 *  3. **Type CategorySettings** — personnalisation d'un type de plat (couleur,
 *     icône, ordre d'affichage…) stockée dans un fichier `.category.json` à la
 *     racine de chaque dossier de catégorie du repo.
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. Types Cooklang (basés sur la spec officielle https://cooklang.org/)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Un ingrédient extrait d'une étape.
 * Syntaxe Cooklang : `@farine{250%g}` → name="farine", quantity=250, units="g"
 */
export interface CooklangIngredient {
  type: 'ingredient'
  /** Nom de l'ingrédient tel qu'il apparaît dans le texte */
  name: string
  /** Quantité brute (nombre ou texte libre, ex : "1/2", 250) */
  quantity: string | number
  /** Unité de mesure (g, ml, cs…). Chaîne vide si non précisée. */
  units: string
}

/**
 * Un minuteur extrait d'une étape.
 * Syntaxe Cooklang : `~{15%min}` → quantity=15, units="min"
 */
export interface CooklangTimer {
  type: 'timer'
  /** Nom optionnel du minuteur (ex : "repos") */
  name?: string
  /** Durée numérique */
  quantity: number
  /** Unité de temps (min, h, s…) */
  units: string
}

/**
 * Un ustensile de cuisine extrait d'une étape.
 * Syntaxe Cooklang : `#poêle{}` → name="poêle"
 */
export interface CooklangCookware {
  type: 'cookware'
  /** Nom de l'ustensile */
  name: string
  /** Quantité (1 par défaut) */
  quantity: number
}

/**
 * Une étape de recette : tableau mixte de fragments de texte brut
 * et d'éléments sémantiques (ingrédient, minuteur, ustensile).
 * L'ordre du tableau correspond à l'ordre d'apparition dans la ligne.
 */
export type CooklangStep = Array<string | CooklangIngredient | CooklangTimer | CooklangCookware>

/**
 * Groupe d'étapes introduit par une ligne `= Titre` dans le fichier .cook.
 * Permet de structurer la recette en phases (ex : "Pâte", "Garniture", "Cuisson").
 */
export interface CooklangSection {
  /** Titre de la section (null pour la section implicite qui précède le premier `=`) */
  title: string | null
  /** Étapes appartenant à cette section, dans l'ordre du fichier */
  steps: CooklangStep[]
  /** Ingrédients utilisés dans cette section, dédupliqués par couple (name, units) */
  ingredients: CooklangIngredient[]
}

/**
 * Recette complète après parsing d'un fichier .cook (frontmatter YAML + corps Cooklang).
 * C'est la structure principale manipulée par les vues détail et édition.
 */
export interface CooklangRecipe {
  /** Toutes les étapes à plat, dans l'ordre du fichier (conservé pour rétrocompat) */
  steps: CooklangStep[]
  /** Étapes groupées par section. Il y a toujours au moins 1 entrée si des steps existent. */
  sections: CooklangSection[]
  /** Métadonnées clé-valeur issues du frontmatter YAML (title, servings, prep_time…) */
  metadata: Record<string, string>
  /** Liste globale de tous les ingrédients (dédupliqués) */
  ingredients: CooklangIngredient[]
  /** Liste globale de tous les ustensiles */
  cookware: CooklangCookware[]
  /** Liste globale de tous les minuteurs */
  timers: CooklangTimer[]
  /** Notes de l'auteur (lignes commençant par `>` dans le .cook) */
  notes: string[]
}

/**
 * Vue « résumé » d'une recette, utilisée pour l'affichage en liste et dans les headers.
 * Les taxonomies (origin, seasons) sont extraites des tags préfixés `origine:*` / `saison:*`
 * et séparées de la liste `tags` qui ne contient que les tags libres.
 */
export interface CooklangSummary {
  title: string
  servings?: string
  prepTime?: string
  cookTime?: string
  totalTime?: string
  /** Tags libres (sans préfixe taxonomique) */
  tags: string[]
  /** Origine géographique (valeur unique, sans préfixe). Ex : 'italien'. */
  origin: string | null
  /** Saisons associées (1+ valeurs, sans préfixe). Ex : ['été', 'automne']. */
  seasons: string[]
  /** Nombre total d'ingrédients distincts */
  ingredientCount: number
  /** Date ISO de création (champ `created_at` du frontmatter) */
  createdAt?: string
  /** Date ISO de dernière modification (champ `updated_at` du frontmatter) */
  updatedAt?: string
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Types GitHub
// ────────────────────────────────────────────────────────────────────────────

/** Configuration de connexion au repo GitHub, stockée en localStorage. */
export interface GitHubConfig {
  /** Personal Access Token (fine-grained ou classic) */
  token: string
  /** Propriétaire du repo (utilisateur ou organisation) */
  owner: string
  /** Nom du repo (ex : "mes-recettes") */
  repo: string
  /** Branche cible (ex : "main") */
  branch: string
}

/**
 * Représentation d'un fichier .cook dans le repo GitHub.
 * Le champ `sha` est le hash Git du blob, nécessaire pour les opérations
 * de mise à jour et de suppression via l'API GitHub.
 */
export interface RecipeFile {
  /** Nom du fichier sans l'extension .cook */
  name: string
  /** Chemin complet dans le repo (ex : "plats/poulet-roti.cook") */
  path: string
  /** SHA Git du blob, utilisé pour identifier les changements et pour l'API update/delete */
  sha: string
  /** Contenu brut du fichier .cook (frontmatter + corps). Absent si non encore chargé. */
  content?: string
  /** Recette parsée en mémoire. Absent si non encore parsé. */
  parsed?: CooklangRecipe
  /** Date de dernière modification (optionnelle, issue des commits Git) */
  lastModified?: string
}

/** Nœud d'arborescence de dossiers dans le repo (non utilisé en pratique, conservé pour compat). */
export interface RecipeDirectory {
  name: string
  path: string
  files: RecipeFile[]
  subdirs: RecipeDirectory[]
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Type CategorySettings
// ────────────────────────────────────────────────────────────────────────────

/**
 * Paramètres de personnalisation d'un type de plat (= dossier racine du repo).
 *
 * Ces valeurs sont stockées dans un fichier `.category.json` à la racine de
 * chaque dossier de catégorie (ex : `plats/.category.json`). Elles permettent
 * de définir un nom d'affichage, des couleurs, un ordre de tri, des heures
 * de consommation typiques, une icône et une description.
 *
 * Le champ `folder` sert de clé primaire (nom du dossier, ex : "plats").
 * Le champ `sha` est le hash Git du fichier `.category.json` — il est nécessaire
 * pour mettre à jour le fichier via l'API GitHub (absent si le fichier n'existe
 * pas encore sur le repo).
 *
 * Tous les champs (sauf `folder`) ont des valeurs par défaut définies dans
 * `utils/categories.ts → buildCategorySettings()`, ce qui permet à l'app de
 * fonctionner même sans aucun fichier `.category.json` dans le repo.
 */
// ────────────────────────────────────────────────────────────────────────────
// 4. Types Planification de repas
// ────────────────────────────────────────────────────────────────────────────

/**
 * Un créneau de repas dans le planning hebdomadaire.
 * Associe une recette à un jour et un moment de la journée.
 */
export interface MealSlot {
  /** Jour de la semaine (0 = lundi, 6 = dimanche) */
  day: number
  /** Créneau horaire : 'lunch' (déjeuner) ou 'dinner' (dîner) */
  slot: 'lunch' | 'dinner'
  /** Chemin de la recette dans le repo (clé de jointure avec RecipeFile.path) */
  recipePath: string
  /** Nombre de portions souhaitées pour ce repas (par défaut = portions de la recette) */
  servings: number
  /** Nombre de jours couverts par ce repas (1 = jour unique, 2+ = étalé sur plusieurs jours) */
  span: number
}

/**
 * Planning de repas pour une semaine donnée.
 * Stocké en IndexedDB avec `weekStart` comme clé primaire.
 */
export interface MealPlan {
  /** Date ISO du lundi de la semaine (YYYY-MM-DD), sert de clé primaire */
  weekStart: string
  /** Liste des repas assignés dans la semaine */
  meals: MealSlot[]
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Type CategorySettings
// ────────────────────────────────────────────────────────────────────────────

/**
 * Association ingrédient → rayon de supermarché, stockée en IndexedDB.
 * Permet à l'utilisateur de personnaliser le classement des ingrédients
 * dans la liste de courses.
 */
export interface IngredientAisleMapping {
  /** Nom normalisé de l'ingrédient (singulier, minuscule). Clé primaire. */
  ingredient: string
  /** Identifiant du rayon (ex : 'fruits-legumes', 'cremerie'). */
  aisleId: string
}

export interface CategorySettings {
  /** Nom du dossier dans le repo (clé primaire). Ex : "plats", "desserts". */
  folder: string
  /** Nom d'affichage (ex : "Plats principaux"). Fallback : nom du dossier. */
  name: string
  /** Couleur principale en hexadécimal (ex : "#c4593a"). Utilisée pour le thème de la page détail. */
  color: string
  /** Couleur secondaire / claire (ex : "#fdf0eb"). Utilisée pour les fonds et badges. */
  colorSecondary: string
  /** Ordre de tri (0 = premier). Les catégories sans ordre explicite sont triées alphabétiquement à la fin. */
  order: number
  /** Heures de consommation typiques au format "HH:MM" (ex : ["12:00", "19:00"]). */
  hours: string[]
  /** Icône emoji (ex : "🍽️"). Affichée dans les badges, menus et page de paramétrage. */
  icon: string
  /** Description courte du type de plat (optionnelle). */
  description: string
  /** SHA Git du fichier .category.json (absent si le fichier n'existe pas encore sur le repo). */
  sha?: string
}
