/** BOXY CONTROL | PARAMETRES | Role ADMIN_CONTROL verifie cote serveur.
 * Depend de: LOGIN/Session, AGENTS et Code.gs/controlWorkbook_.
 * AUTH locale active : exige un jeton valide et le role ADMIN_CONTROL actuel.
 * Mode preparation uniquement : conserve la verification historique du proprietaire.
 * Aucune confiance dans le role, l'email ou l'identifiant fournis par l'UI.
 */
function BXCT_PARAMS_AUTH_proprietaire_(){
 return BXCT_CORE_AUTH_proprietaire_();
}

/** Point unique d'autorisation de TOUTES les API Parametres.
 * Si le login est actif, il n'existe AUCUN contournement Google-proprietaire.
 * L'etat du compte et le role sont relus a chaque requete (changement immediat).
 */
function BXCT_PARAMS_AUTH_admin_(token){
 var book=controlWorkbook_();
 var settings=readControlSettings_(book);
 if(!BXCT_LOGIN_CONFIG_authOuverte_(settings)){
  if(token)throw new Error('AUTH_NON_ACTIVE');
  return BXCT_PARAMS_AUTH_proprietaire_();
 }
 var identity=BXCT_LOGIN_AUTH_verifierSession_(token,false);
 var account=BXCT_LOGIN_DATA_agentParId_(book,identity.agentId);
 if(!account||!account.active||account.login!==identity.login||
    account.role!==BXCT_PARAMS_CONFIG_.ADMIN_ROLE)
  throw new Error('ACCES_ADMIN_UNIQUEMENT');
 return {book:book,actor:account.login,agentId:account.id,role:account.role};
}

function BXCT_PARAMS_AUTH_verrou_(){
 var l=LockService.getScriptLock();
 if(!l.tryLock(5000))throw new Error('OPERATIONS_OCCUPEES');
 return l;
}
