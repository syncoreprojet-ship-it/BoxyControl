/** Validations LOT2 : aucune mutation et aucune confiance aux donnees navigateur. */
function ADMIN_L2_VALIDATION_creer_(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw ADMIN_L2_CONFIG_erreur_('DONNEES_INVALIDES');
  var login=ADMIN_L2_CRYPTO_identifiant_(payload.identifiant),nom=String(payload.nom||'').normalize('NFKC').trim();
  if(nom.length<3||nom.length>100||/[\x00-\x1F\x7F]/.test(nom))throw ADMIN_L2_CONFIG_erreur_('NOM_INVALIDE');
  var role=String(payload.role||'').trim();
  if(ADMIN_L2_CONFIG_.ROLES.indexOf(role)<0||role==='SUPER_ADMIN')
    throw ADMIN_L2_CONFIG_erreur_('ROLE_INTERDIT');
  var key=String(payload.cle_idempotence||'');
  if(!/^[a-zA-Z0-9-]{12,80}$/.test(key))throw ADMIN_L2_CONFIG_erreur_('CLE_INVALIDE');
  return {login:login,nom:nom,role:role,cle:key};
}
function ADMIN_L2_VALIDATION_id_(id){var v=String(id||'');if(!/^USR-[0-9a-f-]{36}$/i.test(v))throw ADMIN_L2_CONFIG_erreur_('ID_INVALIDE');return v;}
function ADMIN_L2_VALIDATION_cle_(v){var k=String(v||'');if(!/^[a-zA-Z0-9-]{12,80}$/.test(k))throw ADMIN_L2_CONFIG_erreur_('CLE_INVALIDE');return k;}
function ADMIN_L2_VALIDATION_statut_(v){if(v!=='ACTIF'&&v!=='SUSPENDU')throw ADMIN_L2_CONFIG_erreur_('STATUT_INVALIDE');return v;}

function ADMIN_L2_VALIDATION_mdp_(oldPass,newPass){
  ADMIN_L2_CRYPTO_passwordValide_(newPass);
  if(typeof oldPass!=='string'||oldPass.length>256)throw ADMIN_L2_CONFIG_erreur_('ANCIEN_MDP_INVALIDE');
  return {ancien:oldPass,nouveau:newPass};
}
