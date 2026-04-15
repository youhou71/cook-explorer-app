# Cook explorer — PWA × GitHub

Gestionnaire de recettes [Cooklang](https://cooklang.org) stockées dans un repo GitHub.  
Fonctionne sur navigateur (PC) et Android (installable via Chrome).

## Stack

| Outil | Rôle |
|---|---|
| Vue 3 + TypeScript | UI |
| Vite + `@vite-pwa/vite-plugin` | Build + PWA (service worker, manifest) |
| Pinia | State management |
| `@octokit/rest` | API GitHub (lecture/écriture fichiers .cook) |
| `cooklang` | Parser Cooklang officiel |
| `@vueuse/core` | `useLocalStorage`, `useDebounceFn`, etc. |

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173, puis va dans **⚙ Settings** pour configurer ton token GitHub.

## Configuration GitHub

1. Crée un [Personal Access Token](https://github.com/settings/tokens/new)  
   - Droits nécessaires : `repo` (classic) ou `contents: read+write` (fine-grained)
2. Renseigne dans l'app :
   - **Token** : `ghp_xxxxxxxxxxxx`
   - **Owner** : ton pseudo GitHub
   - **Repo** : nom du repo contenant tes fichiers `.cook`
   - **Branche** : `main` par défaut

Le token est stocké dans `localStorage` — il ne transite jamais par un serveur.

## Structure attendue du repo de recettes

```
mes-recettes/
├── petit-dejeuner/
│   └── pancakes.cook
├── plats/
│   └── poulet-roti.cook
└── desserts/
    ├── tarte-citron.cook
    └── mousse-chocolat.cook
```

Tous les fichiers `.cook` sont listés récursivement, quel que soit le niveau d'imbrication.

## Exemple de fichier Cooklang

```cooklang
>> title: Pancakes moelleux
>> servings: 4
>> time: 20 min

Mélanger @farine{250%g}, @sucre{2%cs} et @levure chimique{1%cs}.

Ajouter @œufs{2}, @lait{30%cl} et @beurre fondu{50%g}. Mélanger sans trop travailler.

Faire chauffer une @poêle antiadhésive{} à feu moyen. Verser une louche de pâte et cuire ~{2%min} par face jusqu'à dorure.
```

## Build production

```bash
npm run build
# → dist/ contient l'app statique + le service worker PWA
```

Déployable sur **GitHub Pages**, **Netlify**, **Vercel**, ou tout hébergement de fichiers statiques.

### Déploiement GitHub Pages (exemple)

```bash
# vite.config.ts : ajouter base: '/nom-du-repo/'
npm run build
npx gh-pages -d dist
```

## Architecture des fichiers

```
src/
├── assets/
│   └── main.css            # Variables CSS globales + styles de base
├── composables/
│   ├── useGitHub.ts         # Toutes les opérations GitHub (Octokit)
│   └── useCooklang.ts       # Parse + rendu des fichiers .cook
├── stores/
│   ├── github.ts            # Config GitHub persistée (localStorage)
│   └── recipes.ts           # Cache des recettes en mémoire
├── types/
│   └── index.ts             # Types TypeScript (RecipeFile, CooklangRecipe…)
├── views/
│   ├── HomeView.vue          # Page d'accueil / landing
│   ├── SettingsView.vue      # Formulaire de config GitHub
│   ├── RecipeListView.vue    # Liste + recherche
│   ├── RecipeDetailView.vue  # Affichage d'une recette parsée
│   └── RecipeEditView.vue    # Éditeur + prévisualisation live
├── router/
│   └── index.ts             # Vue Router (guard si non configuré)
├── App.vue                   # Layout principal + nav
└── main.ts                   # Point d'entrée
```

## Pistes d'évolution

- **Mode cuisine** : affichage plein écran étape par étape, écran toujours allumé (`WakeLock API`)
- **Minuteurs interactifs** : déclenchés depuis les `~{N%min}` du fichier
- **Multiplication des portions** : recalcul automatique des quantités
- **Images** : stockage dans le même repo (dossier `images/`)
- **Recherche par ingrédient** : parser tous les fichiers et indexer
- **Hors-ligne** : les recettes ouvertes sont mises en cache par le service worker
