/**
 * BOXY CONTROL | Lot 3/7 | AUTH serveur, login BOXY LOCAL_PASSWORD.
 * Depend de : Code.gs (adaptateur stable verifyGoogleIdToken_), AGENTS et ROLES.
 * Utilise par : BXCT_L6_Service. Aucune identite navigateur ni DEMO admise.
 * La portee par prestation est toujours recontrolee par BXCT_L8_AUTH_portee_.
 */
function BXCT_L6_AUTH_contexte_(googleIdToken) {
  // Aucun filtrage de permission ne doit etre confie a l'interface.
  const identity = verifyGoogleIdToken_(googleIdToken);
  const controle = controlWorkbook_();
  const agent = findEnabledAgent_(controle, identity);
  const permissions = loadRolePermissions_(controle, agent.role);
  if (!permissions.includes('CONSULTER_DEMANDE') &&
      !permissions.includes('CONSULTER_INSCRIPTION_ACADEMIE')) {
    throw new Error('BXCT_L6_AUTORISATION_REFUSEE');
  }
  return {controle:controle, agent:agent, agentId:agent.agentId, role:agent.role, droits:permissions};
}
