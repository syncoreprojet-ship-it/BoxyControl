/** Identité et droits existants, aucun rôle fourni par le navigateur. */
function BXCT_FORM_ADMIN_AUTH_context_(token){
  const ctx=BXCT_CORE_AUTH_context_(token);
  if(ctx.settings.ACADEMIE_LECTURE_ACTIVE!=='OUI'||ctx.settings.ACADEMIE_SOURCE!=='CLIENT_SEUL'||!ctx.rights.includes('CONSULTER_ACADEMIE'))throw new Error('AUTORISATION_REFUSEE');
  return ctx;
}
function BXCT_FORM_ADMIN_AUTH_write_(ctx){
  return ctx.agent.role==='ADMIN_CONTROL'&&ctx.settings.APP_MODE==='TEST'&&PropertiesService.getScriptProperties().getProperty('BXCT_FORM_ADMIN_TEST_ENABLED')==='OUI'&&BXCT_L8_CONFIG_active_();
}
