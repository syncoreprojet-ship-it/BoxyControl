/**
 * BOXY CONTROL | Lot 6 | validation serveur des options de consultation.
 * Depend de: BXCT_L6_Config. Utilise par: BXCT_L6_Service.
 */
function BXCT_L6_VALIDATION_options_(options) {
  const filtre=(options===undefined || options===null) ? {} : options;
  if (typeof filtre!=='object' || Array.isArray(filtre)) throw new Error('BXCT_L6_FILTRE_INVALIDE');
  const statut=String(filtre.statut || 'TOUS').trim().toUpperCase();
  const prestation=String(filtre.prestation || 'TOUS').trim().toUpperCase();
  if (!['TOUS','EN_ATTENTE','CONFIRMEE','ANNULEE'].includes(statut) ||
      !(['TOUS'].concat(BXCT_L6_PRESTATIONS_).includes(prestation))) {
    throw new Error('BXCT_L6_FILTRE_INVALIDE');
  }
  const limite=filtre.limite===undefined?BXCT_L6_MAX_AFFICHAGE_:Number(filtre.limite);
  if (!Number.isInteger(limite)||limite<1||limite>BXCT_L6_MAX_AFFICHAGE_) {
    throw new Error('BXCT_L6_LIMITE_INVALIDE');
  }
  const curseur=filtre.curseur===undefined?0:Number(filtre.curseur);
  if(!Number.isSafeInteger(curseur)||curseur<0||curseur>1000000)
    throw new Error('BXCT_L6_CURSEUR_INVALIDE');
  return {statut:statut,prestation:prestation,limite:limite,curseur:curseur};
}
