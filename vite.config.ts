/**
 * Configuration Vite pour CookExplorer.
 *
 * Plugins :
 *  - **@vitejs/plugin-vue** : support des SFC (.vue) avec `<script setup>`.
 *  - **vite-plugin-pwa** : génération du service worker et du manifest PWA.
 *    - `registerType: 'autoUpdate'` : le SW se met à jour en arrière-plan sans
 *      prompt utilisateur, garantissant que la dernière version est toujours servie.
 *    - Le manifest déclare l'app en mode `standalone` (portrait uniquement)
 *      pour une expérience native sur mobile.
 *    - Workbox cache les assets statiques et utilise une stratégie `NetworkFirst`
 *      pour les appels GitHub API (cache de 5 min, 50 entrées max).
 *
 * Alias :
 *  - `@` → `src/` (aligne avec le `paths` de `tsconfig.json`).
 */

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  /**
   * Base URL de déploiement.
   * En production (GitHub Pages), l'app est servie depuis /cook-explorer-app/.
   * En dev, Vite utilise '/' par défaut (le ternaire n'est pas nécessaire car
   * Vite override en dev, mais c'est explicite pour la documentation).
   */
  base: '/cook-explorer-app/',
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CookExplorer',
        short_name: 'CookExplorer',
        description: 'Gestionnaire de recettes Cooklang connecté à GitHub',
        theme_color: '#1a1a1a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        /** Cache tous les assets statiques (JS, CSS, HTML, images). */
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        /**
         * Pas de runtimeCaching pour l'API GitHub : l'app gère sa propre couche
         * de cache via IndexedDB (store recipes). Un cache SW sur les appels API
         * provoque des données périmées (recettes supprimées qui réapparaissent).
         */
        runtimeCaching: []
      }
    })
  ]
})
