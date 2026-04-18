# CookExplorer — Gestionnaire de recettes Cooklang

Application web de gestion de recettes au format [Cooklang](https://cooklang.org), connectée directement à un dépôt GitHub. Fonctionne sur navigateur (desktop) et mobile (installable en PWA via Chrome/Edge).

## Fonctionnalités

### Parcourir et rechercher

- Liste des recettes avec vignettes, badges de catégorie et durée
- Recherche plein texte (nom et chemin)
- Filtres combinables : catégorie, durée, origine géographique (40+ pays avec drapeaux), saisons, tags libres
- Tri par nom, date de création ou date de modification
- Affichage responsive : grille de cartes en desktop, cartes horizontales en mobile

### Consulter une recette

- Image hero pleine largeur avec titre et métadonnées (portions, temps de préparation/cuisson/total, origine, saisons)
- Ajustement dynamique des portions (+/−) avec recalcul proportionnel des ingrédients
- Panneau d'ingrédients sticky (desktop) regroupés par section
- Étapes numérotées avec mise en évidence des ingrédients, minuteurs et ustensiles
- Notes de l'auteur, lien source, dates de création/modification
- Thème couleur dynamique selon la catégorie de la recette

### Mode cuisine

- Bouton dans le header (visible uniquement sur le détail d'une recette)
- Empêche l'extinction de l'écran via la Wake Lock API
- Se désactive automatiquement en quittant la page de détail
- Ré-acquisition automatique au retour sur l'onglet

### Créer et modifier

- Éditeur deux panneaux : saisie Cooklang à gauche, prévisualisation live à droite
- Sélection de catégorie (avec création à la volée), origine, saisons
- Upload, remplacement et suppression d'image (JPG, PNG, WEBP)
- Gestion automatique du chemin fichier (renommage/déplacement sur GitHub si la catégorie ou le nom change)
- Parsing en temps réel avec debounce de 400 ms

### Catégories de plats

- Interface de paramétrage avec drag-and-drop pour l'ordre d'affichage
- Personnalisation par catégorie : nom, couleurs (primaire + secondaire), icône emoji, créneaux horaires, description
- Calcul automatique de la couleur secondaire
- Stocké dans un fichier `.category.json` par dossier dans le dépôt GitHub

### Impression

- Mise en page optimisée A4 portrait
- Ingrédients flottants à gauche, étapes à droite
- Masquage automatique des éléments interactifs
- Gestion des sauts de page (pas de coupure au milieu d'une étape ou d'une note)

### Dark mode

- Automatique selon la préférence système (`prefers-color-scheme`)
- Palette complète redéfinie (6 couleurs sémantiques + variantes)

### PWA et offline

- Installable sur mobile (manifest standalone, orientation portrait)
- Service worker avec mise à jour automatique (Workbox)
- Cache IndexedDB pour chargement instantané des recettes, tags et catégories

## Stack technique

| Outil | Rôle |
|---|---|
| Vue 3 + TypeScript | UI (Composition API, `<script setup>`) |
| Vue Router | Routage SPA avec lazy-loading des vues |
| Pinia | State management (stores réactifs) |
| Vite | Build, HMR, PWA via `vite-plugin-pwa` |
| `@octokit/rest` | API GitHub (lecture/écriture de fichiers `.cook` et images) |
| `cooklang` | Parser Cooklang officiel |
| `idb` | Wrapper IndexedDB (cache local) |
| `@vueuse/core` | `useLocalStorage`, `useDebounceFn`, etc. |
| `sortablejs` + `@vueuse/integrations` | Drag-and-drop des catégories |

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvrir http://localhost:5173, puis aller dans **Paramètres** pour configurer le token GitHub.

## Configuration GitHub

1. Créer un [Personal Access Token](https://github.com/settings/tokens/new)
   - Droits nécessaires : `repo` (classic) ou `contents: read+write` (fine-grained)
2. Renseigner dans l'app :
   - **Token** : `ghp_xxxxxxxxxxxx`
   - **Owner** : pseudo GitHub
   - **Repo** : nom du dépôt contenant les fichiers `.cook`
   - **Branche** : `main` par défaut

Le token est stocké dans `localStorage` — il ne transite jamais par un serveur.

## Structure du dépôt de recettes

```
mes-recettes/
├── petit-dejeuner/
│   ├── .category.json
│   └── pancakes.cook
├── plats/
│   ├── .category.json
│   ├── poulet-roti.cook
│   └── poulet-roti.jpg
└── desserts/
    ├── .category.json
    ├── tarte-citron.cook
    └── mousse-chocolat.cook
```

Les fichiers `.cook` sont listés récursivement. Les images (`.jpg`, `.png`, `.webp`) sont associées automatiquement par nom de fichier. Les fichiers `.category.json` sont optionnels et configurent l'apparence de chaque catégorie.

## Syntaxe Cooklang

```cooklang
>> title: Pancakes moelleux
>> servings: 4
>> time: 20 min

Mélanger @farine{250%g}, @sucre{2%cs} et @levure chimique{1%cs}.

Ajouter @œufs{2}, @lait{30%cl} et @beurre fondu{50%g}. Mélanger sans trop travailler.

Faire chauffer une @poêle antiadhésive{} à feu moyen.
Verser une louche de pâte et cuire ~{2%min} par face jusqu'à dorure.
```

Métadonnées supportées : `title`, `servings`, `prep time`, `cook time`, `total time`, `source`, `origine:pays`, `saison:nom`, tags libres.

## Architecture

```
src/
├── assets/
│   └── main.css                 # Variables CSS, thème, dark mode, print
├── composables/
│   ├── useCooklang.ts           # Parsing et rendu des fichiers .cook
│   ├── useGitHub.ts             # Opérations API GitHub (Octokit)
│   ├── useRecipeCache.ts        # CRUD IndexedDB (recettes, tags, catégories)
│   └── useWakeLock.ts           # Wake Lock API (mode cuisine)
├── stores/
│   ├── github.ts                # Config GitHub (localStorage)
│   └── recipes.ts               # Cache recettes + tags + catégories (IndexedDB)
├── types/
│   └── index.ts                 # Interfaces TypeScript
├── utils/
│   ├── categories.ts            # Tri et settings par défaut des catégories
│   ├── frontmatter.ts           # Manipulation YAML ↔ métadonnées Cooklang
│   ├── slug.ts                  # Normalisation des noms de fichiers
│   └── taxonomies.ts            # Origines (pays + drapeaux) et saisons
├── views/
│   ├── CategorySettingsView.vue # Paramétrage des types de plats
│   ├── RecipeDetailView.vue     # Affichage complet d'une recette
│   ├── RecipeEditView.vue       # Éditeur avec prévisualisation live
│   ├── RecipeListView.vue       # Liste, recherche et filtres
│   └── SettingsView.vue         # Configuration GitHub
├── router/
│   └── index.ts                 # Routes + guard de configuration
├── App.vue                      # Layout (header, mode cuisine, transitions)
└── main.ts                      # Point d'entrée (Pinia, Router, PWA)
```

### Flux de données

```
GitHub API ──→ useGitHub.ts ──→ recipes store (Pinia, in-memory)
                                      ↕
                              useRecipeCache.ts (IndexedDB)
```

Au chargement, le cache IndexedDB est hydraté dans le store Pinia pour un affichage instantané, puis les données GitHub sont récupérées en arrière-plan et fusionnées.

### Routes

| Chemin | Vue | Description |
|---|---|---|
| `/` | — | Redirection vers `/recipes` ou `/settings` |
| `/settings` | SettingsView | Configuration GitHub |
| `/categories` | CategorySettingsView | Gestion des types de plats |
| `/recipes` | RecipeListView | Liste et recherche |
| `/recipes/new` | RecipeEditView | Création de recette |
| `/recipes/:path/edit` | RecipeEditView | Édition de recette |
| `/recipes/:path` | RecipeDetailView | Détail d'une recette |

Les routes marquées `requiresConfig` redirigent vers `/settings` si GitHub n'est pas configuré.

## Build et déploiement

```bash
npm run build     # Type-check + build production → dist/
npm run preview   # Prévisualisation du build
```

L'application est un site statique déployable sur GitHub Pages, Netlify, Vercel ou tout hébergement de fichiers statiques.

### GitHub Pages

```bash
# vite.config.ts → base: '/nom-du-repo/'
npm run build
npx gh-pages -d dist
```
