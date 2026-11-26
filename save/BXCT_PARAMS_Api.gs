/** BOXY CONTROL | PARAMETRES | API pour profils ADMIN_CONTROL uniquement.
 * Chaque appel revalide le jeton local et le role dans AGENTS cote serveur.
 * Le mode initial de preparation conserve la garde proprietaire si login inactif.
 * Les permissions metier ne sont pas modifiees par ce module.
 */
function BXCT_PARAMS_API_etat(token){
 try{return BXCT_PARAMS_CONFIG_retour_(true,'ETAT_OK',BXCT_PARAMS_SERVICE_lire_(BXCT_PARAMS_AUTH_admin_(token)));}
 catch(e){return BXCT_PARAMS_CONFIG_retour_(false,String(e&&e.message||'ACCES_REFUSE'));}
}
function BXCT_PARAMS_API_initialiser(token){
 try{return BXCT_PARAMS_CONFIG_retour_(true,'PREPARATION_PRETE',BXCT_PARAMS_SERVICE_initialiser_(BXCT_PARAMS_AUTH_admin_(token)));}
 catch(e){return BXCT_PARAMS_CONFIG_retour_(false,String(e&&e.message||'ACCES_REFUSE'));}
}
function BXCT_PARAMS_API_creerAgent(token,payload){
 try{return BXCT_PARAMS_CONFIG_retour_(true,'AGENT_CREE',BXCT_PARAMS_SERVICE_creer_(BXCT_PARAMS_AUTH_admin_(token),payload));}
 catch(e){return BXCT_PARAMS_CONFIG_retour_(false,String(e&&e.message||'ACCES_REFUSE'));}
}
function BXCT_PARAMS_API_modifierAgent(token,id,payload){
 try{return BXCT_PARAMS_CONFIG_retour_(true,'AGENT_MODIFIE',BXCT_PARAMS_SERVICE_modifier_(BXCT_PARAMS_AUTH_admin_(token),id,payload));}
 catch(e){return BXCT_PARAMS_CONFIG_retour_(false,String(e&&e.message||'ACCES_REFUSE'));}
}

/** API admin uniquement, le secret n'est jamais logue ni renvoye. */
function BXCT_PARAMS_API_motDePasseAdmin(token,password){
 try{
  var ctx=BXCT_PARAMS_AUTH_admin_(token);
  return BXCT_PARAMS_CONFIG_retour_(true,'ADMIN_MOT_DE_PASSE_MAJ',
    BXCT_PARAMS_SERVICE_motDePasseAdmin_(ctx,password));
 }catch(e){
  var code=String(e&&e.message||'');
  var safe=['MOT_DE_PASSE_TROP_FAIBLE','ADMIN_INITIAL_INATTENDU','PROPRIETAIRE_NON_IDENTIFIE',
    'ACCES_PROPRIETAIRE_UNIQUEMENT','SESSION_INVALIDE','AUTH_NON_ACTIVE',
    'CHANGEMENT_MDP_OBLIGATOIRE','ACCES_ADMIN_UNIQUEMENT','OPERATIONS_OCCUPEES','MOT_DE_PASSE_NON_CONFIRME'];
  return BXCT_PARAMS_CONFIG_retour_(false,safe.indexOf(code)>=0?code:'MOT_DE_PASSE_REFUSE');
 }
}

function BXCT_PARAMS_AUDIT_SANS_ECRITURE(){
 var names=['BXCT_PARAMS_API_etat','BXCT_PARAMS_API_initialiser','BXCT_PARAMS_API_creerAgent',
  'BXCT_PARAMS_API_modifierAgent','BXCT_PARAMS_API_motDePasseAdmin','BXCT_PARAMS_API_motDePasseAgent','BXCT_PARAMS_API_activerLogin','BXCT_PARAMS_AUTH_admin_','BXCT_PARAMS_DATA_creerAgent_'];
 var missing=names.filter(function(n){return typeof globalThis[n]!=='function';});
 var denied=false;try{BXCT_PARAMS_VALIDATION_saisie_({nom:'A',identifiant:'0',role:'ADMIN_CONTROL',actif:true},['ADMIN_CONTROL']);}
 catch(e){denied=true;}
 var out={ok:missing.length===0&&denied,version:BXCT_PARAMS_CONFIG_.VERSION,missing:missing,
  validationServeur:denied,ecritureEffectuee:false,clientModifie:false};
 console.log(JSON.stringify(out));return out;
}

/** API d'activation et de gestion des secrets, strictement reservees aux admins. */
function BXCT_PARAMS_API_motDePasseAgent(token,id,password){
 try{return BXCT_PARAMS_CONFIG_retour_(true,'AGENT_MOT_DE_PASSE_MAJ',
   BXCT_PARAMS_SERVICE_motDePasseAgent_(BXCT_PARAMS_AUTH_admin_(token),id,password));}
 catch(e){var code=String(e&&e.message||'');
  var safe=['MOT_DE_PASSE_TROP_FAIBLE','AGENT_ID_INVALIDE','AGENT_INTROUVABLE',
   'PROPRIETAIRE_NON_IDENTIFIE','ACCES_PROPRIETAIRE_UNIQUEMENT','SESSION_INVALIDE','AUTH_NON_ACTIVE','CHANGEMENT_MDP_OBLIGATOIRE','ACCES_ADMIN_UNIQUEMENT','OPERATIONS_OCCUPEES',
   'MOT_DE_PASSE_NON_CONFIRME'];
  return BXCT_PARAMS_CONFIG_retour_(false,safe.indexOf(code)>=0?code:'MOT_DE_PASSE_REFUSE');}
}
function BXCT_PARAMS_API_activerLogin(token){
 try{return BXCT_PARAMS_CONFIG_retour_(true,'LOGIN_ACTIF',
  BXCT_PARAMS_SERVICE_activerLogin_(BXCT_PARAMS_AUTH_admin_(token)));}
 catch(e){var code=String(e&&e.message||'');
  var safe=['DEFINIR_MOT_DE_PASSE_ADMIN','ADMIN_INITIAL_INATTENDU',
    'MODE_LOGIN_INCOHERENT','JOURNAL_AUTH_INVALIDE','PARAMETRES_CLE_ABSENTE_OU_DOUBLE',
    'PROPRIETAIRE_NON_IDENTIFIE','ACCES_PROPRIETAIRE_UNIQUEMENT','SESSION_INVALIDE','AUTH_NON_ACTIVE','CHANGEMENT_MDP_OBLIGATOIRE','ACCES_ADMIN_UNIQUEMENT','OPERATIONS_OCCUPEES',
    'ACTIVATION_LOGIN_NON_CONFIRMEE'];
  return BXCT_PARAMS_CONFIG_retour_(false,safe.indexOf(code)>=0?code:'ACTIVATION_LOGIN_REFUSEE');}
}
