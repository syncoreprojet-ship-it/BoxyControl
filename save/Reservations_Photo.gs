/**
 * BOXY CONTROL - LOT 3/7. Reservation operations for SHOOTING only.
 * HISTORY is the authoritative append-only decision log. RESERVATIONS_PHOTO
 * and SYNC_CLIENT are repairable projections. Never writes to BOXY_CLIENT.
 * Mutations require Google OIDC + active supervisor permission + global locks.
 */
const PHOTO3_VERSION_ = '3.0.0-rc1';
const PHOTO3_ACTIONS_ = ['CONFIRMER', 'REPORTER', 'ANNULER'];
const PHOTO3_EVENT_KEYS_ = [
  'evenement_id','reservation_id','inscription_id','code_public','action',
  'statut_avant','statut_apres','date_confirmee','heure_debut','heure_fin',
  'date_proposee','heure_debut_proposee','heure_fin_proposee','ressource_id',
  'agent_id','motif','cle_idempotence','version','horodatage_utc',
  'source_client_maj_utc','empreinte_requete'
];
const PHOTO3_PROJECTION_KEYS_ = [
  'reservation_id','inscription_id','code_public','statut_reservation',
  'date_confirmee','heure_debut','heure_fin','lieu','agent_responsable_id',
  'conflit_verifie_utc','version','maj_utc','motif_statut','ressource_id',
  'date_proposee','heure_debut_proposee','heure_fin_proposee','dernier_evenement_id'
];

/** Authorized, audited read; operations may remain locked. */
function controlPhotoGetReservation(idToken, codeInput) {
  const lookup = controlLookupPhoto(idToken, codeInput);
  if (!lookup.ok || !lookup.found) return lookup;
  const book = controlWorkbook_();
  const state = photo3Latest_(book, lookup.dossier.inscriptionId);
  const resources = photo3Resources_(book, true);
  return {
    ok:true, found:true, dossier:lookup.dossier,
    reservation:photo3Public_(state),
    ressources:resources.map(r=>({id:r.id,libelle:r.name,lieu:r.location})),
    release:PHOTO3_VERSION_
  };
}

/** The sole public mutation for the three reservation decisions. */
function controlPhotoApplyReservation(idToken, input) {
  const ctx = requireControlPermission_(idToken, 'CONFIRMER_RESERVATION');
  const settings = ctx.settings;
  if (!['TEST','PRODUCTION'].includes(settings.APP_MODE) ||
      settings.RESERVATIONS_PHOTO_ACTIVES !== 'OUI') throw new Error('RESERVATIONS_DESACTIVEES');
  const props = PropertiesService.getScriptProperties();
  if (settings.APP_MODE === 'TEST' && props.getProperty('CONTROL_USE_TEST_SHEET') !== 'OUI') {
    throw new Error('COPIE_CONTROL_TEST_OBLIGATOIRE');
  }
  if (settings.APP_MODE === 'PRODUCTION' && props.getProperty('CONTROL_USE_TEST_SHEET') === 'OUI') {
    throw new Error('CONFIGURATION_ENVIRONNEMENT_INCOHERENTE');
  }
  const req = photo3Normalize_(input);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('SERVICE_OCCUPE');
  try {
    const source = photo3FindClient_(settings, req.code);
    const snapshot = photo3History_(ctx.book);
    photo3AssertNoLegacy_(ctx.book,snapshot.events);
    const previousKey = snapshot.events.find(e=>e.cle_idempotence === req.cle);
    const hash = photo3Hash_(req);
    if (previousKey) {
      if (previousKey.empreinte_requete !== hash || previousKey.code_public !== req.code) {
        throw new Error('CLE_DEJA_UTILISEE');
      }
      const replayWarnings=[];
      try{photo3RepairProjection_(ctx.book, snapshot, source.inscriptionId);}catch(e){replayWarnings.push('PROJECTION_A_RECONCILIER');}
      try{photo3EnsureOutbox_(ctx.book, previousKey);}catch(e){replayWarnings.push('SYNC_A_RECONCILIER');}
      return {ok:true, replay:true, reservation:photo3Public_(photo3LatestFrom_(snapshot.events, source.inscriptionId)), avertissements:replayWarnings, release:PHOTO3_VERSION_};
    }
    const old = photo3LatestFrom_(snapshot.events, source.inscriptionId);
    const actualVersion = old ? Number(old.version) : 0;
    if (req.versionAttendue !== actualVersion) throw new Error('DOSSIER_MODIFIE_RECHARGER');
    if (old && old.statut_apres === 'ANNULEE') throw new Error('DOSSIER_DEJA_ANNULE');
    if (req.action !== 'ANNULER' && ['ANNULEE','REFUSEE'].includes(source.statut)) throw new Error('DEMANDE_CLIENT_ANNULEE');
    let resource = null;
    if (req.action === 'CONFIRMER') {
      resource = photo3ValidSlot_(ctx.book, settings, req, snapshot.events, source.inscriptionId);
    } else if (req.action === 'REPORTER' && req.date) {
      photo3ValidDate_(req.date, settings);
      photo3ValidHours_(req.debut,req.fin, settings);
      // Proposed slots are informative, never occupied or confirmed.
      if (req.resourceId) resource = photo3ResourceById_(ctx.book, req.resourceId);
    }
    const now = new Date().toISOString();
    const event = {
      evenement_id:'RSE-'+Utilities.getUuid(),
      reservation_id:old ? old.reservation_id : 'RSV-'+Utilities.getUuid(),
      inscription_id:source.inscriptionId,code_public:req.code,
      action:req.action,statut_avant:old ? old.statut_apres : 'EN_ATTENTE',
      statut_apres:req.action==='CONFIRMER'?'CONFIRMEE':req.action==='REPORTER'?'A_REPLANIFIER':'ANNULEE',
      date_confirmee:req.action==='CONFIRMER'?req.date:'',
      heure_debut:req.action==='CONFIRMER'?req.debut:'',
      heure_fin:req.action==='CONFIRMER'?req.fin:'',
      date_proposee:req.action==='REPORTER'?req.date:'',
      heure_debut_proposee:req.action==='REPORTER'?req.debut:'',
      heure_fin_proposee:req.action==='REPORTER'?req.fin:'',
      ressource_id:req.action==='ANNULER'?'':req.resourceId,
      agent_id:ctx.agent.agentId,motif:req.motif,cle_idempotence:req.cle,
      version:actualVersion+1,horodatage_utc:now,
      source_client_maj_utc:source.majUtc,empreinte_requete:hash
    };
    // A single append is the authority. No cross-sheet atomicity is assumed.
    const journal = ctx.book.getSheetByName('HISTORIQUE_RESERVATIONS');
    if (!journal) throw new Error('CONFIGURATION_INCOMPLETE');
    photo3AssertHeader_(journal,PHOTO3_EVENT_KEYS_);
    journal.appendRow(PHOTO3_EVENT_KEYS_.map(k=>event[k]));
    SpreadsheetApp.flush();
    // If a projection append fails, return a repair warning, never rebook.
    const warnings = [];
    const newSnapshot = {events:snapshot.events.concat([event])};
    try { photo3RepairProjection_(ctx.book, newSnapshot, source.inscriptionId); }
    catch(e) { warnings.push('PROJECTION_A_RECONCILIER'); }
    try { photo3EnsureOutbox_(ctx.book, event); }
    catch(e) { warnings.push('SYNC_A_RECONCILIER'); }
    try { photo3Audit_(ctx.book, ctx.agent.agentId, source.inscriptionId, event); }
    catch(e) { warnings.push('AUDIT_A_RECONCILIER'); }
    return {ok:true,replay:false,reservation:photo3Public_(event),avertissements:warnings,release:PHOTO3_VERSION_};
  } finally {lock.releaseLock();}
}

function photo3Normalize_(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('DONNEES_INVALIDES');
  const code = normaliserCodePhoto_(obj.code);
  const action=String(obj.action||'').toUpperCase().trim();
  const cle=String(obj.cleIdempotence||'').trim();
  if (!code || !PHOTO3_ACTIONS_.includes(action)) throw new Error('DONNEES_INVALIDES');
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(cle)) throw new Error('CLE_INVALIDE');
  if (!Number.isInteger(Number(obj.versionAttendue)) || Number(obj.versionAttendue)<0 ||
      Number(obj.versionAttendue)>100000) throw new Error('VERSION_INVALIDE');
  const req={code,action,cle,versionAttendue:Number(obj.versionAttendue),
    date:String(obj.date||'').trim(),debut:String(obj.heureDebut||'').trim(),
    fin:String(obj.heureFin||'').trim(),resourceId:String(obj.ressourceId||'').trim().toUpperCase(),
    motif:String(obj.motif||'').trim()};
  if (req.motif.length>350 || /[<>\x00-\x1f]/.test(req.motif) || /^[=+@-]/.test(req.motif)) throw new Error('MOTIF_INVALIDE');
  if (action==='CONFIRMER' && (!req.resourceId || !req.date || !req.debut || !req.fin)) throw new Error('CRENEAU_OBLIGATOIRE');
  if (action!=='CONFIRMER' && req.motif.length<8) throw new Error('MOTIF_OBLIGATOIRE');
  if (action==='REPORTER' && (Boolean(req.date)!==Boolean(req.debut) || Boolean(req.date)!==Boolean(req.fin) || (!req.date && req.resourceId))) throw new Error('CRENEAU_INCOMPLET');
  if (action==='ANNULER' && (req.date||req.debut||req.fin||req.resourceId)) throw new Error('DONNEES_INVALIDES');
  if (!/^[A-Z0-9_]{0,50}$/.test(req.resourceId)) throw new Error('RESSOURCE_INVALIDE');
  return req;
}

function photo3Hash_(r) {
  const key = JSON.stringify([r.code,r.action,r.date,r.debut,r.fin,r.resourceId,r.motif]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,key,Utilities.Charset.UTF_8)
    .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}

function photo3FindClient_(settings,code) {
  const src = ouvrirSourceClientPhoto_(settings); // mode TEST requires BOXY_CLIENT_TEST
  const sheet=src.getSheetByName('INSCRIPTIONS');
  if (!sheet) throw new Error('SOURCE_INDISPONIBLE');
  const rows=sheet.getDataRange().getDisplayValues();
  const head=rows[0]||[];
  const needed=['inscription_id','code_public','code_prestation','statut','maj_le_utc'];
  const at={};needed.forEach(k=>{at[k]=head.indexOf(k);if(at[k]<0)throw new Error('SCHEMA_CLIENT_INCOMPATIBLE');});
  const hits=rows.slice(1).filter(r=>String(r[at.code_public]||'').trim()===code);
  if (hits.length!==1 || String(hits[0][at.code_prestation]||'').trim().toUpperCase()!=='SHOOTING') throw new Error('DEMANDE_INTROUVABLE');
  const r=hits[0];if(!/^[A-Za-z0-9_-]{6,120}$/.test(String(r[at.inscription_id]||'').trim()))throw new Error('DOSSIER_INVALIDE');
  return {inscriptionId:String(r[at.inscription_id]).trim(),statut:String(r[at.statut]||'RECU').toUpperCase(),majUtc:String(r[at.maj_le_utc]||'')};
}

function photo3AssertHeader_(sheet,keys) {
  const h=sheet.getRange(1,1,1,keys.length).getDisplayValues()[0];
  if (keys.some((k,i)=>h[i]!==k)) throw new Error('SCHEMA_CONTROL_INCOMPATIBLE');
}
function photo3History_(book) {
  const sheet=book.getSheetByName('HISTORIQUE_RESERVATIONS');if(!sheet)throw new Error('CONFIGURATION_INCOMPLETE');
  photo3AssertHeader_(sheet,PHOTO3_EVENT_KEYS_);
  const rows=sheet.getDataRange().getDisplayValues().slice(1);
  const events=rows.filter(r=>r[0]).map(r=>Object.fromEntries(PHOTO3_EVENT_KEYS_.map((k,i)=>[k,r[i]])));
  return {events};
}
function photo3LatestFrom_(events,id) {
  let current=null;
  for(const e of events)if(e.inscription_id===id){
    if (!Number.isInteger(Number(e.version)) || Number(e.version)<1)throw new Error('JOURNAL_RESERVATION_INVALIDE');
    if (!current || Number(e.version)>Number(current.version))current=e;
    else if (Number(e.version)===Number(current.version) && e.evenement_id!==current.evenement_id)throw new Error('JOURNAL_RESERVATION_AMBIGU');
  }
  return current;
}
function photo3Latest_(book,id) {return photo3LatestFrom_(photo3History_(book).events,id);}
function photo3AssertNoLegacy_(book,events){
  const sheet=book.getSheetByName('RESERVATIONS_PHOTO');if(!sheet)throw new Error('CONFIGURATION_INCOMPLETE');
  photo3AssertHeader_(sheet,PHOTO3_PROJECTION_KEYS_);
  const known=new Set(events.map(e=>e.inscription_id));
  for(const r of sheet.getDataRange().getDisplayValues().slice(1)){
    if(r[1] && !known.has(r[1]))throw new Error('RESERVATION_HISTORIQUE_MANQUANT');
  }
}

function photo3Public_(e) {
  if (!e)return {statut:'EN_ATTENTE',version:0,dateConfirmee:'',heureDebut:'',heureFin:'',dateProposee:'',heureDebutProposee:'',heureFinProposee:'',ressourceId:'',evenementId:''};
  return {statut:e.statut_apres,version:Number(e.version),dateConfirmee:e.date_confirmee,
    heureDebut:e.heure_debut,heureFin:e.heure_fin,dateProposee:e.date_proposee,
    heureDebutProposee:e.heure_debut_proposee,heureFinProposee:e.heure_fin_proposee,
    ressourceId:e.ressource_id,evenementId:e.evenement_id};
}

function photo3Resources_(book, onlyActive) {
  const sheet=book.getSheetByName('RESSOURCES_PHOTO');if(!sheet)throw new Error('CONFIGURATION_INCOMPLETE');
  photo3AssertHeader_(sheet,['ressource_id','libelle','lieu_public','capacite_simultanee','validation','actif','note_interne']);
  const all=sheet.getDataRange().getDisplayValues().slice(1);
  return all.filter(r=>r[0]).map(r=>({id:r[0],name:r[1],location:r[2],capacity:Number(r[3]),validation:r[4],active:r[5]}))
    .filter(r=>!onlyActive || (r.active==='OUI' && r.validation==='VALIDE' && r.capacity===1));
}
function photo3ResourceById_(book,id) {
  const found=photo3Resources_(book,true).find(r=>r.id===id);
  if(!found)throw new Error('RESSOURCE_NON_VALIDEE');return found;
}
function photo3Time_(s) {
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(s))) throw new Error('HEURE_INVALIDE');
  const [h,m]=String(s).split(':').map(Number);return h*60+m;
}
function photo3ValidHours_(start,end,settings) {
  const a=photo3Time_(start),b=photo3Time_(end);
  const minimum=Number(settings.PHOTO_DUREE_MIN_RESERVATION||30);
  if(b<=a || b-a<Math.max(15,Math.min(180,minimum)) || b-a>480 || a%15 || b%15)throw new Error('HORAIRES_INVALIDES');
  return {a,b};
}
function photo3ValidDate_(date,settings){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('DATE_INVALIDE');
  const dt=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(dt.getTime()) || dt.toISOString().slice(0,10)!==date)throw new Error('DATE_INVALIDE');
  const today=Utilities.formatDate(new Date(),'Africa/Bamako','yyyy-MM-dd');
  const limit=Number(settings.PHOTO_HORIZON_RESERVATION_JOURS||90);
  const max=new Date(today+'T12:00:00Z');max.setUTCDate(max.getUTCDate()+Math.max(1,Math.min(365,limit)));
  if(date<today || dt>max)throw new Error('DATE_HORS_PLANNING');
  return {dt,weekday:dt.getUTCDay()||7};
}
function photo3Overlap_(a,b,c,d){return a<d && c<b;}
function photo3ValidSlot_(book,settings,req,events,inscriptionId){
  const res=photo3ResourceById_(book,req.resourceId);
  const dateInfo=photo3ValidDate_(req.date,settings);
  const times=photo3ValidHours_(req.debut,req.fin,settings);
  if(req.date===Utilities.formatDate(new Date(),'Africa/Bamako','yyyy-MM-dd')){
    const now=Utilities.formatDate(new Date(),'Africa/Bamako','HH:mm');if(req.debut<=now)throw new Error('HEURE_PASSEE');
  }
  const schedule=book.getSheetByName('PLAGES_CONTROL_PHOTO');if(!schedule)throw new Error('CONFIGURATION_INCOMPLETE');
  photo3AssertHeader_(schedule,['plage_id','ressource_id','jour_iso','heure_debut','heure_fin','validation','actif','note_interne']);
  const hasSlot=schedule.getDataRange().getDisplayValues().slice(1).some(r=>
    r[1]===req.resourceId && Number(r[2])===dateInfo.weekday && r[5]==='VALIDE' && r[6]==='OUI' &&
    photo3Time_(r[3])<=times.a && photo3Time_(r[4])>=times.b);
  if(!hasSlot)throw new Error('HORAIRE_NON_OUVERT');
  const blocks=book.getSheetByName('BLOCAGES_CONTROL_PHOTO');if(!blocks)throw new Error('CONFIGURATION_INCOMPLETE');
  photo3AssertHeader_(blocks,['blocage_id','ressource_id','date','heure_debut','heure_fin','motif_interne','validation','actif']);
  const blocked=blocks.getDataRange().getDisplayValues().slice(1).some(r=>{
    if(r[1]!==req.resourceId||r[2]!==req.date||r[6]!=='VALIDE'||r[7]!=='OUI')return false;
    if(!r[3]&&!r[4])return true;
    return photo3Overlap_(times.a,times.b,photo3Time_(r[3]),photo3Time_(r[4]));
  });
  if(blocked)throw new Error('CRENEAU_BLOQUE');
  const latest=new Map();for(const e of events){
    const prev=latest.get(e.inscription_id);
    if(!prev||Number(e.version)>Number(prev.version))latest.set(e.inscription_id,e);
  }
  for(const e of latest.values()){
    if(e.inscription_id===inscriptionId||e.statut_apres!=='CONFIRMEE'||e.ressource_id!==req.resourceId||e.date_confirmee!==req.date)continue;
    if(photo3Overlap_(times.a,times.b,photo3Time_(e.heure_debut),photo3Time_(e.heure_fin)))throw new Error('CRENEAU_DEJA_OCCUPE');
  }
  return res;
}

function photo3RepairProjection_(book,snapshot,inscriptionId){
  const event=photo3LatestFrom_(snapshot.events,inscriptionId);if(!event)return;
  const sheet=book.getSheetByName('RESERVATIONS_PHOTO');if(!sheet)throw new Error('CONFIGURATION_INCOMPLETE');
  photo3AssertHeader_(sheet,PHOTO3_PROJECTION_KEYS_);
  const rows=sheet.getDataRange().getDisplayValues(),matches=[];
  rows.slice(1).forEach((r,i)=>{if(r[1]===inscriptionId)matches.push(i+2);});
  if(matches.length>1)throw new Error('PROJECTION_RESERVATION_AMBIGUE');
  const loc=photo3Resources_(book,false).find(r=>r.id===event.ressource_id);
  const output=[event.reservation_id,event.inscription_id,event.code_public,event.statut_apres,
    event.date_confirmee,event.heure_debut,event.heure_fin,loc?loc.location:'',
    event.agent_id,event.horodatage_utc,Number(event.version),event.horodatage_utc,
    event.motif,event.ressource_id,event.date_proposee,event.heure_debut_proposee,
    event.heure_fin_proposee,event.evenement_id];
  if(matches.length){sheet.getRange(matches[0],1,1,output.length).setValues([output]);}
  else sheet.appendRow(output);
}
function photo3EnsureOutbox_(book,event) {
  const sheet=book.getSheetByName('SYNC_CLIENT');if(!sheet)throw new Error('CONFIGURATION_INCOMPLETE');
  photo3AssertHeader_(sheet,['evenement_id','inscription_id','code_public','type_projection','statut','version','cle_idempotence','cree_utc','envoye_utc','accuse_utc','nb_essais','erreur_securisee']);
  const rows=sheet.getDataRange().getDisplayValues();
  if(rows.slice(1).some(r=>r[0]===event.evenement_id))return;
  sheet.appendRow([event.evenement_id,event.inscription_id,event.code_public,
    'RESERVATION_PHOTO','A_ENVOYER',event.version,event.evenement_id,
    event.horodatage_utc,'','',0,'']);
}
function photo3Audit_(book,agentId,inscriptionId,event) {
  const sheet=book.getSheetByName('AUDIT');if(!sheet)throw new Error('AUDIT_INDISPONIBLE');
  photo3AssertHeader_(sheet,['audit_id','horodatage_utc','agent_id','action','inscription_id','transaction_id','resultat','correlation_id','empreinte_donnees','note_securisee']);
  sheet.appendRow(['AUD-'+Utilities.getUuid(),new Date().toISOString(),agentId,
    'RESERVATION_PHOTO_'+event.action,inscriptionId,'','OK',event.evenement_id,event.empreinte_requete.slice(0,20),'Decision historisee']);
}
/** Private repair, run by an administrator from the script editor only. */
function reconcilerReservationsPhoto_(){
  const book=controlWorkbook_();
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw new Error('SERVICE_OCCUPE');
  try{const snapshot=photo3History_(book);const ids=Array.from(new Set(snapshot.events.map(e=>e.inscription_id)));
    ids.forEach(id=>photo3RepairProjection_(book,snapshot,id));
    snapshot.events.forEach(e=>photo3EnsureOutbox_(book,e));
    return {dossiers:ids.length,evenements:snapshot.events.length};
  }finally{lock.releaseLock();}
}
/** Private diagnostics; no automatic enabling or payments. */
function diagnosticControlLot3_(){
 const book=controlWorkbook_(),s=readControlSettings_(book);
 return {version:PHOTO3_VERSION_,status:s.APP_MODE,
   verrou:s.RESERVATIONS_PHOTO_ACTIVES==='NON',
   ressourcesActives:photo3Resources_(book,true).length,
   decisions:photo3History_(book).events.length,
   sortiesClient:s.SYNC_CLIENT_ACTIVE==='OUI'};
}
