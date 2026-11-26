/**
 * BOXY CONTROL | LOGIN | API navigateur stable.
 * UI -> API -> AUTH -> VALIDATION -> SERVICE -> DATA.
 * Depend de: BXCT_LOGIN_Service + Code.gs/controlBootstrap.
 */
function BXCT_LOGIN_API_ouvrir(login,password) {
  var token=null;
  try {
    var r=BXCT_LOGIN_SERVICE_login_(login,password);
    if(!r.ok)return r;
    token=r.data.token;
    if(!r.data.mustChange)r.data.bootstrap=controlBootstrap(token);
    return r;
  }catch(e){
    if(token)try{BXCT_LOGIN_DATA_revoquerSession_(token);}catch(ignore){}
    return BXCT_LOGIN_CONFIG_reponse_(false,'CONNEXION_REFUSEE');
  }
}
function BXCT_LOGIN_API_changerMotDePasse(token,oldPassword,newPassword) {
  var replacement=null;
  try {
    var r=BXCT_LOGIN_SERVICE_changerMotDePasse_(token,oldPassword,newPassword);
    if(r.ok){replacement=r.data.token;r.data.bootstrap=controlBootstrap(replacement);}
    return r;
  }catch(e){
    if(replacement)try{BXCT_LOGIN_DATA_revoquerSession_(replacement);}catch(ignore){}
    var safe=['MOT_DE_PASSE_TROP_FAIBLE','NOUVEAU_MDP_IDENTIQUE','ANCIEN_MDP_INVALIDE'];
    var code=String(e&&e.message||'');
    return BXCT_LOGIN_CONFIG_reponse_(false,safe.indexOf(code)>=0?code:'CHANGEMENT_REFUSE');
  }
}
function BXCT_LOGIN_API_fermer(token) {
  try{return BXCT_LOGIN_SERVICE_logout_(token);}
  catch(e){return BXCT_LOGIN_CONFIG_reponse_(false,'DECONNEXION_INCERTAINE');}
}
