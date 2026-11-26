/**
 * BOXY CONTROL | Lot 7 | Contrat serveur stable.
 * UI -> API -> AUTH/PERMISSIONS -> VALIDATION -> SERVICE -> DATA.
 * Depend de: BXCT_L7_Auth, Validation, Service.
 * Aucune mutation et aucun acces direct aux donnees CLIENT.
 */
function BXCT_L7_LIRE_DOSSIER(googleIdToken, dossier) {
  const contexte=BXCT_L7_AUTH_contexte_(googleIdToken,'LECTURE');
  const identite=BXCT_L7_VALIDATION_dossier_(dossier);
  return BXCT_L7_SERVICE_lireDossier_(contexte,identite);
}
function BXCT_L7_TRAITER_DOSSIER(googleIdToken, demande) {
  // Verifier les droits avant d'examiner des informations sensibles.
  const operation=demande && String(demande.action||'').toUpperCase();
  const contexte=BXCT_L7_AUTH_contexte_(googleIdToken,
    operation==='RAPPEL'?'LECTURE':'DECISION');
  const action=BXCT_L7_VALIDATION_action_(demande);
  return BXCT_L7_SERVICE_traiter_(contexte,action);
}
/** Audit sans ecriture, sans token Google et sans lecture de dossiers. */
function BXCT_L7_AUDIT_SANS_ECRITURE() {
  const functions=['BXCT_L7_LIRE_DOSSIER','BXCT_L7_TRAITER_DOSSIER',
    'BXCT_L7_AUTH_contexte_','BXCT_L7_VALIDATION_dossier_',
    'BXCT_L7_VALIDATION_action_','BXCT_L7_SERVICE_lireDossier_',
    'BXCT_L7_SERVICE_traiter_','BXCT_L7_DATA_lireDossier_'];
  const missing=functions.filter(n=>typeof globalThis[n]!=='function');
  const result={ok:missing.length===0 && !BXCT_L7_LIAISON_ECRITURE_ACTIVE_ &&
    !BXCT_L7_LIAISON_LECTURE_ACTIVE_,version:BXCT_L7_VERSION_,
    schema:BXCT_L7_SCHEMA_VERSION_,missing:missing,
    sourceConnectee:false,ecritureActive:false,lectureDossierActive:false,
    installationRequise:false};
  console.log(JSON.stringify(result));return result;
}
