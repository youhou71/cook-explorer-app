/**
 * Définitions des rayons de supermarché et mapping par défaut
 * des ingrédients courants vers leur rayon.
 */

/** Rayon de supermarché avec son identifiant, libellé, icône et ordre d'affichage. */
export interface Aisle {
  id: string
  name: string
  icon: string
  order: number
}

/** Liste ordonnée des rayons. */
export const AISLES: Aisle[] = [
  { id: 'fruits-legumes', name: 'Fruits & Légumes', icon: '🥬', order: 0 },
  { id: 'boucherie',      name: 'Boucherie & Poissonnerie', icon: '🥩', order: 1 },
  { id: 'cremerie',       name: 'Crèmerie', icon: '🧀', order: 2 },
  { id: 'boulangerie',    name: 'Boulangerie', icon: '🥖', order: 3 },
  { id: 'epicerie',       name: 'Épicerie', icon: '🫙', order: 4 },
  { id: 'conserves',      name: 'Conserves & Sauces', icon: '🥫', order: 5 },
  { id: 'surgeles',       name: 'Surgelés', icon: '❄️', order: 6 },
  { id: 'boissons',       name: 'Boissons', icon: '🍷', order: 7 },
  { id: 'autres',         name: 'Autres', icon: '📦', order: 8 },
]

/** Map id → Aisle pour accès rapide. */
export const AISLE_MAP = new Map(AISLES.map(a => [a.id, a]))

/**
 * Mapping par défaut : nom normalisé (singulier, minuscule, sans accents spéciaux)
 * vers identifiant de rayon.
 */
const DEFAULT_MAPPING: Record<string, string> = {
  // ── Fruits & Légumes ──
  'tomate':        'fruits-legumes',
  'oignon':        'fruits-legumes',
  'ail':           'fruits-legumes',
  'carotte':       'fruits-legumes',
  'pomme de terre': 'fruits-legumes',
  'courgette':     'fruits-legumes',
  'aubergine':     'fruits-legumes',
  'poivron':       'fruits-legumes',
  'salade':        'fruits-legumes',
  'laitue':        'fruits-legumes',
  'concombre':     'fruits-legumes',
  'champignon':    'fruits-legumes',
  'epinard':       'fruits-legumes',
  'brocoli':       'fruits-legumes',
  'chou':          'fruits-legumes',
  'chou-fleur':    'fruits-legumes',
  'haricot vert':  'fruits-legumes',
  'poireau':       'fruits-legumes',
  'celeri':        'fruits-legumes',
  'navet':         'fruits-legumes',
  'radis':         'fruits-legumes',
  'fenouil':       'fruits-legumes',
  'pomme':         'fruits-legumes',
  'poire':         'fruits-legumes',
  'banane':        'fruits-legumes',
  'citron':        'fruits-legumes',
  'orange':        'fruits-legumes',
  'fraise':        'fruits-legumes',
  'framboise':     'fruits-legumes',
  'avocat':        'fruits-legumes',
  'echalote':      'fruits-legumes',
  'persil':        'fruits-legumes',
  'ciboulette':    'fruits-legumes',
  'basilic':       'fruits-legumes',
  'coriandre':     'fruits-legumes',
  'menthe':        'fruits-legumes',
  'thym':          'fruits-legumes',
  'romarin':       'fruits-legumes',
  'gingembre':     'fruits-legumes',

  // ── Boucherie & Poissonnerie ──
  'poulet':        'boucherie',
  'boeuf':         'boucherie',
  'porc':          'boucherie',
  'agneau':        'boucherie',
  'veau':          'boucherie',
  'canard':        'boucherie',
  'dinde':         'boucherie',
  'saucisse':      'boucherie',
  'lardon':        'boucherie',
  'jambon':        'boucherie',
  'steak':         'boucherie',
  'escalope':      'boucherie',
  'filet de poulet': 'boucherie',
  'cuisse de poulet': 'boucherie',
  'viande hachee':  'boucherie',
  'saumon':        'boucherie',
  'thon':          'boucherie',
  'cabillaud':     'boucherie',
  'crevette':      'boucherie',
  'moule':         'boucherie',
  'merlu':         'boucherie',

  // ── Crèmerie ──
  'lait':          'cremerie',
  'beurre':        'cremerie',
  'creme fraiche':  'cremerie',
  'creme':         'cremerie',
  'fromage':       'cremerie',
  'fromage rape':   'cremerie',
  'mozzarella':    'cremerie',
  'parmesan':      'cremerie',
  'gruyere':       'cremerie',
  'emmental':      'cremerie',
  'chevre':        'cremerie',
  'yaourt':        'cremerie',
  'mascarpone':    'cremerie',
  'ricotta':       'cremerie',
  'oeuf':          'cremerie',

  // ── Boulangerie ──
  'pain':          'boulangerie',
  'baguette':      'boulangerie',
  'pain de mie':   'boulangerie',
  'brioche':       'boulangerie',
  'croissant':     'boulangerie',

  // ── Épicerie ──
  'farine':        'epicerie',
  'sucre':         'epicerie',
  'sel':           'epicerie',
  'poivre':        'epicerie',
  'huile d\'olive': 'epicerie',
  'huile':         'epicerie',
  'vinaigre':      'epicerie',
  'pate':          'epicerie',
  'riz':           'epicerie',
  'semoule':       'epicerie',
  'lentille':      'epicerie',
  'pois chiche':   'epicerie',
  'haricot':       'epicerie',
  'noix':          'epicerie',
  'amande':        'epicerie',
  'noisette':      'epicerie',
  'chocolat':      'epicerie',
  'cacao':         'epicerie',
  'levure':        'epicerie',
  'maizena':       'epicerie',
  'miel':          'epicerie',
  'confiture':     'epicerie',
  'epice':         'epicerie',
  'cumin':         'epicerie',
  'paprika':       'epicerie',
  'curry':         'epicerie',
  'cannelle':      'epicerie',
  'muscade':       'epicerie',
  'herbe de provence': 'epicerie',
  'bouillon':      'epicerie',
  'fond de veau':  'epicerie',
  'pignon de pin': 'epicerie',

  // ── Conserves & Sauces ──
  'tomate pelee':  'conserves',
  'concentre de tomate': 'conserves',
  'sauce tomate':  'conserves',
  'sauce soja':    'conserves',
  'moutarde':      'conserves',
  'ketchup':       'conserves',
  'mayonnaise':    'conserves',
  'olive':         'conserves',
  'capre':         'conserves',
  'cornichon':     'conserves',
  'pesto':         'conserves',

  // ── Boissons ──
  'vin blanc':     'boissons',
  'vin rouge':     'boissons',
  'biere':         'boissons',
  'jus de citron': 'boissons',
  'lait de coco':  'boissons',
}

/**
 * Normalise un nom d'ingrédient pour la recherche dans le mapping :
 * minuscule, sans accents, sans caractères spéciaux superflus.
 */
function normalizeForLookup(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
}

/**
 * Retourne l'identifiant du rayon par défaut pour un ingrédient donné.
 * Cherche d'abord une correspondance exacte, puis une correspondance partielle.
 */
export function getDefaultAisle(ingredientName: string): string {
  const norm = normalizeForLookup(ingredientName)

  if (DEFAULT_MAPPING[norm]) return DEFAULT_MAPPING[norm]

  for (const [key, aisleId] of Object.entries(DEFAULT_MAPPING)) {
    if (norm.includes(key) || key.includes(norm)) return aisleId
  }

  return 'autres'
}
