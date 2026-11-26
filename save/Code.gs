/**
 * BOXY CONTROL — PARAMETRES INTERNES (7.0.6-rc1), sans Google OAuth personnalise.
 * Auth locale via BXCT_LOGIN_AUTH_verifierSession_ avec permissions serveur.
 * Mode DEMO distinct : aucune session ni acces aux donnees reelles.
 * Pont HMAC CLIENT / ADMIN et schemas metier inchanges.
 */
const BOXY_CONTROL_SHEET_ID_ = '1FUH_RjxVwtijnDDFbW2qfGP4mf7XBmCwr76h4s-PGmc';
const BOXY_CONTROL_SCHEMA_VERSION_ = '7.0.0-rc1'; // Schema inchange.

/**
 * Route Web App : /exec reste l'accueil ; /exec?page=parametres sert la page
 * autonome de configuration. Le nom de page n'est jamais utilise pour inclure
 * un fichier fourni par l'utilisateur.
 * Aucun acces a AGENTS n'est accorde par la simple consultation de la route.
 */
function doGet(e) {
  if (BXCT_PARAMS_ROUTE_estParametres_(e)) return BXCT_PARAMS_ROUTE_afficher_();
  const page = HtmlService.createTemplateFromFile('Index');
  page.previewLibre = BXCT_TEST_CONFIG_apercuLibre_();
  page.configurationInterne = false; // login visible; la demo reste un choix explicite
  page.lienParametres = BXCT_PARAMS_ROUTE_lienParametres_();
  return page.evaluate()
    .setTitle('BOXY CONTROL | Accueil')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Retourne uniquement l'identite de la session locale verifiee. */
function controlWhoAmI(googleIdToken) {
  const identity = verifyGoogleIdToken_(googleIdToken);
  return { email: identity.email, googleSub: null, emailVerified: false, authMode: 'LOCAL_PASSWORD' };
}

/** Charge les habilitations d'un agent authentifie par session locale. */
function controlBootstrap(googleIdToken) {
  const identity = verifyGoogleIdToken_(googleIdToken);
  const book = controlWorkbook_();
  const agent = findEnabledAgent_(book, identity);
  const permissions = loadRolePermissions_(book, agent.role);
  const settings = readControlSettings_(book);
  return {
    ok: true,
    agent: {
      id: agent.agentId,
      name: agent.name,
      email: identity.email,
      role: agent.role
    },
    permissions: permissions,
    mode: settings.APP_MODE || 'PREPARATION',
    ready: false,
    features: {
      reservationBridgeConfigured: BXCT_L8_CONFIG_active_(),
      operationsActive: settings.OPERATIONS_ACTIVES === 'OUI',
      paymentsActive: settings.PAIEMENTS_ACTIFS === 'OUI',
      syncClientActive: settings.SYNC_CLIENT_ACTIVE === 'OUI' && settings.SYNC_LOT7_AUTORISE === 'OUI',
      syncAdminActive: settings.SYNC_ADMIN_ACTIVE === 'OUI',
      lookupActive: settings.RECHERCHE_CLIENT_ACTIVE === 'OUI' && ['TEST','PRODUCTION'].includes(settings.APP_MODE) && permissions.includes('CONSULTER_DEMANDE'),
      bookingActive: settings.RESERVATIONS_PHOTO_ACTIVES === 'OUI' && settings.OPERATIONS_ACTIVES === 'OUI' && ['TEST','PRODUCTION'].includes(settings.APP_MODE) && permissions.includes('CONFIRMER_RESERVATION'),
      pointageActive: settings.POINTAGE_PHOTO_ACTIF === 'OUI' && settings.OPERATIONS_ACTIVES === 'OUI' && ['TEST','PRODUCTION'].includes(settings.APP_MODE) && permissions.includes('POINTAGE_PHOTO'),
      productionActive: settings.PRODUCTION_PHOTO_ACTIF === 'OUI' && settings.OPERATIONS_ACTIVES === 'OUI' && ['TEST','PRODUCTION'].includes(settings.APP_MODE) && permissions.some(p=>['CONSULTER_PRODUCTION','SUIVI_PRODUCTION','GERER_AFFECTATIONS','VALIDER_LIVRAISON_PHOTO'].includes(p)),
      paymentAccess: ['TEST','PRODUCTION'].includes(settings.APP_MODE) && permissions.includes('CONSULTER_PAIEMENTS') && (BXCT_CORE_AUTH_isAdmin_(agent.role) || settings.PAIEMENTS_ACTIFS === 'OUI'),
      academyCatalogueActive: ['TEST','PRODUCTION'].includes(settings.APP_MODE) && settings.ACADEMIE_LECTURE_ACTIVE === 'OUI' && settings.ACADEMIE_SESSIONS_LECTURE_ACTIVE === 'OUI' && permissions.includes('CONSULTER_ACADEMIE'),
      academyLookupActive: ['TEST','PRODUCTION'].includes(settings.APP_MODE) && settings.ACADEMIE_RECHERCHE_ACTIVE === 'OUI' && settings.ACADEMIE_RECHERCHE_SOURCE === 'CLIENT_SEUL' && permissions.includes('CONSULTER_INSCRIPTION_ACADEMIE'),
      academyDecisionsActive: ['TEST','PRODUCTION'].includes(settings.APP_MODE) && settings.OPERATIONS_ACTIVES === 'OUI' && settings.ACADEMIE_OPERATIONS_ACTIVES === 'OUI' && settings.ACADEMIE_DECISIONS_ACTIVES === 'OUI' && settings.ACADEMIE_RECHERCHE_ACTIVE === 'OUI' && permissions.includes('DECIDER_INSCRIPTION_ACADEMIE') && permissions.includes('CONSULTER_INSCRIPTION_ACADEMIE') && ['SUPERVISEUR','ADMIN_CONTROL'].includes(agent.role),
      academyProgressActive: ['TEST','PRODUCTION'].includes(settings.APP_MODE) && settings.ACADEMIE_PROGRESSION_LECTURE_ACTIVE === 'OUI' && permissions.some(p=>['CONSULTER_PRESENCES_ACADEMIE','POINTAGE_ACADEMIE'].includes(p)),
      academyAttendanceActive: ['TEST','PRODUCTION'].includes(settings.APP_MODE) && settings.OPERATIONS_ACTIVES==='OUI' && settings.ACADEMIE_OPERATIONS_ACTIVES==='OUI' && settings.ACADEMIE_PRESENCES_ACTIVES==='OUI' && settings.ACADEMIE_PROGRESSION_LECTURE_ACTIVE==='OUI' && permissions.includes('POINTAGE_ACADEMIE'),
      academySyncConfigured: ['TEST','PRODUCTION'].includes(settings.APP_MODE) && settings.ACADEMIE_SYNC_LOT6_AUTORISE==='OUI' && settings.SYNC_CLIENT_ACTIVE==='OUI',
      academyFinanceActive: ['TEST','PRODUCTION'].includes(settings.APP_MODE) && permissions.includes('CONSULTER_FINANCES_ACADEMIE') && BXCT_CORE_AUTH_financeRead_({agent,settings},false),
      academyFinanceWriteActive: BXCT_ENC_ACADEMY_WRITE_ACTIVE_ && ['TEST','PRODUCTION'].includes(settings.APP_MODE) && settings.OPERATIONS_ACTIVES==='OUI' && settings.PAIEMENTS_ACTIFS==='OUI' && settings.ACADEMIE_OPERATIONS_ACTIVES==='OUI' && settings.ACADEMIE_ENCAISSEMENTS_ACTIFS==='OUI' && settings.ACADEMIE_DEVIS_OFFICIELS_VALIDES==='OUI' && permissions.some(p=>['ENREGISTRER_PAIEMENT_ACADEMIE','VALIDER_PAIEMENT_ACADEMIE'].includes(p))
    },
    release: BOXY_CONTROL_SCHEMA_VERSION_
  };
}

/**
 * Helper privé. Chaque FUTURE opération publique devra commencer par cet appel,
 * puis vérifier les conditions métier, le verrou global et l'idempotence.
 * L'interface ne peut pas attribuer un rôle ou activer une permission.
 */
function requireControlPermission_(googleIdToken, requestedPermission) {
  const identity = verifyGoogleIdToken_(googleIdToken);
  const book = controlWorkbook_();
  const agent = findEnabledAgent_(book, identity);
  const settings = readControlSettings_(book);
  if (settings.OPERATIONS_ACTIVES !== 'OUI') throw new Error('OPERATIONS_DESACTIVEES');
  const list = loadRolePermissions_(book, agent.role);
  if (list.indexOf(String(requestedPermission)) < 0) throw new Error('AUTORISATION_REFUSEE');
  return {book, agent, settings};
}

/**
 * Wrapper de compatibilite des API historiques Google ID Token.
 * Son NOM reste pour les autres lots, mais il accepte uniquement une session
 * locale valide; aucun Google ID Token ni identite DEMO n'est accepte.
 */
function verifyGoogleIdToken_(googleIdToken) {
  return BXCT_LOGIN_AUTH_verifierSession_(googleIdToken, false);
}

function controlWorkbook_() {
  const prop = PropertiesService.getScriptProperties();
  const useTest = prop.getProperty('CONTROL_USE_TEST_SHEET') === 'OUI';
  const id = useTest ? String(prop.getProperty('CONTROL_TEST_SHEET_ID') || '').trim() : BOXY_CONTROL_SHEET_ID_;
  if (useTest && (!id || id === BOXY_CONTROL_SHEET_ID_)) throw new Error('COPIE_CONTROL_TEST_OBLIGATOIRE');
  const book = SpreadsheetApp.openById(id);
  const name = String(book.getName() || '');
  if (useTest && !/^BOXY_CONTROL_TEST(?:\b|_|\s)/.test(name)) throw new Error('COPIE_CONTROL_TEST_OBLIGATOIRE');
  if (!useTest && !/^BOXY_CONTROL\b/.test(name)) throw new Error('CLASSEUR_INATTENDU');
  return book;
}

function readControlSettings_(book) {
  const sheet = book.getSheetByName('PARAMETRES');
  if (!sheet) throw new Error('CONFIGURATION_INCOMPLETE');
  const rows = sheet.getDataRange().getDisplayValues();
  const out = {};
  rows.slice(1).forEach(r => { if (r[0]) out[String(r[0]).trim()] = String(r[1] || '').trim(); });
  return out;
}

function findEnabledAgent_(book, identity) {
  const sheet = book.getSheetByName('AGENTS');
  if (!sheet) throw new Error('CONFIGURATION_INCOMPLETE');
  const rows = sheet.getDataRange().getDisplayValues();
  const header = rows[0] || [];
  const keys = ['agent_id','nom_affiche','email_ou_identifiant','role','actif','google_sub'];
  const ix = {};
  keys.forEach(k => {ix[k] = header.indexOf(k); if (ix[k] < 0) throw new Error('CONFIGURATION_INCOMPLETE');});
  if (!identity || identity.authMode !== 'LOCAL_PASSWORD' || !identity.agentId)
    throw new Error('AGENT_NON_AUTORISE');
  const matches = rows.slice(1).filter(r =>
    String(r[ix.agent_id] || '').trim() === identity.agentId &&
    String(r[ix.email_ou_identifiant] || '').trim().toLowerCase() === identity.login &&
    String(r[ix.actif] || '').trim() === 'OUI'
  );
  if (matches.length !== 1) throw new Error('AGENT_NON_AUTORISE');
  const row = matches[0];
  const role = String(row[ix.role] || '').trim();
  const agentId = String(row[ix.agent_id] || '').trim();
  if (!role || !agentId) throw new Error('AGENT_NON_AUTORISE');
  return {agentId:agentId, name:String(row[ix.nom_affiche] || 'Agent BOXY'), role:role};
}

function loadRolePermissions_(book, role) {
  const sheet = book.getSheetByName('ROLES');
  if (!sheet) throw new Error('CONFIGURATION_INCOMPLETE');
  const rows = sheet.getDataRange().getDisplayValues();
  const header = rows[0] || [];
  const ir = header.indexOf('role'), ia = header.indexOf('autorisation'), iv = header.indexOf('active');
  if (ir < 0 || ia < 0 || iv < 0) throw new Error('CONFIGURATION_INCOMPLETE');
  return Array.from(new Set(rows.slice(1)
    .filter(r => BXCT_CORE_AUTH_isAdmin_(role) || (String(r[ir] || '').trim() === role && String(r[iv] || '').trim() === 'OUI'))
    .map(r => String(r[ia] || '').trim()).filter(Boolean)));
}

/** Fonction privée : à lancer manuellement dans l'éditeur Apps Script pour la recette. */
function diagnosticControlLot1_() {
  const book = controlWorkbook_();
  const settings = readControlSettings_(book);
  const needed = ['PARAMETRES','AGENTS','ROLES','DEMANDES_CLIENT','RESERVATIONS_PHOTO',
    'POINTAGES_PHOTO','SUIVI_PRODUCTION','PAIEMENTS','SYNC_CLIENT','SYNC_ADMIN','AUDIT'];
  const missing = needed.filter(name => !book.getSheetByName(name));
  return {
    spreadsheet: book.getName(), missingTabs: missing,
    agents: Math.max(0, book.getSheetByName('AGENTS').getLastRow() - 1),
    operationsLocked: settings.OPERATIONS_ACTIVES === 'NON',
    paymentsLocked: settings.PAIEMENTS_ACTIFS === 'NON',
    clientSyncLocked: settings.SYNC_CLIENT_ACTIVE === 'NON',
    googleClientConfigured: false, // Google OAuth personnalise retire en mode TEST.
    authenticationMode: 'LOCAL_PASSWORD_AVEC_DEMO_SEPAREE',
  };
}
