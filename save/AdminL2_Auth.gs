/**
 * Authentification privee ADMIN LOT 2, sans deleguer CONTROL (LOT 3).
 * Depend de: CONFIG, CRYPTO, DATA. Services appelants doivent prendre un
 * LockService.getScriptLock() avant toute mutation de session/journal.
 */
function ADMIN_L2_AUTH_verrou_(){
  var l=LockService.getScriptLock();l.waitLock(28000);return l;
}
function ADMIN_L2_AUTH_cleRate_(ident){return 'ADMIN_L2_TENTATIVES_'+ADMIN_L2_CRYPTO_empreinte_(ident).slice(0,40);}
function ADMIN_L2_AUTH_tentatives_(ident,good){
  var props=PropertiesService.getScriptProperties(),key=ADMIN_L2_AUTH_cleRate_(ident);
  var record;try{record=JSON.parse(props.getProperty(key)||'{}');}catch(e){record={};}
  var now=Date.now();if(!record.until||record.until<now)record={count:0,until:now+ADMIN_L2_CONFIG_.LOGIN_WINDOW_MS};
  if(!good&&record.count>=ADMIN_L2_CONFIG_.LOGIN_MAX_ATTEMPTS)return {ok:false,locked:true};
  if(good){props.deleteProperty(key);return {ok:true,locked:false};}
  record.count++;props.setProperty(key,JSON.stringify(record));
  return {ok:false,locked:record.count>=ADMIN_L2_CONFIG_.LOGIN_MAX_ATTEMPTS};
}
function ADMIN_L2_AUTH_globalAutorise_(){
  var ps=PropertiesService.getScriptProperties(),key='ADMIN_L2_LOGIN_VOLUME';
  var record;try{record=JSON.parse(ps.getProperty(key)||'{}');}catch(e){record={};}
  var now=Date.now();if(!record.until||record.until<now)
    record={count:0,until:now+ADMIN_L2_CONFIG_.LOGIN_WINDOW_MS};
  if(record.count>=60)return false; // Protection cout KDF contre rafales d'identifiants distincts.
  record.count++;ps.setProperty(key,JSON.stringify(record));return true;
}
function ADMIN_L2_AUTH_dejaBloque_(ident){
  var raw=PropertiesService.getScriptProperties().getProperty(ADMIN_L2_AUTH_cleRate_(ident));
  if(!raw)return false;
  try{var r=JSON.parse(raw);return r.until>Date.now()&&r.count>=ADMIN_L2_CONFIG_.LOGIN_MAX_ATTEMPTS;}catch(e){return true;}
}
function ADMIN_L2_AUTH_revoquerToutes_(ss,userId){
  return ADMIN_L2_DATA_revoquerSessions_(ss,userId);
}
function ADMIN_L2_AUTH_session_(ss,user){
  var raw=ADMIN_L2_CRYPTO_jeton_(),now=new Date(),ttl=ADMIN_L2_CONFIG_.SESSION_MINUTES;
  ADMIN_L2_DATA_ajouter_(ss,'SESSIONS_AUTH',{
    jeton_empreinte:ADMIN_L2_CRYPTO_empreinte_(raw),utilisateur_id:user.utilisateur_id,
    cree_utc:now.toISOString(),expire_utc:new Date(now.getTime()+ttl*60000).toISOString(),
    derniere_activite_utc:now.toISOString(),revoque_utc:'',statut:'ACTIVE',
    version_permissions:String(user.version),origine_masquee:''
  });
  return raw;
}
function ADMIN_L2_AUTH_sessionVerifier_(ss,token,allowMustChange){
  var s=String(token||'');if(!/^[a-f0-9]{128}$/.test(s))throw ADMIN_L2_CONFIG_erreur_('SESSION_INVALIDE');
  var row=ADMIN_L2_DATA_un_(ss,'SESSIONS_AUTH','jeton_empreinte',ADMIN_L2_CRYPTO_empreinte_(s));
  if(!row||row.statut!=='ACTIVE'||!row.expire_utc||Date.parse(row.expire_utc)<=Date.now())
    throw ADMIN_L2_CONFIG_erreur_('SESSION_INVALIDE');
  var user=ADMIN_L2_DATA_un_(ss,'UTILISATEURS','utilisateur_id',row.utilisateur_id);
  if(!user||user.statut!=='ACTIF'||String(user.version)!==String(row.version_permissions))
    throw ADMIN_L2_CONFIG_erreur_('SESSION_INVALIDE');
  if(user.role_principal!=='SUPER_ADMIN'||(!allowMustChange&&user.doit_changer_mdp==='OUI'))
    throw ADMIN_L2_CONFIG_erreur_('ACCES_REFUSE');
  var p=ADMIN_L2_CONFIG_parametres_(ss);
  if(!ADMIN_L2_CONFIG_ouvert_(p))throw ADMIN_L2_CONFIG_erreur_('MODULE_NON_ACTIF');
  // Expiration absolue; ne pas rendre les sessions immortelles a chaque lecture.
  return {user:user,session:row};
}
function ADMIN_L2_AUTH_login_(login,password){
  var ss=ADMIN_L2_CONFIG_classeur_(),p=ADMIN_L2_CONFIG_preflight_(ss);
  if(!ADMIN_L2_CONFIG_ouvert_(p))throw ADMIN_L2_CONFIG_erreur_('MODULE_NON_ACTIF');
  var ident;try{ident=ADMIN_L2_CRYPTO_identifiant_(login);}catch(e){ident='invalid-credential';}
  if(typeof password!=='string'||password.length>256)password='';
  var lock=ADMIN_L2_AUTH_verrou_();
  try{
    if(!ADMIN_L2_AUTH_globalAutorise_()||ADMIN_L2_AUTH_dejaBloque_(ident))return ADMIN_L2_CONFIG_result_(false,'CONNEXION_REFUSEE','Identifiants incorrects ou accès temporairement bloqué.');
    var user=ADMIN_L2_DATA_un_(ss,'UTILISATEURS','identifiant_normalise',ident);
    var creds=user?ADMIN_L2_DATA_un_(ss,'IDENTIFIANTS_AUTH','utilisateur_id',user.utilisateur_id):null;
    var valid=false;
    if(creds&&creds.statut==='ACTIF'){
      try{valid=ADMIN_L2_CRYPTO_verifier_(password,creds);}catch(e){valid=false;}
    }else{
      // Chemin de calcul egal pour reduire l'enumeration d'identifiants.
      var fakeSalt=Utilities.base64Encode(new Array(32).fill(21));
      ADMIN_L2_CRYPTO_pbkdf2_(password,fakeSalt,ADMIN_L2_CONFIG_.ITERATIONS);
    }
    if(!valid||!user||user.statut!=='ACTIF'||user.role_principal!=='SUPER_ADMIN'){
      ADMIN_L2_AUTH_tentatives_(ident,false);
      ADMIN_L2_DATA_authJournal_(ss,user?user.utilisateur_id:'','ECHEC_CONNEXION','REFUSE',ident);
      return ADMIN_L2_CONFIG_result_(false,'CONNEXION_REFUSEE','Identifiants incorrects ou accès temporairement bloqué.');
    }
    ADMIN_L2_AUTH_tentatives_(ident,true);
    var raw=ADMIN_L2_AUTH_session_(ss,user);
    ADMIN_L2_DATA_authJournal_(ss,user.utilisateur_id,'CONNEXION','AUTORISE',ident);
    return ADMIN_L2_CONFIG_result_(true,'SESSION_OUVERTE','Connexion autorisée.',{
      jeton:raw,utilisateur:{utilisateur_id:user.utilisateur_id,nom_affiche:user.nom_affiche,
        role_principal:user.role_principal,doit_changer_mdp:user.doit_changer_mdp==='OUI'},
      expire_minutes:ADMIN_L2_CONFIG_.SESSION_MINUTES
    });
  }finally{lock.releaseLock();}
}
/** Gardien transactionnel: AUTH > PERMISSIONS > VALIDATION > SERVICE. */
function ADMIN_L2_AUTH_executer_(token,operation,arg1,arg2,arg3){
  var ss=ADMIN_L2_CONFIG_classeur_(),lock=ADMIN_L2_AUTH_verrou_();
  try{
    var special=operation==='CHANGER_MDP'||operation==='DECONNEXION';
    var info=ADMIN_L2_AUTH_sessionVerifier_(ss,token,special),actor=info.user;
    if(!special)ADMIN_L2_PERMISSIONS_comptes_(actor);
    if(operation==='LISTER')return ADMIN_L2_SERVICE_list_(ss,actor);
    if(operation==='CREER')return ADMIN_L2_SERVICE_creer_(ss,actor,ADMIN_L2_VALIDATION_creer_(arg1));
    if(operation==='STATUT')return ADMIN_L2_SERVICE_statut_(ss,actor,
      ADMIN_L2_VALIDATION_id_(arg1),ADMIN_L2_VALIDATION_statut_(arg2),ADMIN_L2_VALIDATION_cle_(arg3));
    if(operation==='REINITIALISER')return ADMIN_L2_SERVICE_reset_(ss,actor,
      ADMIN_L2_VALIDATION_id_(arg1),ADMIN_L2_VALIDATION_cle_(arg2));
    if(operation==='CHANGER_MDP'){
      var pass=ADMIN_L2_VALIDATION_mdp_(arg1,arg2);
      return ADMIN_L2_SERVICE_changerMdp_(ss,actor,pass.ancien,pass.nouveau);
    }
    if(operation==='DECONNEXION')return ADMIN_L2_SERVICE_deconnexion_(ss,actor,info.session);
    throw ADMIN_L2_CONFIG_erreur_('OPERATION_INCONNUE');
  }finally{lock.releaseLock();}
}
