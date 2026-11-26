/**
 * BOXY CONTROL ACADEMIE - LOT 1/6.
 * Lecture du catalogue prive, sans inscription, affectation, caisse ou ecriture CLIENT.
 * Ce module partage Code.gs (OIDC), ROLES et la source CLIENT en lecture seule.
 * En mode TEST, des copies distinctes des deux fichiers sont obligatoires.
 */
const BOXY_ACADEMIE_LOT1_VERSION_ = '1.0.0-rc1';

/** Appel public Apps Script autorise seulement apres verification serveur. */
function controlAcademieCatalogue(googleIdToken) {
  const identity = verifyGoogleIdToken_(googleIdToken);
  const control = controlWorkbook_();
  const agent = findEnabledAgent_(control, identity);
  const settings = readControlSettings_(control);
  const permissions = loadRolePermissions_(control, agent.role);
  if (!['TEST','PRODUCTION'].includes(settings.APP_MODE) ||
      settings.ACADEMIE_LECTURE_ACTIVE !== 'OUI' ||
      settings.ACADEMIE_SESSIONS_LECTURE_ACTIVE !== 'OUI' ||
      settings.ACADEMIE_SOURCE !== 'CLIENT_SEUL' ||
      permissions.indexOf('CONSULTER_ACADEMIE') < 0) {
    throw new Error('ACCES_ACADEMIE_FERME');
  }
  // Le helper partage avec PHOTO impose les copies CLIENT_TEST quand APP_MODE=TEST.
  // Il n'existe dans ce module aucune fonction appendRow / setValues sur le CLIENT.
  const client = ouvrirSourceClientPhoto_(settings);
  const categories = academyReadTable_(client, 'CATEGORIES_ACADEMIE',
    ['code_categorie','libelle','actif'], 150);
  const formations = academyReadTable_(client, 'FORMATIONS_ACADEMIE',
    ['code_formation','code_categorie','titre','niveau','objectif',
      'duree_heures_indicative','validation_fiche','visible_public','version_fiche'], 350);
  const sessions = academyReadTable_(client, 'SESSIONS_ACADEMIE',
    ['code_session','code_formation','titre_session','date_debut','date_fin',
      'heure_debut','heure_fin','fuseau','modalite','lieu_public','formateur_public',
      'capacite_max','statut_session','validation_session','visible_public'], 500);
  const seances = academyReadTable_(client, 'SEANCES_ACADEMIE',
    ['code_session','numero_seance','date_seance','heure_debut','heure_fin','activite',
      'validation','actif'], 750);
  const codesFormation = {};
  const codesSession = {};
  const unique = (obj,code) => {
    if (!code || !/^[A-Z0-9_-]{2,70}$/.test(code) || obj[code]) {
      throw new Error('CATALOGUE_INCOHERENT');
    }
    obj[code] = true;
  };
  const catalogue = formations.map(f => {
    const code = f.code_formation.toUpperCase();
    unique(codesFormation, code);
    return {
      code, categorie: f.code_categorie, titre: f.titre,
      niveau: f.niveau, objectif: f.objectif,
      dureeHeures: academySafeNumber_(f.duree_heures_indicative, 10000),
      validation: f.validation_fiche,
      visiblePublic: f.visible_public === 'OUI',
      version: String(f.version_fiche || '')
    };
  });
  const sessionsOut = sessions.map(s => {
    const code = s.code_session.toUpperCase();
    unique(codesSession,code);
    if (!codesFormation[s.code_formation]) throw new Error('CATALOGUE_INCOHERENT');
    return {
      code, codeFormation:s.code_formation, titre:s.titre_session,
      debut:s.date_debut, fin:s.date_fin, heureDebut:s.heure_debut,
      heureFin:s.heure_fin, fuseau:s.fuseau, modalite:s.modalite,
      lieu:s.lieu_public, formateur:s.formateur_public,
      capaciteIndicative:academySafeNumber_(s.capacite_max, 100000),
      statut:s.statut_session, validation:s.validation_session,
      visiblePublic:s.visible_public === 'OUI',
      placesVerifiees:false
    };
  });
  const seancesOut = seances.filter(s => codesSession[s.code_session]).map(s => ({
    codeSession:s.code_session, numero:academySafeNumber_(s.numero_seance, 1000),
    date:s.date_seance, debut:s.heure_debut, fin:s.heure_fin,
    activite:s.activite, validation:s.validation,
    active:s.actif === 'OUI'
  }));
  const suivi = academyLot1SuiviInterne_(client, control, sessionsOut);
  return {
    ok:true, source:'BOXY_CLIENT', readOnly:true,
    suivi:suivi.totaux,
    placesVerifiees:false,
    categories: categories.map(c=>({code:c.code_categorie,nom:c.libelle,active:c.actif==='OUI'})),
    formations:catalogue, sessions:suivi.sessions, seances:seancesOut,
    agentRole:agent.role,
    version:BOXY_ACADEMIE_LOT1_VERSION_
  };
}

function academySafeNumber_(raw,max) {
  const n = Number(String(raw || '0').replace(/\s/g,'').replace(',','.'));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

function academyReadTable_(book,title,required,max) {
  return BXCT_CORE_DATA_readTable_(book,title,required,max);
}

/** Fonction privee accessible uniquement dans l'editeur Apps Script. */
function diagnosticAcademieControlLot1_() {
  const control = controlWorkbook_();
  const settings = readControlSettings_(control);
  const names = ['PARAMETRES','AGENTS','ROLES','PLAN_LOTS_CONTROL_ACADEMIE',
    'MAPPING_ACADEMIE_LOT1','RECETTE_CONTROL_ACADEMIE_LOT1'];
  return {
    control:control.getName(),
    ongletsManquants:names.filter(n=>!control.getSheetByName(n)),
    lectureFermee:settings.ACADEMIE_LECTURE_ACTIVE==='NON',
    sessionsFermees:settings.ACADEMIE_SESSIONS_LECTURE_ACTIVE==='NON',
    operationsFermees:settings.ACADEMIE_OPERATIONS_ACTIVES==='NON',
    productionFermee:settings.APP_MODE==='PREPARATION'
  };
}

/**
 * LOT 1/2 — statistiques anonymes, strictement lecture seule.
 * Aucun nom, numero, code personnel ou identifiant de dossier dans la reponse UI.
 * Une demande CLIENT ne devient jamais une confirmation de place.
 */
function academyLot1SuiviInterne_(client, control, sessions) {
  // Le journal de decisions CONTROL fait seul autorite pour les confirmations.
  // Les helpers du LOT 3 lisent uniquement le journal et verifient sa coherence.
  const decisions = academyLot3Snapshot_(academyLot3ReadEvents_(control));
  const parSession = {};
  sessions.forEach(function(s){
    parSession[s.code]={aTraiter:0,confirmesControl:0,attenteControl:0};
  });
  let confirmes=0,attente=0;
  Object.keys(decisions).forEach(function(id){
    const d=decisions[id],code=String(d.session||'').toUpperCase();
    if(!parSession[code])return;
    if(d.statut==='CONFIRMEE'){parSession[code].confirmesControl++;confirmes++;}
    if(d.statut==='LISTE_ATTENTE'){parSession[code].attenteControl++;attente++;}
  });
  const tab=client.getSheetByName('INSCRIPTIONS');
  if(!tab||tab.getLastRow()<1||tab.getLastRow()>25001)throw new Error('SOURCE_INSCRIPTIONS_INDISPONIBLE');
  const entete=tab.getRange(1,1,1,tab.getLastColumn()).getDisplayValues()[0];
  const champs=['inscription_id','code_prestation','code_session','statut'];
  const positions=champs.map(function(k){
    const n=entete.indexOf(k);
    if(n<0)throw new Error('SOURCE_INSCRIPTIONS_INCOMPATIBLE');
    return n+1;
  });
  let aTraiter=0,aAffecter=0;
  const n=tab.getLastRow()-1;
  if(n>0){
    // Colonnes precises uniquement : pas de lecture nom, telephone, e-mail ou details_json.
    const col=positions.map(function(p){return tab.getRange(2,p,n,1).getDisplayValues();});
    const vus=new Set();
    for(let i=0;i<n;i++){
      if(String(col[1][i][0]||'').trim().toUpperCase()!=='FORMATION')continue;
      const id=String(col[0][i][0]||'').trim();
      if(!id||vus.has(id))throw new Error('INSCRIPTIONS_ACADEMIE_INCOHERENTES');
      vus.add(id);
      const statut=String(col[3][i][0]||'').trim().toUpperCase();
      if(statut==='ANNULEE')continue;
      const d=decisions[id];
      if(d&&['CONFIRMEE','LISTE_ATTENTE','ANNULEE'].indexOf(d.statut)>=0)continue;
      aTraiter++;
      const code=String(col[2][i][0]||'').trim().toUpperCase();
      if(parSession[code])parSession[code].aTraiter++;
      else aAffecter++; // A_AFFECTER ou code absent du catalogue : aucune attribution inventee.
    }
  }
  return {
    totaux:{aTraiter:aTraiter,aAffecter:aAffecter,confirmees:confirmes,listeAttente:attente},
    sessions:sessions.map(function(s){
      const metrics=parSession[s.code];
      return Object.assign({},s,metrics);
    })
  };
}
