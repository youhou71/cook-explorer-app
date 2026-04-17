/**
 * Point d'entrée de l'application CookExplorer.
 *
 * Initialise l'instance Vue 3 avec les plugins nécessaires :
 *  - **Pinia** : gestion d'état réactive (stores recipes, github)
 *  - **Vue Router** : navigation SPA avec lazy-loading des vues
 *  - **main.css** : variables CSS du thème, styles globaux et print
 *
 * L'application est montée sur l'élément `#app` du `index.html`.
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
