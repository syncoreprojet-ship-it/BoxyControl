/**
 * Service metier UNIQUE d'ecriture des comptes utilisateurs ADMIN.
 * Depend de: CRYPTO, DATA, CONFIG. Auth et permissions sont verifies
 * en amont par le gardien AUTH, sous verrou. Utilise par: AUTH et SETUP prive.
 * Les donnees de paiement, roles CONTROL et inscriptions restent intouchables.
 */
function ADMIN_L2_SERVICE_exposer_(u){return {
  utilisateur_id:u.utilisateur_id,identifiant:u.identifiant_normalise,nom:u.nom_affiche,
  role:u.role_principal,statut:u.statut,cree_utc:u.cree_utc,
  doit_changer_mdp:u.doit_changer_mdp==='OUI',version:Number(u.version)||1
};}
function ADMIN_L2_SERVICE_list_(ss,actor){
  var all=ADMIN_L2_DATA_lignes_(ss,'UTILISATEURS').map(ADMIN_L2_SERVICE_exposer_);
  return ADMIN_L2_CONFIG_result_(true,'UTILISATEURS_OK','Répertoire chargé.',{
    utilisateurs:all,roles:ADMIN_L2_CONFIG_.ROLES.filter(function(r){return r!=='SUPER_ADMIN';})
  });
}
function ADMIN_L2_SERVICE_creer_(ss,actor,input){
    if(ADMIN_L2_DATA_un_(ss,'AUDIT_ADMIN','cle_idempotence',input.cle))
      return ADMIN_L2_CONFIG_result_(true,'DEJA_TRAITE','Requête déjà traitée; secret provisoire non réaffiché.',{secret_disponible:false});
    if(ADMIN_L2_DATA_un_(ss,'UTILISATEURS','identifiant_normalise',input.login))
      throw ADMIN_L2_CONFIG_erreur_('IDENTIFIANT_DEJA_UTILISE');
    var now=ADMIN_L2_CONFIG_utc_(),id='USR-'+Utilities.getUuid(),pass=ADMIN_L2_CRYPTO_secretProvisoire_();
    var hash=ADMIN_L2_CRYPTO_hash_(pass);
    ADMIN_L2_DATA_ajouter_(ss,'UTILISATEURS',{
      utilisateur_id:id,identifiant_normalise:input.login,nom_affiche:input.nom,
      role_principal:input.role,statut:'ACTIF',cree_utc:now,cree_par:actor.utilisateur_id,
      maj_utc:now,doit_changer_mdp:'OUI',version:'1',note_interne:''
    });
    ADMIN_L2_DATA_ajouter_(ss,'IDENTIFIANTS_AUTH',{
      utilisateur_id:id,algorithme:hash.algorithme,sel_b64:hash.sel_b64,
      hachage_b64:hash.hachage_b64,parametres_kdf_json:hash.parametres_kdf_json,
      version_mdp:'1',cree_utc:now,change_utc:now,reinitialisation_requise:'OUI',statut:'ACTIF'
    });
    ADMIN_L2_DATA_audit_(ss,'CREATION_COMPTE','UTILISATEUR',id,actor.utilisateur_id,'1',input.cle,{role:input.role});
    ADMIN_L2_DATA_authJournal_(ss,id,'COMPTE_CREE','OK',input.login);
    return ADMIN_L2_CONFIG_result_(true,'UTILISATEUR_CREE','Compte créé; communiquez le secret provisoire en privé.',{
      utilisateur:ADMIN_L2_SERVICE_exposer_({utilisateur_id:id,identifiant_normalise:input.login,
        nom_affiche:input.nom,role_principal:input.role,statut:'ACTIF',cree_utc:now,doit_changer_mdp:'OUI',version:'1'}),
      secret_provisoire:pass,secret_disponible:true
    });
}
function ADMIN_L2_SERVICE_statut_(ss,actor,userId,status,key){
    if(ADMIN_L2_DATA_un_(ss,'AUDIT_ADMIN','cle_idempotence',key))
      return ADMIN_L2_CONFIG_result_(true,'DEJA_TRAITE','Action déjà appliquée.');
    var row=ADMIN_L2_DATA_un_(ss,'UTILISATEURS','utilisateur_id',userId);
    if(!row)throw ADMIN_L2_CONFIG_erreur_('UTILISATEUR_ABSENT');
    if(row.utilisateur_id===actor.utilisateur_id&&status==='SUSPENDU')
      throw ADMIN_L2_CONFIG_erreur_('AUTO_SUSPENSION_INTERDITE');
    if(row.statut===status)return ADMIN_L2_CONFIG_result_(true,'ETAT_IDENTIQUE','Compte déjà dans cet état.');
    var vers=Number(row.version)+1;
    ADMIN_L2_DATA_modifier_(ss,'UTILISATEURS',row._ligne,{statut:status,maj_utc:ADMIN_L2_CONFIG_utc_(),version:String(vers)});
    ADMIN_L2_DATA_revoquerSessions_(ss,userId);
    ADMIN_L2_DATA_audit_(ss,'STATUT_'+status,'UTILISATEUR',userId,actor.utilisateur_id,String(vers),key,{statut:status});
    ADMIN_L2_DATA_authJournal_(ss,userId,'STATUT_'+status,'OK',row.identifiant_normalise);
    return ADMIN_L2_CONFIG_result_(true,'STATUT_MODIFIE','Statut mis à jour.');
}
function ADMIN_L2_SERVICE_reset_(ss,actor,userId,key){
    if(ADMIN_L2_DATA_un_(ss,'AUDIT_ADMIN','cle_idempotence',key))
      return ADMIN_L2_CONFIG_result_(true,'DEJA_TRAITE','Déjà traité; secret non réaffiché.',{secret_disponible:false});
    var target=ADMIN_L2_DATA_un_(ss,'UTILISATEURS','utilisateur_id',userId),creds=ADMIN_L2_DATA_un_(ss,'IDENTIFIANTS_AUTH','utilisateur_id',userId);
    if(!target||!creds)throw ADMIN_L2_CONFIG_erreur_('UTILISATEUR_ABSENT');
    if(target.utilisateur_id===actor.utilisateur_id)
      throw ADMIN_L2_CONFIG_erreur_('UTILISER_CHANGEMENT_PERSONNEL');
    var pass=ADMIN_L2_CRYPTO_secretProvisoire_(),hash=ADMIN_L2_CRYPTO_hash_(pass);
    var vers=Number(target.version)+1,passVers=Number(creds.version_mdp)+1,now=ADMIN_L2_CONFIG_utc_();
    ADMIN_L2_DATA_modifier_(ss,'IDENTIFIANTS_AUTH',creds._ligne,{
      algorithme:hash.algorithme,sel_b64:hash.sel_b64,hachage_b64:hash.hachage_b64,
      parametres_kdf_json:hash.parametres_kdf_json,version_mdp:String(passVers),change_utc:now,
      reinitialisation_requise:'OUI',statut:'ACTIF'
    });
    ADMIN_L2_DATA_modifier_(ss,'UTILISATEURS',target._ligne,{doit_changer_mdp:'OUI',maj_utc:now,version:String(vers)});
    ADMIN_L2_DATA_revoquerSessions_(ss,userId);
    ADMIN_L2_DATA_audit_(ss,'REINITIALISATION_MDP','UTILISATEUR',userId,actor.utilisateur_id,String(vers),key,{sessions_revoquees:true});
    ADMIN_L2_DATA_authJournal_(ss,userId,'REINITIALISATION_MDP','OK',target.identifiant_normalise);
    return ADMIN_L2_CONFIG_result_(true,'MOT_DE_PASSE_REINITIALISE','Secret provisoire généré une seule fois.',{secret_provisoire:pass,secret_disponible:true});
}
function ADMIN_L2_SERVICE_changerMdp_(ss,actor,oldPass,newPass){
    var creds=ADMIN_L2_DATA_un_(ss,'IDENTIFIANTS_AUTH','utilisateur_id',actor.utilisateur_id);
    if(!creds||!ADMIN_L2_CRYPTO_verifier_(oldPass,creds))
      throw ADMIN_L2_CONFIG_erreur_('ANCIEN_MDP_INVALIDE');
    if(ADMIN_L2_CRYPTO_equals_(oldPass,newPass))throw ADMIN_L2_CONFIG_erreur_('MOT_DE_PASSE_IDENTIQUE');
    var hash=ADMIN_L2_CRYPTO_hash_(newPass),vers=Number(actor.version)+1,now=ADMIN_L2_CONFIG_utc_();
    ADMIN_L2_DATA_modifier_(ss,'IDENTIFIANTS_AUTH',creds._ligne,{
      algorithme:hash.algorithme,sel_b64:hash.sel_b64,hachage_b64:hash.hachage_b64,
      parametres_kdf_json:hash.parametres_kdf_json,version_mdp:String(Number(creds.version_mdp)+1),
      change_utc:now,reinitialisation_requise:'NON',statut:'ACTIF'
    });
    ADMIN_L2_DATA_modifier_(ss,'UTILISATEURS',actor._ligne,{doit_changer_mdp:'NON',version:String(vers),maj_utc:now});
    ADMIN_L2_DATA_revoquerSessions_(ss,actor.utilisateur_id);
    ADMIN_L2_DATA_audit_(ss,'CHANGEMENT_MDP','UTILISATEUR',actor.utilisateur_id,actor.utilisateur_id,String(vers),'',{});
    ADMIN_L2_DATA_authJournal_(ss,actor.utilisateur_id,'CHANGEMENT_MDP','OK',actor.identifiant_normalise);
    return ADMIN_L2_CONFIG_result_(true,'MOT_DE_PASSE_CHANGE','Mot de passe modifié. Reconnectez-vous.');
}
function ADMIN_L2_SERVICE_deconnexion_(ss,actor,session){
    ADMIN_L2_DATA_modifier_(ss,'SESSIONS_AUTH',session._ligne,{
      statut:'REVOQUEE',revoque_utc:ADMIN_L2_CONFIG_utc_()
    });
    ADMIN_L2_DATA_authJournal_(ss,actor.utilisateur_id,'DECONNEXION','OK',actor.identifiant_normalise);
    return ADMIN_L2_CONFIG_result_(true,'DECONNEXION_OK','Session fermée.');
}
/** Bootstrap et recuperation du proprietaire : mutations toujours dans ce service. */
function ADMIN_L2_SERVICE_bootstrap_(ss,login,nom){
    var p=ADMIN_L2_CONFIG_preflight_(ss);
    if(p.APP_MODE!=='PREPARATION'||p.BOOTSTRAP_ADMIN_TERMINE!=='NON'||p.AUTH_ACTIVE!=='NON'
      ||p.UTILISATEURS_ECRITURE_ACTIVE!=='NON'||p.AUTH_ALLOW_NEW_SESSIONS!=='NON')
      throw ADMIN_L2_CONFIG_erreur_('BOOTSTRAP_ETAT_INCOMPATIBLE');
    if(Number(p.MOT_DE_PASSE_COUT_KDF)!==ADMIN_L2_CONFIG_.ITERATIONS)
      throw ADMIN_L2_CONFIG_erreur_('KDF_NON_CONFIGURE');
    if(ADMIN_L2_DATA_lignes_(ss,'UTILISATEURS').length||ADMIN_L2_DATA_lignes_(ss,'IDENTIFIANTS_AUTH').length)
      throw ADMIN_L2_CONFIG_erreur_('BOOTSTRAP_DEJA_LANCE');
    login=ADMIN_L2_CRYPTO_identifiant_(login);
    nom=String(nom||'').trim();if(nom.length<3||nom.length>100)throw ADMIN_L2_CONFIG_erreur_('NOM_INVALIDE');
    var now=ADMIN_L2_CONFIG_utc_(),id='USR-'+Utilities.getUuid(),pass=ADMIN_L2_CRYPTO_secretProvisoire_(),hash=ADMIN_L2_CRYPTO_hash_(pass);
    ADMIN_L2_DATA_ajouter_(ss,'UTILISATEURS',{
      utilisateur_id:id,identifiant_normalise:login,nom_affiche:nom,role_principal:'SUPER_ADMIN',
      statut:'ACTIF',cree_utc:now,cree_par:'PROPRIETAIRE_SCRIPT',maj_utc:now,
      doit_changer_mdp:'OUI',version:'1',note_interne:''
    });
    ADMIN_L2_DATA_ajouter_(ss,'IDENTIFIANTS_AUTH',{
      utilisateur_id:id,algorithme:hash.algorithme,sel_b64:hash.sel_b64,
      hachage_b64:hash.hachage_b64,parametres_kdf_json:hash.parametres_kdf_json,
      version_mdp:'1',cree_utc:now,change_utc:now,reinitialisation_requise:'OUI',statut:'ACTIF'
    });
    ADMIN_L2_DATA_audit_(ss,'BOOTSTRAP_UNIQUE','UTILISATEUR',id,'PROPRIETAIRE_SCRIPT','1','BOOTSTRAP_LOT2',{role:'SUPER_ADMIN'});
    ADMIN_L2_DATA_authJournal_(ss,id,'BOOTSTRAP','OK',login);
    // Le module n'est ouvert qu'apres identite, hash et audit confirmes.
    ADMIN_L2_DATA_paramMaj_(ss,'BOOTSTRAP_ADMIN_TERMINE','OUI');
    ADMIN_L2_DATA_paramMaj_(ss,'AUTH_ACTIVE','OUI');
    ADMIN_L2_DATA_paramMaj_(ss,'UTILISATEURS_ECRITURE_ACTIVE','OUI');
    ADMIN_L2_DATA_paramMaj_(ss,'AUTH_ALLOW_NEW_SESSIONS','OUI');
    return {utilisateur_id:id,login:login,secret_provisoire:pass};
}
function ADMIN_L2_SERVICE_recupererOwner_(ss){
    var p=ADMIN_L2_CONFIG_preflight_(ss);
    if(p.BOOTSTRAP_ADMIN_TERMINE!=='OUI')throw ADMIN_L2_CONFIG_erreur_('AUCUN_ADMIN');
    var all=ADMIN_L2_DATA_lignes_(ss,'UTILISATEURS').filter(function(u){return u.role_principal==='SUPER_ADMIN';});
    if(all.length!==1)throw ADMIN_L2_CONFIG_erreur_('ADMINS_AMBIGUS');
    var u=all[0],cred=ADMIN_L2_DATA_un_(ss,'IDENTIFIANTS_AUTH','utilisateur_id',u.utilisateur_id);
    if(!cred)throw ADMIN_L2_CONFIG_erreur_('CREDENTIAL_ABSENT');
    var pass=ADMIN_L2_CRYPTO_secretProvisoire_(),hash=ADMIN_L2_CRYPTO_hash_(pass),now=ADMIN_L2_CONFIG_utc_();
    var vers=Number(u.version)+1;
    ADMIN_L2_DATA_modifier_(ss,'IDENTIFIANTS_AUTH',cred._ligne,{
      algorithme:hash.algorithme,sel_b64:hash.sel_b64,hachage_b64:hash.hachage_b64,
      parametres_kdf_json:hash.parametres_kdf_json,version_mdp:String(Number(cred.version_mdp)+1),
      change_utc:now,reinitialisation_requise:'OUI',statut:'ACTIF'
    });
    ADMIN_L2_DATA_modifier_(ss,'UTILISATEURS',u._ligne,{
      statut:'ACTIF',doit_changer_mdp:'OUI',maj_utc:now,version:String(vers)
    });
    ADMIN_L2_DATA_revoquerSessions_(ss,u.utilisateur_id);
    ADMIN_L2_DATA_audit_(ss,'SECOURS_PROPRIETAIRE','UTILISATEUR',u.utilisateur_id,'PROPRIETAIRE_SCRIPT',String(vers),'',{reinitialisation:true});
    ADMIN_L2_DATA_authJournal_(ss,u.utilisateur_id,'SECOURS_PROPRIETAIRE','OK',u.identifiant_normalise);
    return {identifiant:u.identifiant_normalise,secret_provisoire:pass};
}

/** Migrations LOT2 centralisees dans le service; idempotentes, pas d'entete modifie. */
function ADMIN_L2_SERVICE_preparer_(ss,benchmark){
    var p=ADMIN_L2_CONFIG_preflight_(ss);
    if(p.BOOTSTRAP_ADMIN_TERMINE==='OUI')return {statut:'DEJA_PREPARE',aucune_mutation:true};
    if(p.BOOTSTRAP_ADMIN_TERMINE!=='NON'||p.APP_MODE!=='PREPARATION')
      throw ADMIN_L2_CONFIG_erreur_('ETAT_INCOMPATIBLE');
    if(!benchmark||benchmark.ok!==true||benchmark.iterations!==ADMIN_L2_CONFIG_.ITERATIONS)
      throw ADMIN_L2_CONFIG_erreur_('KDF_BLOQUE');
    var rows=ADMIN_L2_DATA_lignes_(ss,'PARAMETRES');
    var schema=rows.filter(function(x){return x.cle==='SCHEMA_VERSION';});
    if(schema.length>1)throw ADMIN_L2_CONFIG_erreur_('SCHEMA_VERSION_DUPLIQUE');
    if(!schema.length){ADMIN_L2_DATA_ajouter_(ss,'PARAMETRES',{
      cle:'SCHEMA_VERSION',valeur:ADMIN_L2_CONFIG_.SCHEMA_VERSION,
      description:'Version schema ADMIN LOT2, sans suppression LOT1',modifiable:'NON'
    });}else{ADMIN_L2_DATA_paramMaj_(ss,'SCHEMA_VERSION',ADMIN_L2_CONFIG_.SCHEMA_VERSION);}
    ADMIN_L2_DATA_paramMaj_(ss,'MOT_DE_PASSE_COUT_KDF',String(ADMIN_L2_CONFIG_.ITERATIONS));
    ADMIN_L2_DATA_paramMaj_(ss,'APP_VERSION',ADMIN_L2_CONFIG_.VERSION);
    var lot=ADMIN_L2_DATA_un_(ss,'PLAN_LOTS_ADMIN','lot','2');
    if(lot)ADMIN_L2_DATA_modifier_(ss,'PLAN_LOTS_ADMIN',lot._ligne,{statut:'EN_TEST'});
    return {statut:'PRET_A_INITIALISER',schema_version:ADMIN_L2_CONFIG_.SCHEMA_VERSION,
      kdf:benchmark,aucun_compte_cree:true};
}
