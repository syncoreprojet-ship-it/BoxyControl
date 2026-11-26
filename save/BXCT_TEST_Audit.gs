/**
 * Diagnostic du mode TEST sans donnees personnelles, sans ecriture,
 * sans Script Properties, sans acces aux classeurs CONTROL/CLIENT.
 * Fonction facultative a executer depuis l'editeur Apps Script :
 * BXCT_TEST_AUDIT_SANS_ECRITURE().
 */
function BXCT_TEST_AUDIT_SANS_ECRITURE() {
  var bloque = false;
  try { verifyGoogleIdToken_('JETON_TEST'); }
  catch (e) { bloque = String(e && e.message || '') === 'SESSION_INVALIDE'; }
  var resultat = {
    ok: BXCT_TEST_CONFIG_apercuLibre_() && bloque &&
      typeof controlBootstrap === 'function' &&
      typeof BXCT_L7_TRAITER_DOSSIER === 'function',
    version: BXCT_TEST_VERSION_,
    accesLibreDemo: BXCT_TEST_CONFIG_apercuLibre_(),
    googleOauthPersonnalise: false,
    modeAuth: 'LOCAL_PASSWORD',
    appelsMetierSansAuthentification: 'REFUSES',
    jetonsGoogleAcceptes: false,
    donneesReellesConsultees: false,
    ecritureEffectuee: false,
    liaisonClientModifiee: false
  };
  console.log(JSON.stringify(resultat));
  return resultat;
}
