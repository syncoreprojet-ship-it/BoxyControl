/** AUTH + permissions, toujours avant de lire la moindre donnée personnelle. */
function BXCT_L3_AUTH_contexte_(token, choix) {
  const identite = verifyGoogleIdToken_(token);
  const control = controlWorkbook_();
  const params = readControlSettings_(control);
  const agent = findEnabledAgent_(control, identite);
  const permissions = loadRolePermissions_(control, agent.role);
  if (params.APP_MODE !== 'PRODUCTION' ||
      PropertiesService.getScriptProperties().getProperty('CONTROL_USE_TEST_SHEET') === 'OUI') {
    throw new Error('LOT3_MODE_PRODUCTION_REQUIS');
  }
  const photo = params.RECHERCHE_CLIENT_ACTIVE === 'OUI' &&
    permissions.includes('CONSULTER_DEMANDE');
  const academie = params.ACADEMIE_RECHERCHE_ACTIVE === 'OUI' &&
    params.ACADEMIE_RECHERCHE_SOURCE === 'CLIENT_SEUL' &&
    params.ACADEMIE_AUDIT_RECHERCHE_OBLIGATOIRE === 'OUI' &&
    permissions.includes('CONSULTER_INSCRIPTION_ACADEMIE');
  if (!photo && !academie) throw new Error('LOT3_CONSULTATION_NON_AUTORISEE');
  if ((choix === 'PHOTO' && !photo) || (choix === 'ACADEMIE' && !academie)) {
    throw new Error('LOT3_CONSULTATION_NON_AUTORISEE');
  }
  return {control:control, params:params, agent:agent, droits:{PHOTO:photo,ACADEMIE:academie}};
}
