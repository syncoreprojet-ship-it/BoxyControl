/**
 * BOXY CONTROL | Lot 7 | Controle d'identite et de permissions.
 * Depend de: Code.gs (verifyGoogleIdToken_, controlWorkbook_,
 * findEnabledAgent_, loadRolePermissions_).
 * Utilise par: BXCT_L7_Api.
 * Les permissions de traitement par univers seront affineees au Lot 8.
 */
function BXCT_L7_AUTH_contexte_(googleIdToken, intention) {
  const identity = verifyGoogleIdToken_(googleIdToken);
  const book = controlWorkbook_();
  const agent = findEnabledAgent_(book, identity);
  const droits = loadRolePermissions_(book, agent.role);
  const consultation = droits.includes('CONSULTER_DEMANDE') ||
    droits.includes('CONSULTER_INSCRIPTION_ACADEMIE');
  if (!consultation) throw new Error('BXCT_L7_AUTORISATION_REFUSEE');
  if (intention === 'DECISION' && !droits.includes('CONFIRMER_RESERVATION') &&
      !droits.includes('DECIDER_INSCRIPTION_ACADEMIE')) {
    throw new Error('BXCT_L7_AUTORISATION_REFUSEE');
  }
  return { agentId:agent.agentId, role:agent.role, droits:droits };
}
