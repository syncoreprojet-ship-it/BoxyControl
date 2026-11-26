/**
 * BOXY CONTROL - LOT 7/7 - Synchronisation serveur vers BOXY CLIENT.
 * PREPRODUCTION. Cette API n'est PAS exposee via google.script.run.
 * Exécution manuelle uniquement par l'editeur habilite pendant la recette.
 * Le journal HISTORIQUE_RESERVATIONS est la source autoritaire.
 * INSCRIPTIONS (CLIENT) est lu uniquement, jamais ecrit.
 * La livraison a ADMIN est un contrat non connecte (aucun effet externe).
 */
const CONTROL7_VERSION_ = '7.0.0-rc1';
const CONTROL7_HISTORY_ = [
  'evenement_id','reservation_id','inscription_id','code_public','action',
  'statut_avant','statut_apres','date_confirmee','heure_debut','heure_fin',
  'date_proposee','heure_debut_proposee','heure_fin_proposee','ressource_id',
  'agent_id','motif','cle_idempotence','version','horodatage_utc',
  'source_client_maj_utc','empreinte_requete'
];
const CONTROL7_OUTBOX_CLIENT_ = [
  'evenement_id','inscription_id','code_public','type_projection','statut','version',
  'cle_idempotence','cree_utc','envoye_utc','accuse_utc','nb_essais','erreur_securisee'
];
const CONTROL7_PUBLIC_ = [
  'inscription_id','statut_dossier','statut_reservation','statut_paiement',
  'date_confirmee','heure_confirmee','maj_le_utc','reference_control',
  'version_projection','dernier_evenement_control'
];
const CONTROL7_OCCUPATIONS_ = [
  'occupation_id','date','heure_debut','heure_fin','reference_control',
  'statut','actif','maj_le_utc','version_control','dernier_evenement_control'
];
const CONTROL7_INCIDENTS_ = [
  'incident_id','flux','evenement_id','cible','code_erreur','gravite','tentatives',
  'cree_utc','derniere_tentative_utc','statut','commentaire_securise'
];

/** No user-facing wrapper. The editor must configure TWO test copies before calling. */
function synchroniserReservationsClientLot7_() {
  const book = controlWorkbook_();
  const settings = readControlSettings_(book);
  const props = PropertiesService.getScriptProperties();
  control7RequireSender_(book, settings, props);
  const client = ouvrirSourceClientPhoto_(settings);
  const settingsClient = control7Settings_(client);
  control7RequireReceiver_(client, settings, settingsClient, props);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('SERVICE_OCCUPE');
  try {
    const outSheet = control7Sheet_(book, 'SYNC_CLIENT', CONTROL7_OUTBOX_CLIENT_);
    const history = control7Read_(book, 'HISTORIQUE_RESERVATIONS', CONTROL7_HISTORY_);
    const byEvent = new Map();
    history.forEach(e => {
      if (byEvent.has(e.evenement_id)) throw new Error('HISTORIQUE_AMBIGU');
      byEvent.set(e.evenement_id, e);
    });
    const pending = control7Read_(book, 'SYNC_CLIENT', CONTROL7_OUTBOX_CLIENT_)
      .filter(r => r.type_projection === 'RESERVATION_PHOTO' &&
        ['A_ENVOYER', 'EN_COURS', 'ERREUR'].includes(r.statut) &&
        Number(r.nb_essais || 0) < 5)
      .sort((a,b) => a.inscription_id.localeCompare(b.inscription_id) || Number(a.version) - Number(b.version));
    const max = Math.max(1, Math.min(30, Number(settings.SYNC_CLIENT_MAX_PAR_PASSAGE || 15)));
    const stats = {release: CONTROL7_VERSION_, enAttente: pending.length, examinees: 0, acquittees: 0, erreurs: 0};
    // No global cross-workbook transaction. Each target is idempotent and can be retried.
    for (const out of pending.slice(0,max)) {
      stats.examinees++;
      let event;
      try {
        event = byEvent.get(out.evenement_id);
        control7AssertEvent_(out, event);
        control7CheckOrigin_(client, event);
        control7Project_(client,event);  // Both projections must succeed before acknowledging.
        control7Ack_(outSheet,out,'ACQUITTE','');
        stats.acquittees++;
      } catch (e) {
        const err = control7SafeError_(e);
        control7Ack_(outSheet,out,'ERREUR',err);
        try { control7Incident_(book,out,err); } catch (ignored) { /* failure visible in outbox */ }
        stats.erreurs++;
      }
    }
    return stats;
  } finally {lock.releaseLock();}
}

function control7RequireSender_(book, settings,props) {
  if (settings.SYNC_LOT7_AUTORISE !== 'OUI' || settings.SYNC_CLIENT_ACTIVE !== 'OUI' ||
      settings.PHOTO_SYNC_STATUT_CLIENT !== 'OUI' || settings.OPERATIONS_ACTIVES !== 'OUI') {
    throw new Error('SYNC_NON_AUTORISEE');
  }
  if (settings.APP_MODE === 'TEST') {
    if (props.getProperty('CONTROL_USE_TEST_SHEET') !== 'OUI' ||
      !/^BOXY_CONTROL_TEST(?:\b|_|\s)/.test(book.getName())) throw new Error('COPIE_CONTROL_TEST_OBLIGATOIRE');
  } else if (settings.APP_MODE === 'PRODUCTION') {
    if (props.getProperty('CONTROL_USE_TEST_SHEET') === 'OUI' ||
        settings.SYNC_PRODUCTION_APPROUVEE !== 'OUI' ||
        props.getProperty('CONTROL_PROD_SYNC_CONFIRM') !== 'AUTORISE_CONTROL7') throw new Error('SYNC_PRODUCTION_NON_APPROUVEE');
  } else throw new Error('MODE_PREPARATION');
}

function control7RequireReceiver_(client, sender, dest,props) {
  if (dest.CONTROL_SYNC_ACTIVE !== 'OUI') throw new Error('RECEPTION_CLIENT_DESACTIVEE');
  if (sender.APP_MODE === 'TEST') {
    const testId = String(props.getProperty('CLIENT_TEST_SHEET_ID') || '');
    if (!testId || testId === sender.CLIENT_SPREADSHEET_ID ||
        !/^BOXY_CLIENT_TEST(?:\b|_|\s)/.test(client.getName())) throw new Error('COPIE_CLIENT_TEST_OBLIGATOIRE');
  } else if (sender.APP_MODE === 'PRODUCTION') {
    if (!/^BOXY_CLIENT\b/.test(client.getName()) ||
       props.getProperty('CONTROL_PROD_SYNC_CONFIRM') !== 'AUTORISE_CONTROL7') throw new Error('SYNC_PRODUCTION_NON_APPROUVEE');
  }
  control7Sheet_(client,'SUIVI_PUBLIC',CONTROL7_PUBLIC_);
  control7Sheet_(client,'OCCUPATIONS_PHOTO',CONTROL7_OCCUPATIONS_);
  control7Sheet_(client,'INSCRIPTIONS',['inscription_id','code_public','cree_le_utc','code_prestation']);
}

function control7Settings_(workbook) {
  const sh = workbook.getSheetByName('PARAMETRES');if (!sh) throw new Error('SCHEMA_CLIENT_ABSENT');
  const raw = sh.getDataRange().getDisplayValues();
  if (raw[0][0] !== 'cle' || raw[0][1] !== 'valeur') throw new Error('SCHEMA_CLIENT_INCOMPATIBLE');
  return Object.fromEntries(raw.slice(1).filter(r => r[0]).map(r => [String(r[0]),String(r[1])]));
}

function control7Sheet_(book,name,head) {
  const sheet = book.getSheetByName(name);
  if (!sheet || sheet.getMaxColumns() < head.length) throw new Error('SCHEMA_'+name+'_ABSENT');
  const actual = sheet.getRange(1,1,1,head.length).getDisplayValues()[0];
  if (head.some((v,i)=>v!==actual[i])) throw new Error('SCHEMA_'+name+'_INCOMPATIBLE');
  return sheet;
}

function control7Read_(book,name,head) {
  const sh = control7Sheet_(book,name,head);
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  if (n > 30000) throw new Error('LIMITATION_VOLUME_A_REVOIR');
  return sh.getRange(2,1,n,head.length).getDisplayValues().map((r,i) =>
     Object.assign(Object.fromEntries(head.map((k,j)=>[k,r[j]])),{_row:i+2}))
    .filter(x => x[head[0]]);
}

function control7AssertEvent_(out,event) {
  if (!event || out.evenement_id!==event.evenement_id ||
    out.inscription_id !== event.inscription_id || out.code_public !== event.code_public ||
    Number(out.version) !== Number(event.version) ||
    !Number.isSafeInteger(Number(event.version)) || Number(event.version)<1 ||
    !/^RSE-[A-Za-z0-9_-]{8,100}$/.test(event.evenement_id) ||
    !/^RSV-[A-Za-z0-9_-]{8,100}$/.test(event.reservation_id) ||
    !/^[A-Za-z0-9_-]{6,120}$/.test(event.inscription_id) ||
    !/^BXR-[A-Z0-9]{5,16}$/.test(event.code_public) ||
    !['CONFIRMEE','A_REPLANIFIER','ANNULEE'].includes(event.statut_apres) ||
    !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(event.horodatage_utc)) throw new Error('EVENEMENT_INVALIDE');
  if (event.statut_apres === 'CONFIRMEE' &&
   (!/^\d{4}-\d{2}-\d{2}$/.test(event.date_confirmee) ||
    !/^\d{2}:\d{2}$/.test(event.heure_debut) ||
    !/^\d{2}:\d{2}$/.test(event.heure_fin))) throw new Error('EVENEMENT_INVALIDE');
}

function control7CheckOrigin_(client,event) {
  const sh=control7Sheet_(client,'INSCRIPTIONS',['inscription_id','code_public','cree_le_utc','code_prestation']);
  const end=sh.getLastRow();if(end<2)throw new Error('INSCRIPTION_INTROUVABLE');
  const values=sh.getRange(2,1,end-1,4).getDisplayValues();
  const matches=values.filter(r=>r[0]===event.inscription_id && r[1]===event.code_public);
  if(matches.length!==1||matches[0][3].toUpperCase()!=='SHOOTING')throw new Error('INSCRIPTION_INVALIDE');
}

/** Pure plan helpers; they never perform Spreadsheet writes. */
function control7VersionDecision_(currentVersion,currentId,event) {
  const v=Number(event.version);
  if (!Number.isSafeInteger(v) || v<1) throw new Error('VERSION_INVALIDE');
  if (!currentVersion && !currentId) return 'ECRIRE';
  const old=Number(currentVersion);
  if (!Number.isSafeInteger(old)||old<1)throw new Error('PROJECTION_ANCIENNE_A_AUDITER');
  if (old > v) return 'IGNORE_ANCIEN';
  if (old === v) {
    if(currentId===event.evenement_id)return 'DEJA_APPLIQUE';
    throw new Error('CONFLIT_VERSION_PROJECTION');
  }
  return 'ECRIRE';
}

function control7PlanPublic_(existing,event) {
  const prev=existing||[];
  if (prev.length && prev[0]!==event.inscription_id) throw new Error('CONFLIT_IDENTIFIANT');
  if(prev[7] && prev[7]!==event.reservation_id)throw new Error('CONFLIT_RESERVATION');
  const decision=control7VersionDecision_(prev[8]||'',prev[9]||'',event);
  const newState=event.statut_apres;
  return {decision,values:[event.inscription_id,newState,newState,prev[3]||'NON_RENSEIGNE',
    newState==='CONFIRMEE'?event.date_confirmee:'',
    newState==='CONFIRMEE'?event.heure_debut:'',event.horodatage_utc,
    event.reservation_id,String(event.version),event.evenement_id]};
}

function control7PlanOccupation_(existing,event) {
  const prev=existing||[];
  if(prev.length && prev[0]!==event.reservation_id)throw new Error('CONFLIT_RESERVATION');
  const decision=control7VersionDecision_(prev[8]||'',prev[9]||'',event);
  const live=event.statut_apres==='CONFIRMEE';
  return {decision,values:[event.reservation_id,live?event.date_confirmee:(prev[1]||''),
    live?event.heure_debut:(prev[2]||''),live?event.heure_fin:(prev[3]||''),
    event.reservation_id,event.statut_apres,live?'OUI':'NON',event.horodatage_utc,
    String(event.version),event.evenement_id]};
}

function control7UniqueRow_(sheet,head,id) {
  const rows=sheet.getLastRow()-1;
  if(rows<=0)return {index:0,values:null};
  const all=sheet.getRange(2,1,rows,head.length).getDisplayValues();
  let found=null;
  for(let i=0;i<all.length;i++)if(all[i][0]===id){
    if(found)throw new Error('DOUBLON_PROJECTION');found={index:i+2,values:all[i]};
  }
  return found||{index:0,values:null};
}

function control7ApplyOne_(sheet,head,key,event,planner) {
  const existing=control7UniqueRow_(sheet,head,key);
  const p=planner(existing.values,event);
  if(p.decision==='ECRIRE'){
    if(existing.index)sheet.getRange(existing.index,1,1,head.length).setValues([p.values]);
    else sheet.appendRow(p.values);
    SpreadsheetApp.flush();
  }
  return p.decision;
}

function control7Project_(client,event) {
  const pub=control7Sheet_(client,'SUIVI_PUBLIC',CONTROL7_PUBLIC_);
  const occ=control7Sheet_(client,'OCCUPATIONS_PHOTO',CONTROL7_OCCUPATIONS_);
  const a=control7ApplyOne_(pub,CONTROL7_PUBLIC_,event.inscription_id,event,control7PlanPublic_);
  const b=control7ApplyOne_(occ,CONTROL7_OCCUPATIONS_,event.reservation_id,event,control7PlanOccupation_);
  return {statut:a,occupation:b};
}

function control7Ack_(outSheet,out,statut,err) {
  const now=new Date().toISOString();
  const n=Number(out.nb_essais||0)+1;
  const values=[statut,String(out.version),out.cle_idempotence,out.cree_utc,now,
    statut==='ACQUITTE'?now:'',n,err||''];
  outSheet.getRange(out._row,5,1,8).setValues([values]);
  SpreadsheetApp.flush();
}

function control7SafeError_(error) {
  const code=String(error&&error.message||'ERREUR_SYNC');
  return /^[A-Z0-9_]{3,60}$/.test(code)?code:'ERREUR_SYNC';
}
function control7Incident_(book,out,code){
  const sheet=control7Sheet_(book,'INCIDENTS_SYNC_LOT7',CONTROL7_INCIDENTS_);
  const now=new Date().toISOString();
  const rows=control7Read_(book,'INCIDENTS_SYNC_LOT7',CONTROL7_INCIDENTS_);
  const old=rows.find(r=>r.flux==='CLIENT'&&r.evenement_id===out.evenement_id&&r.code_erreur===code&&r.statut==='OUVERT');
  if(old){sheet.getRange(old._row,7,1,3).setValues([[Number(old.tentatives||0)+1,old.cree_utc,now]]);return;}
  sheet.appendRow(['INC-'+Utilities.getUuid(),'CLIENT',out.evenement_id,'SUIVI_PUBLIC+OCCUPATIONS_PHOTO',
    code,'ERREUR',1,now,now,'OUVERT','Aucune donnée personnelle conservée']);
}

/** Diagnostics read-only, available only from Apps Script editor. */
function diagnostiquerIntegrationControlLot7_() {
  const book=controlWorkbook_(),s=readControlSettings_(book);
  const inClient=control7Read_(book,'SYNC_CLIENT',CONTROL7_OUTBOX_CLIENT_);
  const admins=control7Read_(book,'SYNC_ADMIN',[
    'evenement_id','transaction_id','type_projection','statut','version','cle_idempotence',
    'cree_utc','envoye_utc','accuse_utc','nb_essais','erreur_securisee']);
  return {release:CONTROL7_VERSION_,mode:s.APP_MODE,
    syncClientBloquee:s.SYNC_CLIENT_ACTIVE!=='OUI'||s.SYNC_LOT7_AUTORISE!=='OUI',
    transactionsBloquees:s.PAIEMENTS_ACTIFS!=='OUI',
    adminConnecte: false, // ADMIN non créé ; aucun envoi dans ce lot
    outboxClient:inClient.length,clientEnAttente:inClient.filter(e=>e.statut!=='ACQUITTE').length,
    outboxAdmin:admins.length,adminEnAttente:admins.filter(e=>e.statut!=='ACQUITTE').length};
}

/** Contrat seulement. Ne jamais prétendre à une liaison réelle avec BOXY ADMIN. */
function synchroniserAdminLot7_(){throw new Error('BOXY_ADMIN_NON_CONNECTE');}
