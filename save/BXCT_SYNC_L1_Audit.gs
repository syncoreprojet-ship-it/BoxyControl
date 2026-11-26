/**
 * BOXY CONTROL | SYNC CLIENT | Lot 1/7 - AUDIT SANS ECRITURE
 * API manuelle: BXCT_SYNC_L1_AUDIT_SANS_ECRITURE(), Apps Script editor uniquement.
 * Depend de: BXCT_SYNC_L1_Config.gs.
 * N'utilise jamais la source de production, n'accepte aucun ID depuis le navigateur,
 * n'expose aucun dossier, aucun secret et n'active aucune synchronisation.
 */
function BXCT_SYNC_L1_AUDIT_SANS_ECRITURE() {
  const cfg = BXCT_SYNC_L1_CONFIG_;
  const ctrl = BXCT_SYNC_L1_AUDIT_ouvrirCopie_(cfg.CONTROL_TEST_ID,cfg.CONTROL_TEST_NAME);
  const cli = BXCT_SYNC_L1_AUDIT_ouvrirCopie_(cfg.CLIENT_TEST_ID,cfg.CLIENT_TEST_NAME);
  BXCT_SYNC_L1_AUDIT_proprietaire_(ctrl);
  BXCT_SYNC_L1_AUDIT_proprietaire_(cli);
  const erreurs = [], constat = {};
  BXCT_SYNC_L1_AUDIT_schemas_(ctrl,cfg.CONTROL_SCHEMAS,'CONTROL',erreurs);
  BXCT_SYNC_L1_AUDIT_schemas_(cli,cfg.CLIENT_SCHEMAS,'CLIENT',erreurs);
  const cp = BXCT_SYNC_L1_AUDIT_parametres_(ctrl,'CONTROL',erreurs);
  const bp = BXCT_SYNC_L1_AUDIT_parametres_(cli,'CLIENT',erreurs);
  if(cp.CLIENT_SPREADSHEET_ID!==cfg.CLIENT_TEST_ID) erreurs.push('SOURCE_CLIENT_TEST_INCORRECTE');
  if(cp.APP_MODE!=='PREPARATION'||bp.APP_MODE!=='PREPARATION') erreurs.push('MODE_TEST_NON_FERME');
  if(cp.OPERATIONS_ACTIVES!=='NON'||cp.SYNC_CLIENT_ACTIVE!=='NON'||cp.SYNC_LOT7_AUTORISE!=='NON')
    erreurs.push('CONTROL_ECRITURES_NON_VERROUILLEES');
  if(bp.INSCRIPTIONS_ACTIVES!=='NON'||bp.PUBLIC_LANCEMENT_AUTORISE!=='NON'||bp.CONTROL_SYNC_ACTIVE!=='NON')
    erreurs.push('CLIENT_PUBLIC_NON_VERROUILLE');
  const cs=cli.getSheetByName('BXCL_SYNC5_CONFIG');
  if(cs&&cs.getLastRow()===2){
    const c=cs.getRange(2,1,1,4).getDisplayValues()[0];
    if(c[0]!=='RECEPTION_CONTROL_ACTIVE'||c[1]!=='NON'||c[3]!=='1')erreurs.push('SYNC5_RECEPTION_NON_FERMEE');
  }else erreurs.push('SYNC5_CONFIG_INVALIDE');
  const codes=cli.getSheetByName('CODES_BOXY_CONFIG');
  if(codes&&codes.getLastRow()===2){
    const c=codes.getRange(2,1,1,4).getDisplayValues()[0];
    if(c[0]!=='REATTRIBUTION_CODES_LIBRES'||c[1]!=='NON'||c[3]!=='1')erreurs.push('REATTRIBUTION_TEST_NON_FERMEE');
  }else erreurs.push('CODES_CONFIG_INVALIDE');
  const cat=cli.getSheetByName('PRESTATIONS');
  if(!cat||cat.getLastRow()!==9)erreurs.push('PRESTATIONS_TEST_INCOMPLETES');
  else {
    const r=cat.getRange(2,1,8,8).getDisplayValues();
    if(cfg.PRESTATIONS.some((p,i)=>r[i][0]!==p||r[i][5]!=='NON'||r[i][6]!=='NON'))
      erreurs.push('PRESTATIONS_TEST_NON_CONFORMES');
  }
  constat.schemasControlees=Object.keys(cfg.CONTROL_SCHEMAS).length+Object.keys(cfg.CLIENT_SCHEMAS).length;
  constat.prestationsAttendues=cfg.PRESTATIONS.length;
  constat.classeurs='COPIES_TEST_UNIQUEMENT';
  constat.transportHmac='NON_ACTIVE_PAR_CET_AUDIT';
  constat.mode='PREPARATION';
  constat.donneesPersonnellesLues=false;
  constat.ecritureEffectuee=false;
  const result={ok:erreurs.length===0,code:erreurs.length?'BXCT_SYNC_L1_SCHEMA_A_CORRIGER':'BXCT_SYNC_L1_PRET_POUR_LOT2',
    version:cfg.VERSION,erreurs:erreurs,controle:constat};
  console.log(JSON.stringify(result));
  return result;
}
function BXCT_SYNC_L1_AUDIT_ouvrirCopie_(id,expectedName) {
  const ss=SpreadsheetApp.openById(id);
  if(!ss||ss.getId()!==id||ss.getName()!==expectedName)
    throw new Error('BXCT_SYNC_L1_COPIE_TEST_INVALIDE');
  return ss;
}
function BXCT_SYNC_L1_AUDIT_proprietaire_(ss) {
  const active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  const effective=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
  const owner=ss.getOwner&&ss.getOwner();
  const email=owner&&String(owner.getEmail()||'').trim().toLowerCase();
  if(!active||active!==effective||active!==email)
    throw new Error('BXCT_SYNC_L1_PROPRIETAIRE_REQUIS');
}
function BXCT_SYNC_L1_AUDIT_schemas_(ss,schemas,univers,erreurs) {
  Object.keys(schemas).forEach(function(nom){
    const sh=ss.getSheetByName(nom),headers=schemas[nom];
    if(!sh||sh.getLastRow()<1){erreurs.push(univers+'_ONGLET_ABSENT_'+nom);return;}
    const r=sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
    if(JSON.stringify(r)!==JSON.stringify(headers))erreurs.push(univers+'_ENTETES_'+nom);
  });
}
function BXCT_SYNC_L1_AUDIT_parametres_(ss,univers,erreurs) {
  const sh=ss.getSheetByName('PARAMETRES');
  if(!sh||sh.getLastRow()<1){erreurs.push(univers+'_PARAMETRES_ABSENTS');return {};}
  const rows=sh.getRange(1,1,sh.getLastRow(),2).getDisplayValues();
  if(rows[0][0]!=='cle'||rows[0][1]!=='valeur'){
    erreurs.push(univers+'_PARAMETRES_HEADERS');return {};
  }
  const values={};
  rows.slice(1).forEach(function(r){
    const key=String(r[0]||'').trim();
    if(!key)return;
    if(Object.prototype.hasOwnProperty.call(values,key))erreurs.push(univers+'_PARAMETRE_DOUBLON_'+key);
    else values[key]=String(r[1]||'').trim();
  });
  return values;
}
