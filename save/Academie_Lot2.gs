/**
 * BOXY CONTROL ACADÉMIE — LOT 2/6 : recherche d'une inscription par code BOXY.
 * Uniquement lecture de BOXY_CLIENT. Pas de création / validation de place, de
 * paiement, de modification d'inscription ou de synchronisation.
 * Les scripts sont des candidats de recette privée, pas une publication.
 */
const BOXY_ACADEMIE_LOT2_VERSION_ = '2.0.0-rc2-BXFOR';
const BOXY_ACADEMIE_LOOKUP_FIELDS_ = [
  'inscription_id', 'code_public', 'code_prestation', 'nom_client',
  'telephone', 'code_session', 'details_json', 'statut', 'maj_le_utc'
];

/** Unique endpoint public de ce LOT : aucune information retournée sans autorisation. */
function controlAcademieLookup(googleIdToken, saisie) {
  const ctx = academyLookupContext_(googleIdToken);
  const code = academyLot2NormaliserCode_(saisie); // Cette recherche acceptera UNIQUEMENT BX.FOR.
  if (!code) throw new Error('CODE_INVALIDE');
  academyLookupLimit_(ctx.agent, ctx.settings);
  const client = ouvrirSourceClientPhoto_(ctx.settings); // Copie CLIENT_TEST obligatoire en TEST.
  const inscrits = client.getSheetByName('INSCRIPTIONS');
  if (!inscrits) throw new Error('SOURCE_INDISPONIBLE');
  const last = inscrits.getLastRow();
  if (last < 1 || last > 25001 || inscrits.getLastColumn() < 18) throw new Error('SOURCE_INDISPONIBLE');
  const header = inscrits.getRange(1, 1, 1, 18).getDisplayValues()[0].map(s => String(s || '').trim());
  const col = {};
  BOXY_ACADEMIE_LOOKUP_FIELDS_.forEach(k => {
    col[k] = header.indexOf(k);
    if (col[k] < 0) throw new Error('SCHEMA_CLIENT_INCOMPATIBLE');
  });
  let person = null, outcome = 'ABSENT';
  if (last > 1) {
    const matches = inscrits.getRange(2, col.code_public + 1, last - 1, 1)
      .createTextFinder(code).matchEntireCell(true).matchCase(true).findAll();
    if (matches.length > 1) throw new Error('SOURCE_CLIENT_AMBIGUE');
    if (matches.length === 1) {
      const row = inscrits.getRange(matches[0].getRow(), 1, 1, 18).getDisplayValues()[0];
      if (String(row[col.code_prestation] || '').trim().toUpperCase() === 'FORMATION') {
        try {
          person = academyLookupMap_(client, row, col);
          outcome = 'TROUVE';
        } catch (err) {
          // Aucun détail d'une ligne incohérente n'est divulgué au navigateur.
          outcome = 'SOURCE_INCOHERENTE';
        }
      }
    }
  }
  // L'audit CONTROL est obligatoire AVANT de divulguer la fiche.
  if (person) academyLot2AjouterHistorique_(ctx.book, person);
  BXCT_RG_auditer_(ctx.book, ctx.agent.agentId, 'CONSULTATION_INSCRIPTION_ACADEMIE',
    person ? person.inscriptionId : '', outcome, code);
  if (!person) return {ok:true, found:false, message:'Dossier introuvable. Vérifiez le code BX.FOR.'};
  return {ok:true, found:true, dossier:person, release:BOXY_ACADEMIE_LOT2_VERSION_};
}

function academyLookupContext_(token) {
  const identity = verifyGoogleIdToken_(token);
  const book = controlWorkbook_();
  const agent = findEnabledAgent_(book, identity);
  const settings = readControlSettings_(book);
  const rights = loadRolePermissions_(book, agent.role);
  if (!['TEST','PRODUCTION'].includes(settings.APP_MODE) ||
      settings.ACADEMIE_RECHERCHE_ACTIVE !== 'OUI' ||
      settings.ACADEMIE_RECHERCHE_SOURCE !== 'CLIENT_SEUL' ||
      settings.ACADEMIE_AUDIT_RECHERCHE_OBLIGATOIRE !== 'OUI' ||
      !rights.includes('CONSULTER_INSCRIPTION_ACADEMIE')) {
    throw new Error('ACCES_INSCRIPTION_ACADEMIE_FERME');
  }
  // Empêche d'utiliser involontairement le classeur principal en mode TEST.
  const useTest = PropertiesService.getScriptProperties().getProperty('CONTROL_USE_TEST_SHEET') === 'OUI';
  if ((settings.APP_MODE === 'TEST') !== useTest) throw new Error('ENVIRONNEMENT_INCOHERENT');
  return {book, agent, settings};
}

/** Les codes publics de formation ont le format officiel BX.FOR.xx. */
function academyLot2NormaliserCode_(input) {
  const code = BXCT_RG_normaliser_(input);
  return /^BX\.FOR\.[A-Z0-9]{2,20}$/.test(code) ? code : '';
}

/**
 * Lecture tolérante des anciennes demandes : une session A_AFFECTER, ou une
 * formation non encore publiée dans le catalogue, n'empêche PAS la recherche.
 * Le titre de demande est une photographie du choix CLIENT, non une validation.
 */
function academyLookupMap_(client, row, col) {
  const raw = String(row[col.details_json] || '');
  if (!raw || raw.length > 25000) throw new Error('DETAILS_INDISPONIBLES');
  let detail;
  try { detail = JSON.parse(raw); } catch (err) { throw new Error('DETAILS_INDISPONIBLES'); }
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw new Error('DETAILS_INDISPONIBLES');
  const d = detail.details && typeof detail.details === 'object' && !Array.isArray(detail.details)
    ? detail.details : detail;
  const codeFormation = String(d.code_formation || '').trim().toUpperCase();
  const sessionSource = String(row[col.code_session] || '').trim().toUpperCase();
  const codeSession = sessionSource === 'A_AFFECTER' ? '' : sessionSource;
  if (codeFormation && !/^[A-Z0-9_-]{3,70}$/.test(codeFormation)) throw new Error('CHOIX_ACADEMIE_INCOHERENT');
  if (codeSession && !/^[A-Z0-9_-]{3,80}$/.test(codeSession)) throw new Error('CHOIX_ACADEMIE_INCOHERENT');
  const formations = academyReadTable_(client, 'FORMATIONS_ACADEMIE',
    ['code_formation','titre','validation_fiche'], 350);
  const sessions = academyReadTable_(client, 'SESSIONS_ACADEMIE',
    ['code_session','code_formation','titre_session','date_debut','date_fin',
      'statut_session','validation_session'], 500);
  const fiche = formations.find(f => f.code_formation.toUpperCase() === codeFormation) || null;
  const session = codeSession ? (sessions.find(t => t.code_session.toUpperCase() === codeSession) || null) : null;
  // Une session inconnue ou rattachée à une autre formation n'est jamais validée.
  const sessionCohérente = Boolean(session && fiche &&
    session.code_formation.toUpperCase() === fiche.code_formation.toUpperCase());
  const titreSnapshot = String(d.titre_formation || d.formation_titre || '').trim();
  const titreSessionSnapshot = String(d.session && d.session.titre || '').trim();
  const statut = String(row[col.statut] || 'RECU').trim().toUpperCase();
  const safeStatus = ['RECU','EN_EXAMEN','ANNULEE'].includes(statut) ? statut : 'EN_EXAMEN';
  const allowedLevel = ['DEBUTANT','DÉBUTANT','INTERMEDIAIRE','INTERMÉDIAIRE','AVANCE','AVANCÉ'];
  const niveau = String(d.niveau_actuel || '').trim().toUpperCase();
  return {
    inscriptionId:String(row[col.inscription_id] || '').slice(0,90),
    code:String(row[col.code_public] || '').slice(0,48),
    nomClient:String(row[col.nom_client] || '').slice(0,110),
    telephoneMasque:masquerTelephonePhoto_(row[col.telephone]),
    prestation:'BOXY ACADÉMIE',
    formationCode:codeFormation,
    formationTitre:String((fiche && fiche.titre) || titreSnapshot || 'Formation à préciser').slice(0,135),
    formationDansCatalogue:Boolean(fiche),
    codeSession:sessionCohérente ? codeSession : '',
    sessionTitre:sessionCohérente ? String(session.titre_session || codeSession).slice(0,135) :
      (codeSession ? String(titreSessionSnapshot || 'Session à vérifier').slice(0,135) : 'À affecter'),
    debutSession:sessionCohérente ? String(session.date_debut || '').slice(0,30) : '',
    finSession:sessionCohérente ? String(session.date_fin || '').slice(0,30) : '',
    niveau:allowedLevel.includes(niveau) ? niveau : 'NON_RENSEIGNE',
    ficheValidee:Boolean(fiche && fiche.validation_fiche === 'VALIDEE'),
    sessionValidee:Boolean(sessionCohérente && session.validation_session === 'VALIDEE'),
    affectationEnAttente:!sessionCohérente,
    statutDemande:safeStatus,
    statutInscription:'EN_ATTENTE_CONTROL',
    statutPaiement:'NON_VERIFIE',
    placesVerifiees:false,
    majClientUtc:String(row[col.maj_le_utc] || '').slice(0,50)
  };
}

/** Historique métier CONTROL ; aucune action sur les places, aucune écriture. */
function academyLot2AjouterHistorique_(control, dossier) {
  dossier.historique = [];
  dossier.historiqueDisponible = false;
  try {
    const events=academyLot3ReadEvents_(control);
    // Le parseur métier rejette les décisions incohérentes avant que leur état
    // puisse être affiché comme une confirmation.
    const states=academyLot3Snapshot_(events);
    const filtered=events.filter(e=>e.inscription_id === dossier.inscriptionId)
      .slice(-20);
    dossier.historique=filtered.map(e=>({
      date:String(e.cree_utc || '').slice(0,30),
      action:String(e.action || '').slice(0,30),
      statut:String(e.statut_apres || '').slice(0,30),
      session:String(e.code_session_cible || '').slice(0,80)
    }));
    dossier.historiqueDisponible = true;
    const current=states[dossier.inscriptionId];
    if(current && ['CONFIRMEE','LISTE_ATTENTE','ANNULEE'].includes(current.statut)){
      dossier.statutInscription=current.statut;
      dossier.sessionDecision=String(current.session || '').slice(0,80);
    }
  } catch (err) {
    // Un journal absent ou incohérent ne donne jamais un état « confirmé ».
    dossier.historique=[];dossier.historiqueDisponible=false;
    dossier.statutInscription='EN_ATTENTE_CONTROL';
  }
  return dossier;
}

function academyLookupLimit_(agent, settings) {
  const limit = Math.max(3, Math.min(20, Number(settings.ACADEMIE_RECHERCHE_MAX_PAR_MINUTE) || 10));
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) throw new Error('SERVICE_OCCUPE');
  try {
    const cache = CacheService.getScriptCache();
    const key = 'acad_lookup_' + String(agent.agentId || '').replace(/[^A-Za-z0-9_-]/g,'').slice(0,50);
    const count = Number(cache.get(key) || 0);
    if (count >= limit) throw new Error('TROP_DE_RECHERCHES');
    cache.put(key, String(count + 1), 60);
  } finally { lock.releaseLock(); }
}

/** HMAC : éviter le code client en clair dans le journal, y compris lors d'un échec. */
function academyLookupAudit_(book, agentId, inscriptionId, outcome, code) {
  const audit = book.getSheetByName('AUDIT');
  const secret = String(PropertiesService.getScriptProperties().getProperty('AUDIT_HASH_SECRET') || '');
  if (!audit || secret.length < 32) throw new Error('AUDIT_NON_CONFIGURE');
  const sig = Utilities.computeHmacSha256Signature(code, secret);
  const fingerprint = sig.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('').slice(0,24);
  const corr = Utilities.getUuid();
  try {
    audit.appendRow(['AUD-' + Utilities.getUuid(), new Date().toISOString(), agentId,
      'CONSULTATION_INSCRIPTION_ACADEMIE', inscriptionId, '', outcome, corr, fingerprint,
      'Recherche en lecture seule sur BOXY_CLIENT']);
  } catch (err) { throw new Error('AUDIT_INDISPONIBLE'); }
}

/** Diagnostic privé, à exécuter dans l'éditeur Apps Script uniquement. */
function diagnosticAcademieControlLot2_() {
  const book = controlWorkbook_(), cfg = readControlSettings_(book);
  return {version:BOXY_ACADEMIE_LOT2_VERSION_, mode:cfg.APP_MODE,
    rechercheFermee:cfg.ACADEMIE_RECHERCHE_ACTIVE === 'NON',
    sourceClientSeule:cfg.ACADEMIE_RECHERCHE_SOURCE === 'CLIENT_SEUL',
    auditPresent:!!book.getSheetByName('AUDIT'),
    auditSecretConfigure:Boolean(PropertiesService.getScriptProperties().getProperty('AUDIT_HASH_SECRET')),
    scriptsEnLectureSeule:true,
    copiesRequises:cfg.APP_MODE === 'TEST'};
}
