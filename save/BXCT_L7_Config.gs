/**
 * BOXY CONTROL | Lot 7/8 | v7.0.2-rc1
 * Contrat de traitement des reservations, prepare avant la liaison du Lot 8.
 * Depend de: BXCT_L6_Config pour les codes prestations.
 * Utilise par: BXCT_L7_Validation, BXCT_L7_Data, BXCT_L7_Service.
 * Aucun commutateur UI ou feuille ne peut activer les mutations.
 */
const BXCT_L7_VERSION_ = '7.0.2-rc1';
const BXCT_L7_SCHEMA_VERSION_ = 1;
const BXCT_L7_LIAISON_ECRITURE_ACTIVE_ = false;
const BXCT_L7_LIAISON_LECTURE_ACTIVE_ = false;
const BXCT_L7_MOTIFS_CONFIRMATION_ = Object.freeze([
  'ACOMPTE_VERIFIE','CONFIRMATION_TELEPHONE','PRESENCE_SUR_PLACE'
]);
const BXCT_L7_RESULTATS_RAPPEL_ = Object.freeze([
  'APPEL_EFFECTUE','SANS_REPONSE','A_RAPPELER','MESSAGE_ENVOYE'
]);
