/**
 * BOXY CONTROL / Sync Lot 2/7: TEST ONLY, version 7.0.10-rc1.
 * Depends on: BXCT_SYNC_L1_Audit.gs, BXCT_L8_Transport.gs.
 * Used by: BXCT_SYNC_L2_Audit.gs.
 * Distinct Script Properties keep the live CONTROL login and L8 settings intact.
 */
const BXCT_SYNC_L2_CONFIG_ = Object.freeze({
  VERSION:'7.0.10-rc1',
  CLIENT_TEST_ID:'1luxbfMP8RXmc4kGn5a6QVnjUNdiLmYXuNk4qC2wxyJU',
  CONTROL_TEST_ID:'11okNL6OMeAvTn68GW6ktBzoV79vfNEY1Yl29tCdPmQM',
  SECRET_PROPERTY:'BXCT_SYNC_L2_TEST_SECRET',
  URL_PROPERTY:'BXCT_SYNC_L2_TEST_CLIENT_URL',
  ENABLE_PROPERTY:'BXCT_SYNC_L2_TEST_MODE',
  TEST_AGENT:'L2_TEST',
  TEST_PRESTATION:'SHOOTING'
});
/** No business operation and no production workbook are ever opened here. */
function BXCT_SYNC_L2_CONFIG_verifier_(){
  const cfg=BXCT_SYNC_L2_CONFIG_;
  if(typeof BXCT_SYNC_L1_AUDIT_SANS_ECRITURE!=='function'||
     typeof BXCT_L8_TRANSPORT_envoyer_!=='function')
    throw new Error('BXCT_SYNC_L2_DEPENDANCE_MANQUANTE');
  if(BXCT_SYNC_L1_CONFIG_.CLIENT_TEST_ID!==cfg.CLIENT_TEST_ID||
     BXCT_SYNC_L1_CONFIG_.CONTROL_TEST_ID!==cfg.CONTROL_TEST_ID)
    throw new Error('BXCT_SYNC_L2_SOURCE_TEST_INCOHERENTE');
  const report=BXCT_SYNC_L1_AUDIT_SANS_ECRITURE();
  if(!report||report.ok!==true||report.code!=='BXCT_SYNC_L1_PRET_POUR_LOT2')
    throw new Error('BXCT_SYNC_L2_TEST_NON_PRET');
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty(cfg.ENABLE_PROPERTY)!=='OUI')
    throw new Error('BXCT_SYNC_L2_TEST_MODE_INACTIF');
  const secret=String(p.getProperty(cfg.SECRET_PROPERTY)||'');
  const url=String(p.getProperty(cfg.URL_PROPERTY)||'');
  if(!/^[A-Za-z0-9_-]{48,256}$/.test(secret))
    throw new Error('BXCT_SYNC_L2_CLE_INVALIDE');
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{25,}\/exec$/.test(url))
    throw new Error('BXCT_SYNC_L2_URL_TEST_INVALIDE');
  return {secret:secret,url:url};
}
function BXCT_SYNC_L2_CONFIG_contexte_(){
  // Never sourced from browser fields. This fixed synthetic actor has no account.
  return {agentId:BXCT_SYNC_L2_CONFIG_.TEST_AGENT,
    role:'AGENT',droits:['CONSULTER_DEMANDE']};
}
function BXCT_SYNC_L2_CONFIG_filtre_(){
  return {statut:'TOUS',prestation:BXCT_SYNC_L2_CONFIG_.TEST_PRESTATION,
    limite:1,curseur:0};
}
