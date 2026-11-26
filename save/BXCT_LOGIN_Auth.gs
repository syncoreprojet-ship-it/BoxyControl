/**
 * BOXY CONTROL | LOGIN | AUTH + sessions, verification serveur.
 * Depend de: BXCT_LOGIN_Config, BXCT_LOGIN_Crypto, BXCT_LOGIN_Data, Code.gs.
 * Utilise par: BXCT_LOGIN_Service et adaptateur legacy verifyGoogleIdToken_.
 * Toutes les sessions sont absolues, liees au classeur et au mot de passe courant.
 */
function BXCT_LOGIN_AUTH_lock_() {
  var lock=LockService.getScriptLock();lock.waitLock(30000);return lock;
}
function BXCT_LOGIN_AUTH_rateKey_(bookId,login) {
  return BXCT_LOGIN_CONFIG_.PROP_PREFIX+'R_'+BXCT_LOGIN_CRYPTO_hash_(bookId+'|'+login).slice(0,52);
}
/** Nettoyage borne des compteurs et sessions expires, sans toucher aux autres modules. */
function BXCT_LOGIN_AUTH_nettoyer_(props,now) {
  var all=props.getProperties(),prefix=BXCT_LOGIN_CONFIG_.PROP_PREFIX;
  var owned=Object.keys(all).filter(function(k){return k.indexOf(prefix+'R_')===0||k.indexOf(prefix+'S_')===0;});
  if(owned.length<150)return;
  owned.forEach(function(k){
    var r;try{r=JSON.parse(all[k]);}catch(e){props.deleteProperty(k);return;}
    if(k.indexOf(prefix+'R_')===0&&r.until<=now)props.deleteProperty(k);
    if(k.indexOf(prefix+'S_')===0&&r.exp<=now)props.deleteProperty(k);
  });
}
function BXCT_LOGIN_AUTH_limit_(bookId,login) {
  var props=PropertiesService.getScriptProperties(),now=Date.now(),until=now+BXCT_LOGIN_CONFIG_.RATE_WINDOW_MS;
  BXCT_LOGIN_AUTH_nettoyer_(props,now);
  var keys=[{key:BXCT_LOGIN_AUTH_rateKey_(bookId,login),limit:BXCT_LOGIN_CONFIG_.RATE_MAX},
    {key:BXCT_LOGIN_AUTH_rateKey_(bookId,'__GLOBAL__'),limit:BXCT_LOGIN_CONFIG_.GLOBAL_RATE_MAX}];
  var records=keys.map(function(x){var r;try{r=JSON.parse(props.getProperty(x.key)||'{}');}catch(e){r={};}
    if(!r.until||r.until<=now)r={count:0,until:until};return {key:x.key,limit:x.limit,record:r};});
  if(records.some(function(x){return x.record.count>=x.limit;}))return false;
  records.forEach(function(x){x.record.count++;props.setProperty(x.key,JSON.stringify(x.record));});
  return true;
}
function BXCT_LOGIN_AUTH_rateReset_(bookId,login) {
  PropertiesService.getScriptProperties().deleteProperty(BXCT_LOGIN_AUTH_rateKey_(bookId,login));
}
function BXCT_LOGIN_AUTH_ouvrirSession_(book,agent,cred) {
  var token=BXCT_LOGIN_CRYPTO_aleatoire_();
  BXCT_LOGIN_DATA_ecrireSession_(token,{bookId:book.getId(),agentId:agent.id,
    revision:cred.revision,exp:Date.now()+BXCT_LOGIN_CONFIG_.SESSION_MS});
  return token;
}
/** Adapte l'identite existante sans jamais croire le role fourni par le navigateur. */
function BXCT_LOGIN_AUTH_verifierSession_(token,allowMustChange) {
  if(typeof token!=='string'||!/^[a-f0-9]{128}$/.test(token))throw new Error('SESSION_INVALIDE');
  var session=BXCT_LOGIN_DATA_lireSession_(token);
  if(!session||!Number.isFinite(session.exp)||session.exp<=Date.now())throw new Error('SESSION_INVALIDE');
  var book=controlWorkbook_();
  if(session.bookId!==book.getId())throw new Error('SESSION_INVALIDE');
  var settings=readControlSettings_(book);
  if(!BXCT_LOGIN_CONFIG_authOuverte_(settings))throw new Error('AUTH_NON_ACTIVE');
  var agent=BXCT_LOGIN_DATA_agentParId_(book,String(session.agentId||''));
  if(!agent||!agent.active||!agent.role||!agent.login)throw new Error('SESSION_INVALIDE');
  var cred=BXCT_LOGIN_DATA_credential_(book.getId(),agent.id);
  if(!cred||cred.revision!==session.revision)throw new Error('SESSION_INVALIDE');
  if(cred.mustChange&&!allowMustChange)throw new Error('CHANGEMENT_MDP_OBLIGATOIRE');
  return {authMode:'LOCAL_PASSWORD',agentId:agent.id,sub:'BXCT:'+agent.id,
    email:agent.login,login:agent.login,name:agent.name,role:agent.role,
    mustChange:!!cred.mustChange};
}
