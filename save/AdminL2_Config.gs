/**
 * BOXY ADMIN / LOT 2. Core de configuration versionne, sans etat mutable.
 * Dependent de : Schema_Lot1.gs et Preflight_Lot1.gs (contrats LOT 1).
 * Utilise par : composants ADMIN_L2_* ; aucun acces direct au navigateur.
 */
var ADMIN_L2_CONFIG_ = Object.freeze({
  VERSION:'1.1.0-rc1', SCHEMA_VERSION:'2.0', KDF:'PBKDF2-HMAC-SHA256',
  ITERATIONS:120000, MIN_ITERATIONS:120000, MIN_PASSWORD:12,
  SESSION_MINUTES:20, LOGIN_MAX_ATTEMPTS:5, LOGIN_WINDOW_MS:15*60*1000,
  ADMIN_SHEET_ID:'19pR9r6VzM2Gc6z8tPhRB-4oyIJ6ZzsAB9zDSrxCt6to',
  ADMIN_ROLES:{SUPER_ADMIN:true},
  STATUTS:{ACTIF:true,SUSPENDU:true},
  ROLES:['SUPER_ADMIN','ADMIN_GESTION','GESTIONNAIRE_UTILISATEURS','ADMIN_CONTROL',
    'SUPERVISEUR','AGENT','PHOTOGRAPHE','FORMATEUR','CAISSIER',
    'ASSISTANT_FORMATION','RETOUCHEUR']
});

function ADMIN_L2_CONFIG_classeur_() {
  var ss=adminLot1OuvrirClasseur_();
  if (ss.getId()!==ADMIN_L2_CONFIG_.ADMIN_SHEET_ID) throw new Error('CLASSEUR_NON_AUTORISE');
  return ss;
}
function ADMIN_L2_CONFIG_parametres_(ss) { return adminLot1LireParametres_(ss); }
function ADMIN_L2_CONFIG_preflight_(ss) {
  var check=adminLot1VerifierSchemas_(ss);
  if (check.ongletsManquants.length||check.entetesInvalides.length) throw new Error('SCHEMA_LOT1_INVALIDE');
  return ADMIN_L2_CONFIG_parametres_(ss);
}
function ADMIN_L2_CONFIG_ouvert_(p) {
  return p.APP_MODE==='PREPARATION' && p.AUTH_ACTIVE==='OUI' &&
    p.UTILISATEURS_ECRITURE_ACTIVE==='OUI' && p.BOOTSTRAP_ADMIN_TERMINE==='OUI' &&
    p.AUTH_ALLOW_NEW_SESSIONS==='OUI' &&
    Number(p.MOT_DE_PASSE_COUT_KDF)>=ADMIN_L2_CONFIG_.MIN_ITERATIONS;
}
function ADMIN_L2_CONFIG_utc_(){return new Date().toISOString();}
function ADMIN_L2_CONFIG_result_(ok,code,message,data){return {ok:!!ok,code:String(code),message:String(message),data:data||null};}
function ADMIN_L2_CONFIG_erreur_(code){var e=new Error(code);e.code=code;return e;}
