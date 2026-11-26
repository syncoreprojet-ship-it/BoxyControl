/**
 * BOXY CONTROL | LOGIN | unique service metier d'authentification.
 * Depend de: CONFIG, CRYPTO, DATA, AUTH, Code.gs.
 * Utilise par: BXCT_LOGIN_Api, BXCT_LOGIN_Setup.
 * Acces navigateur = seulement par BXCT_LOGIN_API_*.
 */
function BXCT_LOGIN_SERVICE_login_(rawLogin,password) {
  var login='__invalide__';
  try{login=BXCT_LOGIN_CONFIG_normaliserLogin_(rawLogin);}catch(e){}
  var secret=(typeof password==='string'&&password.length<=256)?password:'';
  var book=controlWorkbook_(),settings=readControlSettings_(book);
  if(!BXCT_LOGIN_CONFIG_authOuverte_(settings))
    return BXCT_LOGIN_CONFIG_reponse_(false,'LOGIN_NON_INSTALLE');
  var lock=BXCT_LOGIN_AUTH_lock_();
  try{
    if(!BXCT_LOGIN_AUTH_limit_(book.getId(),login))
      return BXCT_LOGIN_CONFIG_reponse_(false,'CONNEXION_REFUSEE');
    var user=login==='__invalide__'?null:BXCT_LOGIN_DATA_agentParLogin_(book,login);
    var cred=user?BXCT_LOGIN_DATA_credential_(book.getId(),user.id):null;
    var ok=false;
    if(cred) {
      try{ok=BXCT_LOGIN_CRYPTO_verifier_(secret,cred);}catch(e){ok=false;}
    }else{
      // Cout semblable pour login inconnu; facilite la resistance a l'enumeration.
      var dummy=Utilities.base64Encode(Array(32).fill(15));
      BXCT_LOGIN_CRYPTO_pbkdf2_(secret,dummy,BXCT_LOGIN_CONFIG_.ITERATIONS);
    }
    if(!ok||!user||!user.active||!user.role){
      BXCT_LOGIN_DATA_journaliser_(book,'CONNEXION','', 'REFUSE','IDENTIFIANTS');
      return BXCT_LOGIN_CONFIG_reponse_(false,'CONNEXION_REFUSEE');
    }
    BXCT_LOGIN_AUTH_rateReset_(book.getId(),login);
    var token=BXCT_LOGIN_AUTH_ouvrirSession_(book,user,cred);
    try{
      BXCT_LOGIN_DATA_journaliser_(book,'CONNEXION',user.id,'OK',cred.mustChange?'MDP_TEMPORAIRE':'SESSION_OUVERTE');
      BXCT_LOGIN_DATA_connexionDate_(book,user.id);
    }catch(e){BXCT_LOGIN_DATA_revoquerSession_(token);throw e;}
    return BXCT_LOGIN_CONFIG_reponse_(true,'CONNEXION_OK',
      {token:token,mustChange:!!cred.mustChange,sessionMinutes:BXCT_LOGIN_CONFIG_.SESSION_MS/60000});
  }finally{lock.releaseLock();}
}
function BXCT_LOGIN_SERVICE_changerMotDePasse_(token,oldPassword,newPassword) {
  BXCT_LOGIN_CRYPTO_passwordValide_(newPassword);
  if(newPassword===oldPassword)throw new Error('NOUVEAU_MDP_IDENTIQUE');
  var lock=BXCT_LOGIN_AUTH_lock_();
  try{
    var identity=BXCT_LOGIN_AUTH_verifierSession_(token,true),book=controlWorkbook_();
    var user=BXCT_LOGIN_DATA_agentParId_(book,identity.agentId);
    var old=BXCT_LOGIN_DATA_credential_(book.getId(),user.id);
    if(!old||!BXCT_LOGIN_CRYPTO_verifier_(String(oldPassword||''),old))
      return BXCT_LOGIN_CONFIG_reponse_(false,'ANCIEN_MDP_INVALIDE');
    var fresh=BXCT_LOGIN_CRYPTO_credential_(newPassword,false);
    BXCT_LOGIN_DATA_enregistrerCredential_(book.getId(),user.id,fresh);
    BXCT_LOGIN_DATA_revoquerAgent_(book.getId(),user.id);
    BXCT_LOGIN_DATA_journaliser_(book,'MOT_DE_PASSE',user.id,'OK','CHANGEMENT_UTILISATEUR');
    var replacement=BXCT_LOGIN_AUTH_ouvrirSession_(book,user,fresh);
    return BXCT_LOGIN_CONFIG_reponse_(true,'MOT_DE_PASSE_MODIFIE',
      {token:replacement,mustChange:false,sessionMinutes:BXCT_LOGIN_CONFIG_.SESSION_MS/60000});
  }finally{lock.releaseLock();}
}
function BXCT_LOGIN_SERVICE_logout_(token) {
  if(typeof token!=='string'||!/^[a-f0-9]{128}$/.test(token))
    return BXCT_LOGIN_CONFIG_reponse_(true,'SESSION_FERMEE');
  var lock=BXCT_LOGIN_AUTH_lock_();
  try{
    var s=BXCT_LOGIN_DATA_lireSession_(token);
    BXCT_LOGIN_DATA_revoquerSession_(token);
    // Pas de lecture du dossier client. Audit sans jeton, sans mot de passe.
    if(s){var book=controlWorkbook_();if(s.bookId===book.getId())
      BXCT_LOGIN_DATA_journaliser_(book,'DECONNEXION',s.agentId,'OK','SESSION_REVOQUEE');}
    return BXCT_LOGIN_CONFIG_reponse_(true,'SESSION_FERMEE');
  }finally{lock.releaseLock();}
}
/** Setup unique, appelle depuis l'editeur du tableur avec UI verifiee. */
function BXCT_LOGIN_SERVICE_initialiserAdmin_(book,password) {
  var lock=BXCT_LOGIN_AUTH_lock_();
  try{
    var sh=BXCT_LOGIN_DATA_grille_(book);
    BXCT_LOGIN_DATA_parametresVerifier_(book);
    if(!book.getSheetByName('ROLES'))throw new Error('ROLES_ABSENTS');
    var existing=BXCT_LOGIN_DATA_agentParLogin_(book,BXCT_LOGIN_CONFIG_.ADMIN_LOGIN);
    var byId=BXCT_LOGIN_DATA_agentParId_(book,BXCT_LOGIN_CONFIG_.ADMIN_ID);
    var cred=BXCT_LOGIN_DATA_credential_(book.getId(),BXCT_LOGIN_CONFIG_.ADMIN_ID);
    if(existing||byId||cred){
      if(existing&&byId&&existing.id===BXCT_LOGIN_CONFIG_.ADMIN_ID&&
         byId.login===BXCT_LOGIN_CONFIG_.ADMIN_LOGIN&&cred&&byId.role===BXCT_LOGIN_CONFIG_.ADMIN_ROLE)
        return {status:'DEJA_INSTALLE',login:BXCT_LOGIN_CONFIG_.ADMIN_LOGIN};
      throw new Error('ADMIN_EXISTANT_VERIFICATION_MANUELLE');
    }
    BXCT_LOGIN_CRYPTO_passwordValide_(password);
    var fresh=BXCT_LOGIN_CRYPTO_credential_(password,true);
    BXCT_LOGIN_DATA_auditTab_(book,true);
    BXCT_LOGIN_DATA_creerAdmin_(book,new Date().toISOString());
    BXCT_LOGIN_DATA_enregistrerCredential_(book.getId(),BXCT_LOGIN_CONFIG_.ADMIN_ID,fresh);
    BXCT_LOGIN_DATA_activerMode_(book);
    BXCT_LOGIN_DATA_journaliser_(book,'INSTALLATION',BXCT_LOGIN_CONFIG_.ADMIN_ID,'OK','PREMIER_ADMIN');
    return {status:'INSTALLE',login:BXCT_LOGIN_CONFIG_.ADMIN_LOGIN};
  }finally{lock.releaseLock();}
}
function BXCT_LOGIN_SERVICE_reinitialiserAdmin_(book,password) {
  var lock=BXCT_LOGIN_AUTH_lock_();
  try{
    var agent=BXCT_LOGIN_DATA_agentParId_(book,BXCT_LOGIN_CONFIG_.ADMIN_ID);
    if(!agent||agent.login!==BXCT_LOGIN_CONFIG_.ADMIN_LOGIN||agent.role!==BXCT_LOGIN_CONFIG_.ADMIN_ROLE)
      throw new Error('ADMIN_INITIAL_INATTENDU');
    var fresh=BXCT_LOGIN_CRYPTO_credential_(password,true);
    BXCT_LOGIN_DATA_enregistrerCredential_(book.getId(),agent.id,fresh);
    BXCT_LOGIN_DATA_revoquerAgent_(book.getId(),agent.id);
    BXCT_LOGIN_DATA_journaliser_(book,'RECUPERATION',agent.id,'OK','PROPRIETAIRE');
    return {status:'SECRET_REINITIALISE'};
  }finally{lock.releaseLock();}
}
