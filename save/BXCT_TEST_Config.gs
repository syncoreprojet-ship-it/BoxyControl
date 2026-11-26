/**
 * BOXY CONTROL | brique TEST libre | 7.0.4-rc1
 * Config propre a la demonstration. Aucune dependance a Sheets.
 * Depend de : aucune. Utilise par : Code.gs et BXCT_TEST_Audit.gs.
 * La future connexion liee a PARAMETRES sera une brique distincte.
 */
const BXCT_TEST_VERSION_ = '7.0.4-rc1';
const BXCT_TEST_LIBRE_ = true;
/** Valeur versionnee, aucune ecriture ni effet externe. */
function BXCT_TEST_CONFIG_apercuLibre_() {
  return BXCT_TEST_LIBRE_ === true;
}
