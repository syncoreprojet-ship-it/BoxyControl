/**
 * BOXY CONTROL | LOGIN | adaptateur DATA UNIQUE.
 * Depend de: Code.gs/controlWorkbook_, Code.gs/readControlSettings_,
 * BXCT_LOGIN_Config.gs et BXCT_LOGIN_Crypto.gs.
 * Sources de verite: AGENTS (identite, role, actif), PARAMETRES (AUTH_MODE),
 * ROLES (droits historiques); Script Properties BXCT_LOGIN_V1_* (hachages et sessions).
 * Ecritures utilisateurs et journal uniquement via ce module, appele par SERVICE.
 */
function BXCT_LOGIN_DATA_grille_(book) {
  var sh=book.getSheetByName('AGENTS');
  if(!sh)throw new Error('SCHEMA_AGENTS_ABSENT');
  var head=sh.getRange(1,1,1,9).getDisplayValues()[0];
  var expect=['agent_id','nom_affiche','email_ou_identifiant','role','actif','date_creation_utc','derniere_connexion_utc','note_interne','google_sub'];
  if(expect.some(function(k,i){return head[i]!==k;}))throw new Error('SCHEMA_AGENTS_INCOMPATIBLE');
  return sh;
}
function BXCT_LOGIN_DATA_agentParLogin_(book, login) {
  var sh=BXCT_LOGIN_DATA_grille_(book);
  if(sh.getLastRow()<2)return null;
  var rows=sh.getRange(2,1,sh.getLastRow()-1,9).getDisplayValues();
  var matches=rows.filter(function(r){return String(r[2]||'').trim().toLowerCase()===login;});
  if(matches.length>1)throw new Error('IDENTIFIANT_EN_DOUBLE');
  return matches.length?BXCT_LOGIN_DATA_convertAgent_(matches[0]):null;
}
function BXCT_LOGIN_DATA_agentParId_(book, id) {
  var sh=BXCT_LOGIN_DATA_grille_(book);
  if(sh.getLastRow()<2)return null;
  var rows=sh.getRange(2,1,sh.getLastRow()-1,9).getDisplayValues();
  var matches=rows.filter(function(r){return String(r[0]||'').trim()===id;});
  if(matches.length>1)throw new Error('AGENT_ID_EN_DOUBLE');
  return matches.length?BXCT_LOGIN_DATA_convertAgent_(matches[0]):null;
}
function BXCT_LOGIN_DATA_convertAgent_(r) {
  return {id:String(r[0]||'').trim(),name:String(r[1]||'Agent BOXY').trim(),
    login:String(r[2]||'').trim().toLowerCase(),role:String(r[3]||'').trim(),
    active:String(r[4]||'').trim()==='OUI'};
}
function BXCT_LOGIN_DATA_credsCle_(bookId,agentId) {
  return BXCT_LOGIN_CONFIG_.PROP_PREFIX+'C_'+BXCT_LOGIN_CRYPTO_hash_(bookId+'|'+agentId).slice(0,52);
}
function BXCT_LOGIN_DATA_credential_(bookId, agentId) {
  var raw=PropertiesService.getScriptProperties().getProperty(BXCT_LOGIN_DATA_credsCle_(bookId,agentId));
  if(!raw)return null;
  try{return JSON.parse(raw);}catch(e){throw new Error('IDENTIFIANT_CORROMPU');}
}
function BXCT_LOGIN_DATA_enregistrerCredential_(bookId,agentId,creds) {
  PropertiesService.getScriptProperties().setProperty(BXCT_LOGIN_DATA_credsCle_(bookId,agentId),JSON.stringify(creds));
}
function BXCT_LOGIN_DATA_sessionCle_(token) {
  return BXCT_LOGIN_CONFIG_.PROP_PREFIX+'S_'+BXCT_LOGIN_CRYPTO_hash_(token).slice(0,52);
}
function BXCT_LOGIN_DATA_lireSession_(token) {
  var raw=PropertiesService.getScriptProperties().getProperty(BXCT_LOGIN_DATA_sessionCle_(token));
  if(!raw)return null;
  try{return JSON.parse(raw);}catch(e){return null;}
}
function BXCT_LOGIN_DATA_ecrireSession_(token,record) {
  PropertiesService.getScriptProperties().setProperty(BXCT_LOGIN_DATA_sessionCle_(token),JSON.stringify(record));
}
function BXCT_LOGIN_DATA_revoquerSession_(token) {
  PropertiesService.getScriptProperties().deleteProperty(BXCT_LOGIN_DATA_sessionCle_(token));
}
function BXCT_LOGIN_DATA_revoquerAgent_(bookId,agentId) {
  var props=PropertiesService.getScriptProperties(),all=props.getProperties();
  Object.keys(all).filter(function(k){return k.indexOf(BXCT_LOGIN_CONFIG_.PROP_PREFIX+'S_')===0;})
    .forEach(function(k){try{var r=JSON.parse(all[k]);if(r.bookId===bookId&&r.agentId===agentId)props.deleteProperty(k);}catch(e){}});
}
function BXCT_LOGIN_DATA_parametresVerifier_(book) {
  var sh=book.getSheetByName('PARAMETRES');if(!sh)throw new Error('PARAMETRES_ABSENT');
  var h=sh.getRange(1,1,1,4).getDisplayValues()[0];
  if(h.join('|')!=='cle|valeur|description|modifiable')throw new Error('PARAMETRES_SCHEMA_INVALIDE');
  var data=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),2).getDisplayValues(),seen={};
  ['AUTH_MODE','AGENTS_AUTHENTIFIES','AGENTS_PROVISIONNES'].forEach(function(k){
    var hits=data.reduce(function(a,r,i){if(r[0]===k)a.push(i+2);return a;},[]);
    if(hits.length!==1)throw new Error('PARAMETRES_CLE_ABSENTE_OU_DOUBLE');
    seen[k]=hits[0];
  });
  return {sheet:sh,rows:seen};
}
function BXCT_LOGIN_DATA_activerMode_(book) {
  var p=BXCT_LOGIN_DATA_parametresVerifier_(book);
  p.sheet.getRange(p.rows.AUTH_MODE,2).setValue('LOCAL_PASSWORD');
  p.sheet.getRange(p.rows.AGENTS_AUTHENTIFIES,2).setValue('OUI');
  p.sheet.getRange(p.rows.AGENTS_PROVISIONNES,2).setValue('OUI');
}
function BXCT_LOGIN_DATA_creerAdmin_(book, dateUtc) {
  BXCT_LOGIN_DATA_grille_(book).appendRow([
    BXCT_LOGIN_CONFIG_.ADMIN_ID,'Administrateur BOXY',BXCT_LOGIN_CONFIG_.ADMIN_LOGIN,
    BXCT_LOGIN_CONFIG_.ADMIN_ROLE,'OUI',dateUtc,'',
    'Compte initial BOXY CONTROL - connexion locale',''
  ]);
}
/** Migration idempotente du journal de connexion.
 * Ne cree les en-tetes que si create=true ET que la feuille est totalement vide.
 * Tout journal non vide avec un schema different reste protege sans ecrasement.
 */
function BXCT_LOGIN_DATA_auditTab_(book,create) {
  var sh=book.getSheetByName(BXCT_LOGIN_CONFIG_.AUDIT_TAB);
  var head=['date_utc','evenement','agent_id','resultat','code'];
  if(!sh&&create)sh=book.insertSheet(BXCT_LOGIN_CONFIG_.AUDIT_TAB);
  if(!sh)throw new Error('JOURNAL_AUTH_ABSENT');
  // Une feuille creee precedemment mais sans en-tetes est aussi initialisable.
  // getLastRow()=0 confirme l'absence totale de donnees, y compris hors A:E.
  if(create&&sh.getLastRow()===0){
    sh.getRange(1,1,1,5).setValues([head]);
    sh.setFrozenRows(1);
    if(typeof sh.isSheetHidden==='function'){
      if(!sh.isSheetHidden())sh.hideSheet();
    }else sh.hideSheet();
  }
  var actual=sh.getRange(1,1,1,5).getDisplayValues()[0];
  if(head.some(function(k,i){return actual[i]!==k;}))throw new Error('JOURNAL_AUTH_INVALIDE');
  return sh;
}
function BXCT_LOGIN_DATA_journaliser_(book,event,agentId,result,code) {
  var sh=BXCT_LOGIN_DATA_auditTab_(book,false);
  sh.appendRow([new Date().toISOString(),String(event).slice(0,40),
    String(agentId||'').slice(0,50),String(result).slice(0,30),String(code||'').slice(0,70)]);
}
function BXCT_LOGIN_DATA_connexionDate_(book,agentId) {
  var sh=BXCT_LOGIN_DATA_grille_(book),n=sh.getLastRow();
  if(n<2)return;
  var ids=sh.getRange(2,1,n-1,1).getDisplayValues();
  for(var i=0;i<ids.length;i++)if(ids[i][0]===agentId){sh.getRange(i+2,7).setValue(new Date().toISOString());return;}
}
