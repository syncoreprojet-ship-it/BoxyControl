/**
 * BOXY CONTROL | TEST | garde serveur en refus systematique.
 * Depend de: aucune. Utilise par : Code.gs (wrapper legacy d'auth).
 * La demonstration UI n'est JAMAIS une identite d'agent serveur.
 */
function BXCT_TEST_AUTH_refuserAcces_() {
  throw new Error('AUTH_AGENT_DESACTIVEE_TEST');
}
