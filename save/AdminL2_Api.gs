/**
 * Surface publique LOT 2; retour uniforme {ok,code,message,data}.
 * L'identite est deduite de la session cote serveur, jamais d'un userId client.
 * Aucune de ces API ne touche CLIENT, CONTROL ou des ecritures financieres.
 */
function ADMIN_L2_API_encadrer_(f){
  try{return f();}
  catch(e){
    var code=String(e&&e.code||e&&e.message||'ERREUR_INTERNE');
    var known={MODULE_NON_ACTIF:1,SESSION_INVALIDE:1,ACCES_REFUSE:1,IDENTIFIANT_INVALIDE:1,
      IDENTIFIANT_DEJA_UTILISE:1,NOM_INVALIDE:1,ROLE_INTERDIT:1,CLE_INVALIDE:1,
      ID_INVALIDE:1,STATUT_INVALIDE:1,AUTO_SUSPENSION_INTERDITE:1,UTILISATEUR_ABSENT:1,
      MOT_DE_PASSE_TROP_FAIBLE:1,MOT_DE_PASSE_IDENTIQUE:1,ANCIEN_MDP_INVALIDE:1,
      UTILISER_CHANGEMENT_PERSONNEL:1,DONNEES_INVALIDES:1};
    if(!known[code]){console.error('ADMIN_L2_API_ECHEC',code);code='ERREUR_INTERNE';}
    return ADMIN_L2_CONFIG_result_(false,code,'Opération refusée ou indisponible.');
  }
}
function ADMIN_L2_ETAT(){return ADMIN_L2_API_encadrer_(function(){
  var ss=ADMIN_L2_CONFIG_classeur_(),p=ADMIN_L2_CONFIG_parametres_(ss);
  return ADMIN_L2_CONFIG_result_(true,'ETAT_OK','État du module de gestion.',{
    module_actif:ADMIN_L2_CONFIG_ouvert_(p), version:ADMIN_L2_CONFIG_.VERSION,
    premiere_configuration_terminee:p.BOOTSTRAP_ADMIN_TERMINE==='OUI'
  });
});}
function ADMIN_L2_CONNEXION(identifiant,motDePasse){return ADMIN_L2_API_encadrer_(function(){return ADMIN_L2_AUTH_login_(identifiant,motDePasse);});}
function ADMIN_L2_UTILISATEURS(jeton){return ADMIN_L2_API_encadrer_(function(){return ADMIN_L2_AUTH_executer_(jeton,'LISTER');});}
function ADMIN_L2_CREER_UTILISATEUR(jeton,donnees){return ADMIN_L2_API_encadrer_(function(){return ADMIN_L2_AUTH_executer_(jeton,'CREER',donnees);});}
function ADMIN_L2_CHANGER_STATUT(jeton,id,statut,cle){return ADMIN_L2_API_encadrer_(function(){return ADMIN_L2_AUTH_executer_(jeton,'STATUT',id,statut,cle);});}
function ADMIN_L2_REINITIALISER_MDP(jeton,id,cle){return ADMIN_L2_API_encadrer_(function(){return ADMIN_L2_AUTH_executer_(jeton,'REINITIALISER',id,cle);});}
function ADMIN_L2_CHANGER_MDP(jeton,ancien,nouveau){return ADMIN_L2_API_encadrer_(function(){return ADMIN_L2_AUTH_executer_(jeton,'CHANGER_MDP',ancien,nouveau);});}
function ADMIN_L2_DECONNEXION(jeton){return ADMIN_L2_API_encadrer_(function(){return ADMIN_L2_AUTH_executer_(jeton,'DECONNEXION');});}
