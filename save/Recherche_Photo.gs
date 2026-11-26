/**
 * BOXY CONTROL - LOT 2/7 - lecture seule des demandes BOXY PHOTO.
 * Aucune creation ou modification de BOXY_CLIENT, reservation ou paiement.
 * Prerequis: Code.gs LOT1, Google OIDC configure et verifie cote serveur.
 * TEST : Script Property CLIENT_TEST_SHEET_ID doit pointer vers une copie separee
 * nommee BOXY_CLIENT_TEST. En mode PRODUCTION : PARAMETRES.CLIENT_SPREADSHEET_ID.
 * Toutes les permissions sont REFUSEES par defaut.
 */
const BOXY_LOOKUP_VERSION_ = '2.0.0-rc1';
const BOXY_CODE_PATTERN_ = /^BXR-[A-Z0-9]{6,24}$/;
const BOXY_LOOKUP_REQUIRED_HEADERS_ = [
  'inscription_id', 'code_public', 'cree_le_utc', 'code_prestation',
  'nom_client', 'telephone', 'details_json', 'statut', 'maj_le_utc'
];

/** Methode appelable par le navigateur. Chaque appel re-verifie le jeton Google. */
function controlLookupPhoto(googleIdToken, codeSaisi) {
  // Ne jamais retourner de donnees avant la verification d'identite/role/verrou.
  const ctx = controlLookupContext_(googleIdToken);
  const code = normaliserCodePhoto_(codeSaisi);
  if (!code) throw new Error('CODE_INVALIDE');
  limiterConsultationsPhoto_(ctx.agent, ctx.settings);
  const source = ouvrirSourceClientPhoto_(ctx.settings);
  const sourceSheet = source.getSheetByName('INSCRIPTIONS');
  if (!sourceSheet) throw new Error('SOURCE_INDISPONIBLE');
  const cols = sourceSheet.getRange(1, 1, 1, 18).getDisplayValues()[0];
  const ix = {};
  BOXY_LOOKUP_REQUIRED_HEADERS_.forEach(k => {
    ix[k] = cols.indexOf(k);
    if (ix[k] < 0) throw new Error('SCHEMA_CLIENT_INCOMPATIBLE');
  });
  let found = null;
  if (sourceSheet.getLastRow() >= 2) {
    const matches = sourceSheet.getRange(2, ix.code_public + 1,
      sourceSheet.getLastRow() - 1, 1)
      .createTextFinder(code).matchEntireCell(true).matchCase(true).findAll();
    if (matches.length > 1) throw new Error('SOURCE_CLIENT_AMBIGUE');
    if (matches.length === 1) {
      const row = sourceSheet.getRange(matches[0].getRow(), 1, 1, 18).getDisplayValues()[0];
      // Seul le shooting est autorise au LOT2.
      if (String(row[ix.code_prestation]).trim().toUpperCase() === 'SHOOTING') {
        found = mapperDossierPhoto_(row, ix);
      }
    }
  }
  // Politique fail-closed : indisponibilite du journal AUDIT = pas de fiche divulguee.
  auditerRecherchePhoto_(ctx.book, ctx.agent.agentId, found ? found.inscriptionId : '',
    found ? 'TROUVE' : 'ABSENT', code);
  if (!found) return {ok:true, found:false, message:'Dossier introuvable. Vérifiez le code BOXY.'};
  return {ok:true, found:true, dossier:found, release:BOXY_LOOKUP_VERSION_};
}

function controlLookupContext_(idToken) {
  const identity = verifyGoogleIdToken_(idToken);
  const book = controlWorkbook_();
  const settings = readControlSettings_(book);
  if (settings.RECHERCHE_CLIENT_ACTIVE !== 'OUI' ||
      !['TEST','PRODUCTION'].includes(settings.APP_MODE)) {
    throw new Error('RECHERCHE_DESACTIVEE');
  }
  const agent = findEnabledAgent_(book, identity);
  const permissions = loadRolePermissions_(book, agent.role);
  if (!permissions.includes('CONSULTER_DEMANDE')) throw new Error('AUTORISATION_REFUSEE');
  return {book,settings,agent};
}

/** La saisie peut contenir un code brut ou une URL QR de nos seuls domaines. */
function normaliserCodePhoto_(entree) {
  let raw = String(entree == null ? '' : entree).trim();
  if (raw.length > 500) return '';
  if (/^https:\/\//i.test(raw)) {
    try {
      const match = /^https:\/\/([^/?#]+)([^#]*)/i.exec(raw);
      if (!match || !['boxyclient.syncore.site','boxycontrol.syncore.site'].includes(match[1].toLowerCase())) return '';
      const hit = /[?&]code=([^&#]+)/i.exec(match[2]);
      if (!hit) return '';
      raw = decodeURIComponent(hit[1].replace(/\+/g,'%20'));
    } catch (e) { return ''; }
  }
  raw = raw.trim().toUpperCase();
  return BOXY_CODE_PATTERN_.test(raw) ? raw : '';
}

function ouvrirSourceClientPhoto_(settings) {
  return BXCT_CORE_DATA_clientSource_(settings);
}

function mapperDossierPhoto_(row, ix) {
  let detail = {};
  try {
    const raw = String(row[ix.details_json] || '');
    if (raw && raw.length <= 15000) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) detail = obj;
    }
  } catch (e) { /* contenu ancien ou mal forme = champs optionnels indisponibles */ }
  const planning = (detail.planning && typeof detail.planning === 'object') ? detail.planning : {};
  const devis = (detail.devis && typeof detail.devis === 'object') ? detail.devis : {};
  const montant = Number(devis.total_fcfa);
  const type = String(detail.code_type || '').slice(0,50);
  const nomsType = {PORTRAIT:'Portrait',ANNIVERSAIRE:'Anniversaire',COUPLE:'Couple',
    FAMILLE:'Famille',GROSSESSE:'Grossesse',PROFESSIONNEL:'Professionnel',PRODUIT:'Produit'};
  return {
    inscriptionId:String(row[ix.inscription_id] || '').slice(0,90),
    code:String(row[ix.code_public] || '').slice(0,40),
    nomClient:String(row[ix.nom_client] || '').slice(0,110),
    telephoneMasque:masquerTelephonePhoto_(row[ix.telephone]),
    prestation:'BOXY PHOTO',
    typeShooting:nomsType[type] || 'Shooting photo',
    modeTarif:String(detail.mode || '').slice(0,30),
    forfait:String(detail.code_forfait || '').slice(0,60),
    nombrePhotos:Number.isInteger(Number(detail.nombre_photos)) ? Math.min(1000,Math.max(0,Number(detail.nombre_photos))) : null,
    dateSouhaitee:String(planning.date || '').slice(0,40),
    heureSouhaitee:String(planning.heure || '').slice(0,20),
    modePlanning:String(planning.mode || '').slice(0,30),
    devisEstimeFcfa:Number.isFinite(montant) && Number.isInteger(montant) && montant > 0 && montant < 1000000000 ? montant : null,
    statutDemande:String(row[ix.statut] || 'RECU').slice(0,45),
    statutReservation:'EN_ATTENTE',  // LOT3 : confirme dans BOXY CONTROL uniquement.
    statutPaiement:'NON_VERIFIE',    // LOT6 : seul le registre des paiements CONTROL fait foi.
    miseAJourUtc:String(row[ix.maj_le_utc] || '').slice(0,55)
  };
}

function masquerTelephonePhoto_(valeur) {
  const digits = String(valeur || '').replace(/\D/g, '');
  if (digits.length < 8) return 'Numéro masqué';
  return '••••••' + digits.slice(-2);
}

function limiterConsultationsPhoto_(agent,settings) {
  const cache = CacheService.getScriptCache();
  const max = Math.max(3, Math.min(30, Number(settings.RECHERCHE_MAX_PAR_MINUTE) || 12));
  const key = 'photo_lkp_' + String(agent.agentId || '').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,50);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1800)) throw new Error('SERVICE_OCCUPE');
  try {
    const count = Number(cache.get(key) || 0);
    if (count >= max) throw new Error('TROP_DE_RECHERCHES');
    cache.put(key, String(count + 1), 60);
  } finally { lock.releaseLock(); }
}

function auditerRecherchePhoto_(book,agentId,inscriptionId,resultat,code) {
  const sheet = book.getSheetByName('AUDIT');
  if (!sheet) throw new Error('AUDIT_INDISPONIBLE');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,code,Utilities.Charset.UTF_8);
  const hex = bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('').slice(0,20);
  const corr = Utilities.getUuid();
  try {
    sheet.appendRow(['AUD-'+Utilities.getUuid(),new Date().toISOString(),agentId,
      'CONSULTATION_DOSSIER_PHOTO',inscriptionId,'',resultat,corr,hex,'Lecture seule depuis BOXY_CLIENT']);
  } catch (e) { throw new Error('AUDIT_INDISPONIBLE'); }
}

/** Diagnostic privé depuis l'éditeur Apps Script, jamais exposé par google.script.run. */
function diagnosticControlLot2_() {
  const book = controlWorkbook_();
  const cfg = readControlSettings_(book);
  return {
    sourcePrincipalePresente:Boolean(cfg.CLIENT_SPREADSHEET_ID),
    sourceTestConfiguree:Boolean(PropertiesService.getScriptProperties().getProperty('CLIENT_TEST_SHEET_ID')),
    rechercheVerrouillee:cfg.RECHERCHE_CLIENT_ACTIVE === 'NON',
    auditPresent:Boolean(book.getSheetByName('AUDIT')),
    aucuneInscriptionDepuisControl:true,
    operationsVerrouillees:cfg.OPERATIONS_ACTIVES === 'NON',
    paiementsVerrouilles:cfg.PAIEMENTS_ACTIFS === 'NON'
  };
}
