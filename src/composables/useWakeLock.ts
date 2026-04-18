/**
 * Composable Vue encapsulant la Wake Lock API du navigateur.
 *
 * Empêche l'écran de s'éteindre tant que le lock est actif — conçu pour le
 * « mode cuisine » où l'utilisateur consulte une recette mains occupées.
 *
 * Comportements clés :
 *  - **Ré-acquisition automatique** : quand l'utilisateur revient sur l'onglet
 *    après un changement d'app, le lock est ré-acquis silencieusement.
 *  - **Cleanup au démontage** : le lock est libéré via `onScopeDispose` quand
 *    le composant appelant est détruit (navigation vers une autre page).
 *  - **Dégradation gracieuse** : si l'API n'est pas supportée, `isSupported`
 *    est false et le bouton n'est pas affiché (v-if côté template).
 */

import { ref, onScopeDispose } from 'vue'

export function useWakeLock() {
  /** True si l'API Wake Lock est supportée par le navigateur. */
  const isSupported = ref('wakeLock' in navigator)

  /** True si le wake lock est actuellement actif. */
  const isActive = ref(false)

  /** Référence interne au WakeLockSentinel retourné par l'API. */
  let sentinel: WakeLockSentinel | null = null

  /** Acquiert le wake lock. Silencieux si non supporté ou déjà acquis. */
  async function request(): Promise<void> {
    if (!isSupported.value) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      isActive.value = true
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      // L'API peut refuser (batterie faible, page non visible, etc.)
    }
  }

  /** Libère le wake lock s'il est actif. */
  async function release(): Promise<void> {
    if (sentinel) {
      await sentinel.release()
      sentinel = null
    }
    isActive.value = false
  }

  /** Toggle : acquiert si inactif, libère si actif. */
  async function toggle(): Promise<void> {
    if (isActive.value) {
      await release()
    } else {
      await request()
    }
  }

  /**
   * Ré-acquisition automatique quand la page redevient visible.
   * Le navigateur libère le wake lock quand l'onglet passe en arrière-plan ;
   * ce listener le ré-acquiert au retour si le mode cuisine est toujours actif.
   */
  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && isActive.value) {
      request()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  /** Cleanup : libère le lock et retire le listener au démontage du composant. */
  onScopeDispose(() => {
    release()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { isSupported, isActive, toggle, release }
}
