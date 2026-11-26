/**
 * Setup local, idempotent et non destructif: execution exclusivement depuis
 * l'editeur Apps Script ATTACHE au Google Sheet sous le compte proprietaire.
 * Ces entrees ne doivent pas etre utilisees depuis un Web App.
 */
function ADMIN_L2_SETUP_proprietaireUi_(){
  var ui,active;
  try{ui=SpreadsheetApp.getUi();active=SpreadsheetApp.getActiveSpreadsheet();}
  catch(e){throw ADMIN_L2_CONFIG_erreur_('CONTEXTE_SHEETS_REQUIS');}
  var ss=ADMIN_L2_CONFIG_classeur_();
  if(!active||active.getId()!==ss.getId())throw ADMIN_L2_CONFIG_erreur_('EDITEUR_SHEET_REQUIS');
  var mail=String(Session.getActiveUser().getEmail()||'').toLowerCase();
  var effective=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  var owner='';try{owner=String(DriveApp.getFileById(ss.getId()).getOwner().getEmail()||'').toLowerCase();}
  catch(e){throw ADMIN_L2_CONFIG_erreur_('PROPRIETAIRE_DRIVE_NON_VERIFIE');}
  if(!mail||mail!==effective||mail!==owner)throw ADMIN_L2_CONFIG_erreur_('EXECUTION_PROPRIETAIRE_OBLIGATOIRE');
  return {ui:ui,ss:ss};
}
/** Fonction Apps Script: preparer/calibrer, sans compte cree. */
function ADMIN_L2_TESTER_KDF(){
  var e=ADMIN_L2_SETUP_proprietaireUi_();
  ADMIN_L2_CONFIG_preflight_(e.ss);
  var salt=Utilities.base64Encode(new Array(16).fill(4));
  var vector=ADMIN_L2_CRYPTO_pbkdf2_('password',Utilities.base64Encode(ADMIN_L2_CRYPTO_octets_('salt--1234567890')),1);
  var start=Date.now();ADMIN_L2_CRYPTO_pbkdf2_('Test$1234AbcdZ',salt,ADMIN_L2_CONFIG_.ITERATIONS);
  var elapsed=Date.now()-start;
  var ok=vector==='t8GZHvnfHyE0AeC82Ii66Eeufcp2EF1FU29aLP5hJ8k=';
  // Valeur de reference recalculee par tests Node.js, jamais depuis le navigateur.
  var result={ok:ok&&elapsed<=20000,iterations:ADMIN_L2_CONFIG_.ITERATIONS,
    duree_ms:elapsed,vecteur_ok:ok,decision:ok&&elapsed<=20000?'COMPATIBLE_TEST':'BLOQUE_A_EXAMINER'};
  Logger.log(JSON.stringify(result));return result;
}
/** Fonction Apps Script: schema LOT2 sans suppression de donnees ni activation. */
function ADMIN_L2_PREPARER(){
  var e=ADMIN_L2_SETUP_proprietaireUi_(),p=ADMIN_L2_CONFIG_preflight_(e.ss);
  if(p.BOOTSTRAP_ADMIN_TERMINE==='OUI')return {statut:'DEJA_PREPARE',aucune_mutation:true};
  if(p.BOOTSTRAP_ADMIN_TERMINE!=='NON'||p.APP_MODE!=='PREPARATION')throw new Error('ETAT_INCOMPATIBLE');
  var r=ADMIN_L2_TESTER_KDF();if(!r.ok)throw new Error('KDF_BLOQUE');
  var lock=ADMIN_L2_AUTH_verrou_();
  try{return ADMIN_L2_SERVICE_preparer_(e.ss,r);}finally{lock.releaseLock();}
}
/** Fonction Apps Script: premier SUPER_ADMIN, genere secret aleatoire affiché UNE FOIS. */
function ADMIN_L2_BOOTSTRAP(){
  var e=ADMIN_L2_SETUP_proprietaireUi_(),p=ADMIN_L2_CONFIG_preflight_(e.ss),ui=e.ui;
  if(p.BOOTSTRAP_ADMIN_TERMINE!=='NON'||p.AUTH_ACTIVE!=='NON')throw new Error('BOOTSTRAP_INTERDIT');
  if(Number(p.MOT_DE_PASSE_COUT_KDF)!==ADMIN_L2_CONFIG_.ITERATIONS)throw new Error('PREPARER_LOT2_D_ABORD');
  var login=ui.prompt('BOXY ADMIN - PREMIER SUPER_ADMIN','Identifiant (ex.: admin.boxy) :',ui.ButtonSet.OK_CANCEL);
  if(login.getSelectedButton()!==ui.Button.OK)return {statut:'ANNULE'};
  var nom=ui.prompt('BOXY ADMIN - PREMIER SUPER_ADMIN','Nom affiche :',ui.ButtonSet.OK_CANCEL);
  if(nom.getSelectedButton()!==ui.Button.OK)return {statut:'ANNULE'};
  var lock=ADMIN_L2_AUTH_verrou_(),result;
  try{result=ADMIN_L2_SERVICE_bootstrap_(e.ss,login.getResponseText(),nom.getResponseText());}
  finally{lock.releaseLock();}
  ui.alert('BOXY ADMIN - SECRET TEMPORAIRE A USAGE UNIQUE',
    'Identifiant : '+result.login+'\nSECRET TEMPORAIRE (copiez maintenant) :\n'+result.secret_provisoire+
    '\n\nCe secret ne sera pas reaffiche. Ne le transmettez pas par e-mail ni fichier.',ui.ButtonSet.OK);
  return {statut:'INITIALISE',utilisateur_id:result.utilisateur_id,secret_non_journalise:true};
}
/** Fonction Apps Script: secours du proprietaire apres perte du secret; audit obligatoire. */
function ADMIN_L2_SECOURS_PROPRIETAIRE(){
  var e=ADMIN_L2_SETUP_proprietaireUi_(),ui=e.ui;
  var confirm=ui.alert('REINITIALISATION DU SUPER_ADMIN',
    'Action sensible : revoke toutes les sessions et emet un nouveau secret temporaire. Continuer ?',
    ui.ButtonSet.YES_NO);
  if(confirm!==ui.Button.YES)return {statut:'ANNULE'};
  var lock=ADMIN_L2_AUTH_verrou_(),res;
  try{res=ADMIN_L2_SERVICE_recupererOwner_(e.ss);}finally{lock.releaseLock();}
  ui.alert('SECRET PROVISOIRE A USAGE UNIQUE',res.identifiant+'\n'+res.secret_provisoire+
    '\n\nCopiez maintenant. Il ne sera pas reaffiche.',ui.ButtonSet.OK);
  return {statut:'REINITIALISE',secret_non_journalise:true};
}
/** Fonction Apps Script: audit en lecture seule; jamais de hachages dans le rapport. */
function ADMIN_L2_AUDIT(){
  var e=ADMIN_L2_SETUP_proprietaireUi_(),ss=e.ss,p=ADMIN_L2_CONFIG_preflight_(ss);
  var users=ADMIN_L2_DATA_lignes_(ss,'UTILISATEURS');
  var creds=ADMIN_L2_DATA_lignes_(ss,'IDENTIFIANTS_AUTH');
  var sessions=ADMIN_L2_DATA_lignes_(ss,'SESSIONS_AUTH');
  var ids={},logins={},anomalies=[];
  users.forEach(function(u){if(ids[u.utilisateur_id])anomalies.push('DOUBLON_ID');ids[u.utilisateur_id]=true;
    if(logins[u.identifiant_normalise])anomalies.push('DOUBLON_IDENTIFIANT');logins[u.identifiant_normalise]=true;
    if(!creds.some(function(c){return c.utilisateur_id===u.utilisateur_id;}))anomalies.push('IDENTIFIANT_ORPHELIN');
  });
  creds.forEach(function(c){if(!ids[c.utilisateur_id])anomalies.push('CREDENTIAL_SANS_UTILISATEUR');});
  if(p.BOOTSTRAP_ADMIN_TERMINE==='OUI'&&users.filter(function(u){return u.role_principal==='SUPER_ADMIN';}).length!==1)
    anomalies.push('SUPER_ADMIN_MANQUANT_OU_MULTIPLE');
  var report={version:ADMIN_L2_CONFIG_.VERSION,schemas:'16_ONGLETS',comptes:users.length,
    identifiants_chiffres:creds.length,sessions:sessions.length,
    statut:anomalies.length?'BLOQUE':'OK',anomalies:anomalies,
    controle_reel_exige:'Verifier DriveApp, temps du KDF et restrictions du deploiement'};
  Logger.log(JSON.stringify(report));return report;
}
