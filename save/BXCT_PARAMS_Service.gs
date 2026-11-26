/** BOXY CONTROL | PARAMETRES | Service metier unique.
 * Depend de: Auth, Validation, Data, Config. Utilise par: API.
 */
function BXCT_PARAMS_SERVICE_vue_(ctx){
 var settings=readControlSettings_(ctx.book);
 var actif=BXCT_LOGIN_CONFIG_authOuverte_(settings);
 return {agents:BXCT_PARAMS_DATA_agents_(ctx.book).map(function(a){return {
  id:a.id,nom:a.nom,identifiant:a.identifiant,role:a.role,actif:a.actif,date:a.date,
  derniereConnexion:a.derniereConnexion,note:a.note,
  motDePasseDefini:!!BXCT_LOGIN_DATA_credential_(ctx.book.getId(),a.id)};}),
  roles:BXCT_PARAMS_DATA_roles_(ctx.book),mode:actif?'LOCAL_PASSWORD':'PREPARATION_INTERNE',loginActif:actif,
  adminMotDePasseDefini:!!BXCT_LOGIN_DATA_credential_(ctx.book.getId(),BXCT_PARAMS_CONFIG_.ADMIN_ID),
  administrateur:ctx.actor,version:BXCT_PARAMS_CONFIG_.VERSION,
  message:actif?'Login BOXY actif. Les permissions de ROLES restent independantes.':
   'Definir le mot de passe admin puis activer le login lorsque vous etes pret.'};
}
function BXCT_PARAMS_SERVICE_lire_(ctx){return BXCT_PARAMS_SERVICE_vue_(ctx);}
function BXCT_PARAMS_SERVICE_initialiser_(ctx){
 var lock=BXCT_PARAMS_AUTH_verrou_();try{
  var admin=BXCT_PARAMS_DATA_initialiserAdmin_(ctx.book,ctx.actor);
  BXCT_PARAMS_DATA_parametresPreparation_(ctx.book);
  return {initialisation:admin,etat:BXCT_PARAMS_SERVICE_vue_(ctx)};
 }finally{lock.releaseLock();}
}
function BXCT_PARAMS_SERVICE_creer_(ctx,payload){
 var roles=BXCT_PARAMS_DATA_roles_(ctx.book).map(function(x){return x.code;});
 var agent=BXCT_PARAMS_VALIDATION_saisie_(payload,roles);
 var lock=BXCT_PARAMS_AUTH_verrou_();try{
  var id=BXCT_PARAMS_DATA_creerAgent_(ctx.book,agent,ctx.actor);
  return {id:id,etat:BXCT_PARAMS_SERVICE_vue_(ctx)};
 }finally{lock.releaseLock();}
}
function BXCT_PARAMS_SERVICE_modifier_(ctx,id,payload){
 var agentId=String(id||'').trim();
 if(!/^AGT-[A-F0-9]{12}$/.test(agentId))throw new Error('AGENT_ID_INVALIDE');
 var roles=BXCT_PARAMS_DATA_roles_(ctx.book).map(function(x){return x.code;});
 var agent=BXCT_PARAMS_VALIDATION_saisie_(payload,roles);
 var lock=BXCT_PARAMS_AUTH_verrou_();try{
  BXCT_PARAMS_DATA_modifierAgent_(ctx.book,agentId,agent,ctx.actor);
  return {id:agentId,etat:BXCT_PARAMS_SERVICE_vue_(ctx)};
 }finally{lock.releaseLock();}
}

/** Definir ou renouveler le secret ADMIN-001 avec authentification Google native du
 * proprietaire, sans activer LOCAL_PASSWORD ni aucun droit metier.
 * Le calcul PBKDF2 precede le verrou pour eviter les longs verrous Apps Script.
 */
function BXCT_PARAMS_SERVICE_motDePasseAdmin_(ctx,password){
 var admin=BXCT_LOGIN_DATA_agentParId_(ctx.book,BXCT_PARAMS_CONFIG_.ADMIN_ID);
 if(!admin||admin.login!==BXCT_PARAMS_CONFIG_.ADMIN_LOGIN||
    admin.role!==BXCT_PARAMS_CONFIG_.ADMIN_ROLE||!admin.active)
   throw new Error('ADMIN_INITIAL_INATTENDU');
 BXCT_LOGIN_CRYPTO_passwordValide_(password);
 var fresh=BXCT_LOGIN_CRYPTO_credential_(password,false);
 var lock=BXCT_PARAMS_AUTH_verrou_();
 try{
  var changed=BXCT_PARAMS_DATA_motDePasseAdmin_(ctx.book,ctx.actor,fresh);
  return {operation:changed.initial?'DEFINI':'REINITIALISE',etat:BXCT_PARAMS_SERVICE_vue_(ctx)};
 }finally{lock.releaseLock();}
}

/** Activation explicite : aucun droit metier n'est cree ni active. */
function BXCT_PARAMS_SERVICE_activerLogin_(ctx){
 var lock=BXCT_PARAMS_AUTH_verrou_();try{
  var status=BXCT_PARAMS_DATA_activerLogin_(ctx.book,ctx.actor);
  return {operation:status,etat:BXCT_PARAMS_SERVICE_vue_(ctx)};
 }finally{lock.releaseLock();}
}
/** Preparation du secret d'un agent deja cree; premiere connexion force le changement. */
function BXCT_PARAMS_SERVICE_motDePasseAgent_(ctx,id,password){
 var agentId=String(id||'').trim();
 if(!/^AGT-[A-F0-9]{12}$/.test(agentId))throw new Error('AGENT_ID_INVALIDE');
 if(!BXCT_LOGIN_DATA_agentParId_(ctx.book,agentId))throw new Error('AGENT_INTROUVABLE');
 BXCT_LOGIN_CRYPTO_passwordValide_(password);
 var fresh=BXCT_LOGIN_CRYPTO_credential_(password,true);
 var lock=BXCT_PARAMS_AUTH_verrou_();try{
  var changed=BXCT_PARAMS_DATA_motDePasseAgent_(ctx.book,ctx.actor,agentId,fresh);
  return {operation:changed.initial?'DEFINI':'REINITIALISE',etat:BXCT_PARAMS_SERVICE_vue_(ctx)};
 }finally{lock.releaseLock();}
}
