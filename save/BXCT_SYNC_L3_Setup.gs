/**
 * SETUP volontaire depuis l'editeur Apps Script. Fonctions proprietaire uniquement.
 * Autorise UNIQUEMENT la lecture des demandes, pour le role indique.
 * Voir README : activer d'abord ADMIN_CONTROL pour une recette pilote, puis AGENT.
 * Depend de : BXCT_SYNC_L3_Service.
 */
function BXCT_SYNC_L3_ACTIVER_LECTURE_ADMIN(){
  const resultat=BXCT_SYNC_L3_SERVICE_habiliter_('ADMIN_CONTROL');
  console.log(JSON.stringify(resultat));return resultat;
}
function BXCT_SYNC_L3_ACTIVER_LECTURE_AGENT(){
  const resultat=BXCT_SYNC_L3_SERVICE_habiliter_('AGENT');
  console.log(JSON.stringify(resultat));return resultat;
}
