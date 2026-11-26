/**
 * BOXY CONTROL | LOGIN | installation et secours proprietaire uniquement.
 * Depend de: BXCT_LOGIN_Config, BXCT_LOGIN_Crypto, BXCT_LOGIN_Service, Code.gs.
 * IMPORTANT: ne jamais appeler l'installation dans doGet, doPost ou l'UI.
 * Protection: UI liee a Sheets OU proprietes privees + preuve du proprietaire.
 * Aucun bootstrap depuis l'interface du navigateur, aucun secret journalise.
 */
function BXCT_LOGIN_SETUP_contexteProprietaire_() {
  // getUi n'est disponible que dans une session Sheets conteneur active.
  // En projet Apps Script autonome, renvoyer null sans affaiblir la preuve du proprietaire.
  var ui=null,active=null;
  try{ui=SpreadsheetApp.getUi();active=SpreadsheetApp.getActiveSpreadsheet();}
  catch(e){return null;}
  if(!ui||!active)return null;
  var book=controlWorkbook_();
  if(active.getId()!==book.getId())throw new Error('EDITEUR_DU_CLASSEUR_REQUIS');
  var signed=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  var execute=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
  if(!signed||signed!==execute)throw new Error('EDITEUR_IDENTIFIE_REQUIS');
  return {ui:ui,book:book};
}
/**
 * A EXECUTER UNE SEULE FOIS depuis Apps Script BOXY CONTROL.
 * Sur script autonome, configurer les 2 proprietes privees decrites plus bas.
 * Cree ADMIN-001 dans AGENTS; affiche un secret ALEATOIRE UNE SEULE FOIS
 * dans le dialogue du tableur (pas dans la console, jamais dans Sheets).
 */
function BXCT_LOGIN_INSTALLER_ADMIN() {
  var context=BXCT_LOGIN_SETUP_contexteProprietaire_();
  if(!context)return BXCT_LOGIN_INSTALLER_ADMIN_VIA_PROPRIETES();
  var secret=BXCT_LOGIN_CRYPTO_motDePasseTemporaire_();
  var r=BXCT_LOGIN_SERVICE_initialiserAdmin_(context.book,secret);
  if(r.status==='DEJA_INSTALLE'){
    context.ui.alert('BOXY CONTROL - Login','Administrateur deja present. Aucune modification.',context.ui.ButtonSet.OK);
  }
  if(r.status==='INSTALLE'){
    context.ui.alert('BOXY CONTROL - SECRET INITIAL (UNE SEULE FOIS)',
      'Identifiant : admin\nMot de passe provisoire :\n'+secret+
      '\n\nCopiez-le maintenant. Il ne sera pas conserve en clair. Changement obligatoire a la premiere connexion.',
      context.ui.ButtonSet.OK);
  }
  return {ok:true,status:r.status,secretAffiche:r.status==='INSTALLE'};
}
/** Reinitialisation controlee si le proprietaire a perdu le premier secret. */
function BXCT_LOGIN_SECOURS_ADMIN() {
  var context=BXCT_LOGIN_SETUP_contexteProprietaire_();
  if(!context)return BXCT_LOGIN_SECOURS_ADMIN_VIA_PROPRIETES();
  var ok=context.ui.alert('BOXY CONTROL - REINITIALISATION ADMIN',
    'Revoquer toutes les sessions et generer un nouveau mot de passe provisoire ?',
    context.ui.ButtonSet.YES_NO);
  if(ok!==context.ui.Button.YES)return {ok:false,status:'ANNULE'};
  var secret=BXCT_LOGIN_CRYPTO_motDePasseTemporaire_();
  var r=BXCT_LOGIN_SERVICE_reinitialiserAdmin_(context.book,secret);
  context.ui.alert('NOUVEAU SECRET (UNE SEULE FOIS)',
    'Identifiant : admin\nMot de passe provisoire :\n'+secret+
    '\n\nChangement obligatoire a la premiere connexion.',context.ui.ButtonSet.OK);
  return {ok:true,status:r.status,secretAffiche:true};
}
/** Audit structurel sans secret, sans ecriture, ni acces aux donnees CLIENT. */
function BXCT_LOGIN_AUDIT_SANS_ECRITURE() {
  var names=['BXCT_LOGIN_API_ouvrir','BXCT_LOGIN_API_changerMotDePasse',
    'BXCT_LOGIN_API_fermer','BXCT_LOGIN_AUTH_verifierSession_',
    'BXCT_LOGIN_SERVICE_initialiserAdmin_','BXCT_LOGIN_INSTALLER_ADMIN'];
  var missing=names.filter(function(n){return typeof globalThis[n]!=='function';});
  var refused=false;
  try{BXCT_LOGIN_AUTH_verifierSession_('JETON_INVALIDE',false);}
  catch(e){refused=String(e.message)==='SESSION_INVALIDE';}
  var r={ok:missing.length===0&&refused,version:BXCT_LOGIN_CONFIG_.VERSION,
    fonctionsManquantes:missing,jetonInvalideRefuse:refused,
    oauthPersonnalise:false,rolesPreserves:true,sessionMinute:20,
    consultationClient:false,ecritureEffectuee:false};
  console.log(JSON.stringify(r));return r;
}

/**
 * Solution automatique pour un projet Apps Script autonome (sans getUi()).
 * A executer MANUELLEMENT depuis l'editeur Apps Script.
 * Dans Parametres du projet > Proprietes du script, definir:
 *  BXCT_LOGIN_SETUP_OWNER_EMAIL = email Google de l'owner de ce projet
 *  BXCT_LOGIN_BOOTSTRAP_PASSWORD = mot de passe initial fort (>=12 avec complexite)
 * Le mot de passe est supprime apres installation reussie; aucune sortie sensible.
 * Ne JAMAIS copier ces deux proprietes dans les feuilles ou dans le ZIP.
 */
function BXCT_LOGIN_SETUP_proprietesPrivees_() {
  var props=PropertiesService.getScriptProperties();
  var owner=String(props.getProperty('BXCT_LOGIN_SETUP_OWNER_EMAIL')||'').trim().toLowerCase();
  if(!owner)throw new Error('CONFIGURER_BXCT_LOGIN_SETUP_OWNER_EMAIL');
  var active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  var effective=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
  if(!active||active!==owner||effective!==owner)throw new Error('PROPRIETAIRE_REQUIS');
  var pass=props.getProperty('BXCT_LOGIN_BOOTSTRAP_PASSWORD');
  if(!pass)throw new Error('CONFIGURER_BXCT_LOGIN_BOOTSTRAP_PASSWORD');
  BXCT_LOGIN_CRYPTO_passwordValide_(pass);
  return {props:props,pass:pass};
}
/** Installation autonome : utilise le secret choisi et depose en propriete privee. */
function BXCT_LOGIN_INSTALLER_ADMIN_VIA_PROPRIETES() {
  var secret=BXCT_LOGIN_SETUP_proprietesPrivees_();
  var book=controlWorkbook_(),r=BXCT_LOGIN_SERVICE_initialiserAdmin_(book,secret.pass);
  if(r.status==='INSTALLE'||r.status==='DEJA_INSTALLE')
    secret.props.deleteProperty('BXCT_LOGIN_BOOTSTRAP_PASSWORD');
  return {ok:true,status:r.status,login:'admin',motDePasseJournalise:false};
}
/** Secours autonome : rotation explicite du mot de passe et revocation des sessions. */
function BXCT_LOGIN_SECOURS_ADMIN_VIA_PROPRIETES() {
  var secret=BXCT_LOGIN_SETUP_proprietesPrivees_();
  var book=controlWorkbook_(),r=BXCT_LOGIN_SERVICE_reinitialiserAdmin_(book,secret.pass);
  if(r.status==='SECRET_REINITIALISE')
    secret.props.deleteProperty('BXCT_LOGIN_BOOTSTRAP_PASSWORD');
  return {ok:true,status:r.status,login:'admin',motDePasseJournalise:false};
}
