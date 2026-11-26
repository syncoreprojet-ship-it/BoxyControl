/**
 * BOXY CONTROL - LOT 4/7. Shooting check-in and check-out.
 * POINTAGES_PHOTO is the sole append-only authority for presence events.
 * ETAT_PRESENCE_PHOTO is only a repairable view. No changes to BOXY_CLIENT.
 * Sensitive calls require a fresh Google identity check on every request.
 */
const PHOTO4_VERSION_ = '4.0.0-rc1';
const PHOTO4_EVENT_KEYS_ = [
  'pointage_id','inscription_id','code_public','type_mouvement',
  'heure_evenement_utc','agent_id','cle_idempotence','observation',
  'reservation_id','visite_id','version_reservation','version_presence',
  'empreinte_requete','origine_saisie','jour_local'
];
const PHOTO4_VIEW_KEYS_ = [
  'inscription_id','code_public','reservation_id','statut_presence',
  'heure_arrivee_utc','heure_depart_utc','agent_arrivee_id','agent_depart_id',
  'version_presence','dernier_pointage_id','maj_utc','date_reservation',
  'version_reservation'
];

/** Authorized read, with the same audit as the existing search operation. */
function controlPhotoGetPresence(idToken, codeInput) {
  const base = controlPhotoGetReservation(idToken, codeInput);
  if (!base || !base.ok || !base.found) return base;
  // controlPhotoGetReservation already verifies identity, permission, quota and audit.
  const book = controlWorkbook_();
  const events = photo4Journal_(book);
  const lastBooking = photo3Latest_(book, base.dossier.inscriptionId);
  const state = photo4BuildState_(events, base.dossier.inscriptionId,
    lastBooking ? lastBooking.reservation_id : '');
  return {
    ok:true, found:true, dossier:base.dossier, reservation:base.reservation,
    ressources:base.ressources, presence:photo4Public_(state),
    release:PHOTO4_VERSION_
  };
}

/** Main write path. All checks and appends occur under one Apps Script lock. */
function controlPhotoApplyPointage(idToken, input) {
  const ctx = requireControlPermission_(idToken, 'POINTAGE_PHOTO');
  const cfg = ctx.settings;
  if (!['TEST','PRODUCTION'].includes(cfg.APP_MODE) ||
      cfg.POINTAGE_PHOTO_ACTIF !== 'OUI' ||
      cfg.POINTAGE_RESERVATION_CONFIRMEE !== 'OUI') {
    throw new Error('POINTAGE_DESACTIVE');
  }
  const props = PropertiesService.getScriptProperties();
  if (cfg.APP_MODE === 'TEST' && props.getProperty('CONTROL_USE_TEST_SHEET') !== 'OUI') {
    throw new Error('COPIE_CONTROL_TEST_OBLIGATOIRE');
  }
  if (cfg.APP_MODE === 'PRODUCTION' && props.getProperty('CONTROL_USE_TEST_SHEET') === 'OUI') {
    throw new Error('CONFIGURATION_ENVIRONNEMENT_INCOHERENTE');
  }
  const req = photo4Normalize_(input);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('SERVICE_OCCUPE');
  try {
    const source = photo3FindClient_(cfg, req.code);
    const booking = photo3Latest_(ctx.book, source.inscriptionId);
    const events = photo4Journal_(ctx.book);
    const hash = photo4Hash_(req);
    const replay = events.find(e => e.cle_idempotence === req.cle);
    if (replay) {
      if (replay.empreinte_requete !== hash || replay.agent_id !== ctx.agent.agentId ||
          replay.inscription_id !== source.inscriptionId) throw new Error('CLE_DEJA_UTILISEE');
      const state = photo4BuildState_(events,source.inscriptionId,replay.reservation_id);
      const warnings = [];
      try {photo4RepairView_(ctx.book, state, booking);} catch (e) {warnings.push('PROJECTION_A_RECONCILIER');}
      return {ok:true,replay:true,presence:photo4Public_(state),avertissements:warnings,release:PHOTO4_VERSION_};
    }
    if (!booking || booking.statut_apres !== 'CONFIRMEE') throw new Error('RESERVATION_NON_CONFIRMEE');
    if (req.versionReservation !== Number(booking.version)) throw new Error('RESERVATION_MODIFIEE');
    const state = photo4BuildState_(events, source.inscriptionId, booking.reservation_id);
    if (state.version !== req.versionAttendue) throw new Error('PRESENCE_MODIFIEE_RECHARGER');
    if (req.type === 'ARRIVEE' && state.statut !== 'PAS_ARRIVE') throw new Error('ARRIVEE_DEJA_ENREGISTREE');
    if (req.type === 'DEPART' && state.statut !== 'SUR_PLACE') throw new Error('DEPART_IMPOSSIBLE');
    const now = new Date();
    const nowUtc = now.toISOString();
    const localDay = Utilities.formatDate(now, 'Africa/Bamako', 'yyyy-MM-dd');
    if (req.type === 'ARRIVEE' && String(booking.date_confirmee) !== localDay) {
      throw new Error('DATE_SHOOTING_DIFFERENTE');
    }
    if (req.type === 'DEPART') {
      const age = (now.getTime() - new Date(state.arriveeUtc).getTime()) / 3600000;
      const lim = Number(cfg.POINTAGE_MAX_HEURES_DEPART || 24);
      if (!Number.isFinite(age) || age < 0 || age > Math.min(72,Math.max(1,lim))) {
        throw new Error('DEPART_HORS_DELAI');
      }
    }
    const event = {
      pointage_id:'PTG-'+Utilities.getUuid(), inscription_id:source.inscriptionId,
      code_public:req.code, type_mouvement:req.type, heure_evenement_utc:nowUtc,
      agent_id:ctx.agent.agentId, cle_idempotence:req.cle, observation:req.observation,
      reservation_id:booking.reservation_id,
      visite_id:state.visiteId || 'VIS-'+Utilities.getUuid(),
      version_reservation:Number(booking.version),
      version_presence:state.version+1, empreinte_requete:hash,
      origine_saisie:req.origine, jour_local:localDay
    };
    const journal = ctx.book.getSheetByName('POINTAGES_PHOTO');
    if (!journal) throw new Error('POINTAGES_INDISPONIBLES');
    photo3AssertHeader_(journal, PHOTO4_EVENT_KEYS_);
    // One append under the lock is authoritative. No second payment or client write.
    journal.appendRow(PHOTO4_EVENT_KEYS_.map(k=>event[k]));
    SpreadsheetApp.flush();
    const newState = photo4BuildState_(events.concat([event]),source.inscriptionId,booking.reservation_id);
    const warnings=[];
    try {photo4RepairView_(ctx.book,newState,booking);} catch(e) {warnings.push('PROJECTION_A_RECONCILIER');}
    try {photo4Audit_(ctx.book,ctx.agent.agentId,source.inscriptionId,event);} catch(e) {warnings.push('AUDIT_A_RECONCILIER');}
    return {ok:true,replay:false,presence:photo4Public_(newState),avertissements:warnings,release:PHOTO4_VERSION_};
  } finally {
    lock.releaseLock();
  }
}

function photo4Normalize_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('DONNEES_INVALIDES');
  const code=normaliserCodePhoto_(input.code);
  const type=String(input.type||'').trim().toUpperCase();
  const cle=String(input.cleIdempotence||'').trim();
  const observation=String(input.observation||'').trim();
  const origine=String(input.origine||'SAISIE').trim().toUpperCase();
  if (input.versionAttendue === '' || input.versionAttendue == null || input.versionReservation === '' || input.versionReservation == null) {
    throw new Error('VERSION_INVALIDE');
  }
  const versionAttendue=Number(input.versionAttendue);
  const versionReservation=Number(input.versionReservation);
  if (!code || !['ARRIVEE','DEPART'].includes(type)) throw new Error('DONNEES_INVALIDES');
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(cle)) throw new Error('CLE_INVALIDE');
  if (!['QR','SAISIE'].includes(origine)) throw new Error('ORIGINE_INVALIDE');
  if (!Number.isInteger(versionAttendue) || versionAttendue<0 || versionAttendue>100000 ||
      !Number.isInteger(versionReservation) || versionReservation<1 || versionReservation>100000) {
    throw new Error('VERSION_INVALIDE');
  }
  if (observation.length>220 || /[<>\x00-\x1f]/.test(observation) || /^[=+@-]/.test(observation)) {
    throw new Error('OBSERVATION_INVALIDE');
  }
  return {code,type,cle,observation,origine,versionAttendue,versionReservation};
}
function photo4Hash_(req) {
  const raw=JSON.stringify([req.code,req.type,req.observation,req.origine,
    req.versionAttendue,req.versionReservation]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw,Utilities.Charset.UTF_8)
    .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function photo4Journal_(book) {
  const sheet=book.getSheetByName('POINTAGES_PHOTO');
  if (!sheet) throw new Error('POINTAGES_INDISPONIBLES');
  photo3AssertHeader_(sheet,PHOTO4_EVENT_KEYS_);
  const rows=sheet.getDataRange().getDisplayValues();
  return rows.slice(1).filter(r=>String(r[0]||'').trim()).map(r=>{
    const x={}; PHOTO4_EVENT_KEYS_.forEach((k,i)=>x[k]=String(r[i]??''));return x;
  });
}
/** Strict sequence prevents an invalid old row from being misinterpreted. */
function photo4BuildState_(events,inscriptionId,reservationId) {
  const list=events.filter(e=>e.inscription_id===inscriptionId &&
    (!reservationId || e.reservation_id===reservationId));
  if (!list.length) return {statut:'PAS_ARRIVE',version:0,visiteId:'',arriveeUtc:'',departUtc:'',agentArrivee:'',agentDepart:'',lastId:'',inscriptionId,reservationId};
  let expected='ARRIVEE';let visiteId='';let arriveeUtc='',departUtc='',agentArrivee='',agentDepart='';
  for (let i=0;i<list.length;i++) {
    const e=list[i];
    if (e.type_mouvement!==expected || Number(e.version_presence)!==i+1 ||
        !e.visite_id || (visiteId && visiteId!==e.visite_id) ||
        e.reservation_id!==reservationId) throw new Error('JOURNAL_POINTAGE_INCOHERENT');
    visiteId=e.visite_id;
    if (expected==='ARRIVEE') {arriveeUtc=e.heure_evenement_utc;agentArrivee=e.agent_id;expected='DEPART';}
    else {departUtc=e.heure_evenement_utc;agentDepart=e.agent_id;expected='TERMINE';}
  }
  const last=list[list.length-1];
  return {statut:departUtc?'PARTI':'SUR_PLACE',version:list.length,visiteId,
    arriveeUtc,departUtc,agentArrivee,agentDepart,lastId:last.pointage_id,
    inscriptionId,reservationId,code:last.code_public};
}
function photo4Public_(s) {
  return {statut:s.statut,version:s.version,arriveeUtc:s.arriveeUtc,
    departUtc:s.departUtc,reservationId:s.reservationId||'',
    visiteId:s.visiteId||''};
}
/** A snapshot is repairable: the append-only journal remains authoritative. */
function photo4RepairView_(book,state,booking) {
  if (!state.version) return;
  const sheet=book.getSheetByName('ETAT_PRESENCE_PHOTO');
  if (!sheet) throw new Error('PROJECTION_INDISPONIBLE');
  photo3AssertHeader_(sheet,PHOTO4_VIEW_KEYS_);
  const rows=sheet.getDataRange().getDisplayValues();
  const hits=[];
  rows.slice(1).forEach((r,i)=>{if(r[0]===state.inscriptionId)hits.push(i+2);});
  if(hits.length>1)throw new Error('PROJECTION_DUPLIQUEE');
  const out={inscription_id:state.inscriptionId,code_public:state.code,
    reservation_id:state.reservationId,statut_presence:state.statut,
    heure_arrivee_utc:state.arriveeUtc,heure_depart_utc:state.departUtc,
    agent_arrivee_id:state.agentArrivee,agent_depart_id:state.agentDepart,
    version_presence:state.version,dernier_pointage_id:state.lastId,
    maj_utc:new Date().toISOString(),date_reservation:booking?booking.date_confirmee:'',
    version_reservation:booking?Number(booking.version):''};
  const vals=PHOTO4_VIEW_KEYS_.map(k=>out[k]);
  if(hits.length)sheet.getRange(hits[0],1,1,vals.length).setValues([vals]);
  else sheet.appendRow(vals);
}
function photo4Audit_(book,agentId,inscriptionId,event) {
  const sheet=book.getSheetByName('AUDIT');
  if (!sheet) throw new Error('AUDIT_INDISPONIBLE');
  sheet.appendRow(['AUD-'+Utilities.getUuid(),event.heure_evenement_utc,agentId,
    'POINTAGE_PHOTO_'+event.type_mouvement,inscriptionId,'','ENREGISTRE',
    event.pointage_id,event.empreinte_requete.slice(0,20),'Journal POINTAGES_PHOTO autoritaire']);
}
/** Run manually from Apps Script editor only. No payment, no client sync. */
function reconcilerPointagesPhoto_() {
  const book=controlWorkbook_();
  const events=photo4Journal_(book);
  const inscriptionIds=Array.from(new Set(events.map(x=>x.inscription_id)));
  let fixed=0;const failures=[];
  inscriptionIds.forEach(id=>{
    try {
      const booking=photo3Latest_(book,id);
      const relevant=events.filter(e=>e.inscription_id===id);
      const resId=relevant[relevant.length-1].reservation_id;
      const state=photo4BuildState_(events,id,resId);
      photo4RepairView_(book,state,booking);fixed++;
    } catch(err) {failures.push({inscription_id:id,erreur:String(err.message||err)});}
  });
  return {lignesReparees:fixed,problemes:failures};
}
