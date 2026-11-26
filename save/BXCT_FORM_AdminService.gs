/** Orchestration de la gestion. La mutation reste dans le service CLIENT. */
function BXCT_FORM_ADMIN_SERVICE_list_(ctx){
  const source=BXCT_CORE_DATA_clientSource_(ctx.settings),formations=BXCT_FORM_ADMIN_DATA_read_(source);
  return {version:BXCT_FORM_ADMIN_VERSION_,schemaVersion:BXCT_FORM_ADMIN_SCHEMA_,mode:ctx.settings.APP_MODE,mutationTest:BXCT_FORM_ADMIN_AUTH_write_(ctx),formations};
}
function BXCT_FORM_ADMIN_SERVICE_change_(ctx,input){
  if(!BXCT_FORM_ADMIN_AUTH_write_(ctx))throw new Error('ECRITURES_FERMEES');
  const body=BXCT_FORM_ADMIN_VALIDATION_body_(input),source=BXCT_CORE_DATA_clientSource_(ctx.settings);
  return BXCT_FORM_ADMIN_TRANSPORT_send_(ctx,source,body);
}
