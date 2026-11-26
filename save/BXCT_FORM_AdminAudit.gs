/** Diagnostic propriétaire, aucune modification, ne renvoie pas de données nominatives. */
function BXCT_FORM_ADMIN_AUDIT(){
  const book=BXCT_CORE_AUTH_proprietaire_().book,settings=readControlSettings_(book);
  const test=PropertiesService.getScriptProperties().getProperty('CONTROL_USE_TEST_SHEET')==='OUI';
  if(!['TEST','PRODUCTION'].includes(settings.APP_MODE)||(settings.APP_MODE==='TEST')!==test||settings.ACADEMIE_SOURCE!=='CLIENT_SEUL')throw new Error('ENVIRONNEMENT_INCOHERENT');
  const source=BXCT_CORE_DATA_clientSource_(settings),rows=BXCT_FORM_ADMIN_DATA_read_(source);
  const journal=BXCT_FORM_ADMIN_DATA_audit_(source);
  const out={ok:rows.some(r=>r.code==='CREATION_CONTENU')&&journal.anomalies===0,version:BXCT_FORM_ADMIN_VERSION_,schemaVersion:BXCT_FORM_ADMIN_SCHEMA_,mode:settings.APP_MODE,formations:rows.length,configurationVitrine:rows.filter(r=>['OUI','NON'].includes(r.visibleVitrine)).length,schemaVitrineInstalle:source.getSheetByName('FORMATIONS_ACADEMIE').getLastColumn()===17,parcoursHistorique:rows.some(r=>r.code==='CREATION_CONTENU'),journal,ecritureProduction:false};
  Logger.log(JSON.stringify(out));return out;
}
