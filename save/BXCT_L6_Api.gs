/**
 * BOXY CONTROL | Lot 6 | API publique minimale.
 * UI -> API -> SERVICE -> AUTH -> DATA (lecture seule).
 * Aucun endpoint de confirmation, annulation ou paiement n'est cree.
 */
function BXCT_L6_LIRE_FILE(googleIdToken, options) {
  return BXCT_L6_SERVICE_lireFile_(googleIdToken, options);
}
/** Diagnostic structurel SANS ecriture et SANS lecture de dossier client. */
function BXCT_L6_AUDIT_SANS_ECRITURE() {
  const res = {
    ok: typeof BXCT_L6_LIRE_FILE === 'function' &&
        typeof BXCT_L6_SERVICE_lireFile_ === 'function' &&
        typeof BXCT_L6_AUTH_contexte_ === 'function' &&
        typeof BXCT_L6_VALIDATION_options_ === 'function' &&
        typeof BXCT_L6_DATA_lireFile_ === 'function' &&
        BXCT_L6_SOURCE_CONNECTEE_ === true,
    version: BXCT_L6_VERSION_,
    sourceReady: BXCT_L8_CONFIG_active_(),
    authentificationServeur: typeof BXCT_LOGIN_AUTH_verifierSession_ === 'function',
    permissionsServeur: typeof loadRolePermissions_ === 'function',
    lectureSeule: true,
    ecritureMetier: false
  };
  console.log(JSON.stringify(res));
  return res;
}
