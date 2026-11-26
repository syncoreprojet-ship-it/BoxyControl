/**
 * BOXY CONTROL ACADÉMIE — LOT 4/6 : présences par séance et progression.
 * Candidat de recette privée, non déployé. Aucun accès en écriture à BOXY CLIENT.
 * Journal append-only HISTORIQUE_PRESENCES_ACADEMIE = source de vérité ;
 * ETAT_PRESENCES_ACADEMIE et PROGRESSION_ACADEMIE = projections réparables.
 */
const BOXY_ACADEMIE_LOT4_VERSION_ = '4.0.0-rc1';
const ACAD4_HEADERS_ = [
  'evenement_id','inscription_id','code_public','code_session','numero_seance',
  'action','statut_avant','statut_apres','agent_id','motif','cle_idempotence',
  'empreinte_requete','version_presence','cree_utc','version_decision','date_seance'
];
const ACAD4_STATUTS_ = ['PRESENT','RETARD','ABSENT','EXCUSE'];
const ACAD4_ACTIONS_ = ['POINTAGE','ABSENCE','EXCUSE','CORRECTION'];
const ACAD4_SEANCES_FIELDS_ = [
  'code_session','numero_seance','date_seance','heure_debut','heure_fin',
  'activite','lieu_seance','statut_seance','validation','actif'
];

function controlAcademiePresencesLot4(googleIdToken, codeSaisi) {
  const ctx = academyLot4Context_(googleIdToken, true);
  const code = normaliserCodePhoto_(codeSaisi);
  if (!code) throw new Error('CODE_INVALIDE');
  const client = ouvrirSourceClientPhoto_(ctx.settings);
  const dossier = academyLot3DossierClient_(client, code);
  if(dossier.statutDemande==='ANNULEE')throw new Error('DEMANDE_CLIENT_ANNULEE');
  const decisions = academyLot3Snapshot_(academyLot3ReadEvents_(ctx.book));
  const state = decisions[dossier.inscriptionId];
  if (!state || state.statut !== 'CONFIRMEE') throw new Error('INSCRIPTION_NON_CONFIRMEE');
  const session = academyLot4Session_(client, state.session);
  if (session.formation !== dossier.formationCode) throw new Error('SESSION_INCOHERENTE');
  academyLot4AuthorizeSession_(ctx, state.session);
  const seances = academyLot4Seances_(client, state.session);
  const snap = academyLot4Snapshot_(academyLot4ReadEvents_(ctx.book));
  const progress = academyLot4Progress_(dossier, state.session, seances, snap);
  academyLot4Audit_(ctx.book, ctx.agent.agentId, dossier.inscriptionId, 'CONSULTATION_PRESENCES', '');
  return {ok:true, code:dossier.code, formation:dossier.formationTitre,
    session:state.session, statutInscription:state.statut,
    versionDecision:state.version, seances:seances.map(s=>{
      const e=snap[academyLot4Key_(dossier.inscriptionId,state.session,s.numero)];
      return {numero:s.numero,date:s.date,debut:s.heureDebut,fin:s.heureFin,
        activite:s.activite,active:s.validee,statut:e?e.statut:'NON_RENSEIGNE',
        version:e?e.version:0,modifiable:academyLot4SeanceWindow_(s,'POINTAGE',ctx.settings)};
    }),
    progression:progress, correctionAutorisee:ctx.correcteur,
    paiement:'NON_VERIFIE',version:BOXY_ACADEMIE_LOT4_VERSION_};
}

/**
 * action POINTAGE / ABSENCE / EXCUSE / CORRECTION.
 * statut PRESENT|RETARD pour POINTAGE, ABSENT pour ABSENCE, EXCUSE pour EXCUSE,
 * n'importe lequel pour CORRECTION (superviseur + motif >= 8 caractères).
 * Une seule première décision par participant/séance. Toute correction append un événement.
 */
function controlAcademieMarquerPresenceLot4(googleIdToken, demande) {
  const ctx = academyLot4Context_(googleIdToken, false);
  const req = academyLot4Normalize_(demande);
  if (req.action === 'CORRECTION' && (!ctx.correcteur || ctx.settings.ACADEMIE_CORRECTIONS_PRESENCES_ACTIVES!=='OUI'))
    throw new Error('CORRECTION_REFUSEE');
  if ((req.action === 'ABSENCE' || req.action === 'EXCUSE') && ctx.settings.ACADEMIE_ABSENCES_ACTIVES!=='OUI')
    throw new Error('ABSENCES_FERMEES');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('SERVICE_OCCUPE');
  try {
    const client = ouvrirSourceClientPhoto_(ctx.settings);
    const dossier = academyLot3DossierClient_(client,req.code);
    if(dossier.statutDemande==='ANNULEE')throw new Error('DEMANDE_CLIENT_ANNULEE');
    const decisions = academyLot3Snapshot_(academyLot3ReadEvents_(ctx.book));
    const current = decisions[dossier.inscriptionId];
    if (!current || current.statut !== 'CONFIRMEE') throw new Error('INSCRIPTION_NON_CONFIRMEE');
    if (req.versionDecision !== current.version) throw new Error('FICHE_PERIMEE');
    if (req.codeSession !== current.session) throw new Error('SESSION_CHANGEANTE');
    const session = academyLot4Session_(client,current.session);
    if (session.formation !== dossier.formationCode) throw new Error('SESSION_INCOHERENTE');
    academyLot4AuthorizeSession_(ctx,current.session);
    const seances=academyLot4Seances_(client,current.session);
    const seance=seances.find(s=>s.numero===req.numeroSeance);
    if (!seance || !seance.validee) throw new Error('SEANCE_NON_VALIDEE');
    const sheet=ctx.book.getSheetByName('HISTORIQUE_PRESENCES_ACADEMIE');
    if (!sheet) throw new Error('CONFIGURATION_PRESENCES_INCOMPLETE');
    const events=academyLot4ReadEvents_(ctx.book);
    const fp=academyLot4Fingerprint_(req);
    const duplicated=events.filter(e=>e.cle_idempotence===req.cleIdempotence);
    if (duplicated.length>1) throw new Error('JOURNAL_INCOHERENT');
    if (duplicated.length===1){
      const existing=duplicated[0];
      if(existing.empreinte_requete!==fp || existing.inscription_id!==dossier.inscriptionId)
        throw new Error('CLE_DEJA_UTILISEE');
      let projectionEnAttente=false;
      try{academyLot4Repair_(ctx.book,client,events);}catch(e){projectionEnAttente=true;}
      return {ok:true,rejoue:true,evenementId:existing.evenement_id,
        statut:existing.statut_apres,version:Number(existing.version_presence),projectionEnAttente};
    }
    const snap=academyLot4Snapshot_(events);
    const key=academyLot4Key_(dossier.inscriptionId,current.session,req.numeroSeance);
    const before=snap[key];
    const actual=before?before.version:0;
    if(req.versionAttendue!==actual)throw new Error('FICHE_PERIMEE');
    if(req.action==='CORRECTION' && !before) throw new Error('AUCUN_POINTAGE_A_CORRIGER');
    if(req.action!=='CORRECTION' && before) throw new Error('SEANCE_DEJA_RENSEIGNEE');
    if(!academyLot4SeanceWindow_(seance,req.action,ctx.settings))throw new Error('FENETRE_POINTAGE_FERMEE');
    const now=new Date().toISOString();
    const event={evenement_id:'ACAD-PRE-'+Utilities.getUuid(),inscription_id:dossier.inscriptionId,
      code_public:dossier.code,code_session:current.session,numero_seance:String(req.numeroSeance),
      action:req.action,statut_avant:before?before.statut:'NON_RENSEIGNE',statut_apres:req.statut,
      agent_id:ctx.agent.agentId,motif:req.motif,cle_idempotence:req.cleIdempotence,
      empreinte_requete:fp,version_presence:actual+1,cree_utc:now,
      version_decision:current.version,date_seance:seance.date};
    // Fail-closed: si le journal d'audit tombe, aucune écriture métier.
    academyLot4Audit_(ctx.book,ctx.agent.agentId,dossier.inscriptionId,req.action,event.evenement_id);
    sheet.appendRow(ACAD4_HEADERS_.map(k=>event[k]));events.push(event);
    let projectionEnAttente=false;
    try{academyLot4Repair_(ctx.book,client,events);}catch(e){projectionEnAttente=true;}
    return {ok:true,rejoue:false,evenementId:event.evenement_id,
      statut:event.statut_apres,version:event.version_presence,projectionEnAttente};
  } finally {lock.releaseLock();}
}

function academyLot4Context_(token,lecture) {
  const identity=verifyGoogleIdToken_(token);
  const book=controlWorkbook_();
  const agent=findEnabledAgent_(book,identity);
  const settings=readControlSettings_(book);
  const perms=loadRolePermissions_(book,agent.role);
  const test=PropertiesService.getScriptProperties().getProperty('CONTROL_USE_TEST_SHEET')==='OUI';
  if(!['TEST','PRODUCTION'].includes(settings.APP_MODE)|| (settings.APP_MODE==='TEST')!==test ||
     settings.ACADEMIE_RECHERCHE_SOURCE!=='CLIENT_SEUL'||
     settings.ACADEMIE_AUDIT_RECHERCHE_OBLIGATOIRE!=='OUI'||
     settings.ACADEMIE_PROGRESSION_LECTURE_ACTIVE!=='OUI')throw new Error('PRESENCES_ACADEMIE_FERMEES');
  const reader=perms.includes('CONSULTER_PRESENCES_ACADEMIE')||perms.includes('POINTAGE_ACADEMIE');
  if(!reader || (!lecture && (
       settings.OPERATIONS_ACTIVES!=='OUI'||settings.ACADEMIE_OPERATIONS_ACTIVES!=='OUI'||
       settings.ACADEMIE_PRESENCES_ACTIVES!=='OUI'||!perms.includes('POINTAGE_ACADEMIE'))))
    throw new Error('PRESENCES_ACADEMIE_FERMEES');
  const correcteur=['SUPERVISEUR','ADMIN_CONTROL'].includes(agent.role)&&
    perms.includes('CORRIGER_PRESENCE_ACADEMIE');
  return {book,agent,settings,correcteur};
}

function academyLot4AuthorizeSession_(ctx,codeSession) {
  if(['SUPERVISEUR','ADMIN_CONTROL'].includes(ctx.agent.role))return;
  const tab=ctx.book.getSheetByName('AFFECTATIONS_SESSIONS_ACADEMIE');
  if(!tab)throw new Error('AFFECTATIONS_INDISPONIBLES');
  const data=tab.getDataRange().getDisplayValues();
  const expected=['affectation_id','code_session','agent_id','fonction','actif','validation'];
  if(expected.some((s,i)=>data[0]?.[i]!==s))throw new Error('AFFECTATIONS_INDISPONIBLES');
  const active=data.slice(1).filter(r=>r[1]===codeSession&&r[2]===ctx.agent.agentId&&r[4]==='OUI'&&r[5]==='VALIDEE');
  if(active.length!==1)throw new Error('SESSION_NON_AFFECTEE');
  const allowed={FORMATEUR:['FORMATEUR'],ASSISTANT_FORMATION:['ASSISTANT_FORMATION','ACCUEIL'],AGENT:['ACCUEIL']};
  if(!(allowed[ctx.agent.role]||[]).includes(active[0][3]))throw new Error('SESSION_NON_AFFECTEE');
}

function academyLot4Session_(client,codeSession){
  const list=academyLot3Sessions_(client);
  const s=list[codeSession];
  // Une session complète ou fermée aux inscriptions peut toujours donner cours.
  if(!s||s.validation!=='VALIDEE'||!['OUVERTE','COMPLETE','FERMEE'].includes(s.statut))
    throw new Error('SESSION_NON_VALIDEE');
  return s;
}
function academyLot4Seances_(client,sessionCode){
  const rows=academyReadTable_(client,'SEANCES_ACADEMIE',ACAD4_SEANCES_FIELDS_,1000);
  const map={};
  for(const r of rows){
    if(String(r.code_session||'')!==sessionCode)continue;
    const n=Number(r.numero_seance),date=String(r.date_seance||'');
    const begin=String(r.heure_debut||''),end=String(r.heure_fin||'');
    const key=String(n);
    if(!Number.isInteger(n)||n<1||n>1000||map[key]||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d\d:\d\d$/.test(begin)||
      !/^\d\d:\d\d$/.test(end)||begin>=end)throw new Error('SEANCES_INCOHERENTES');
    map[key]={numero:n,date,heureDebut:begin,heureFin:end,activite:r.activite,
      validee:r.actif==='OUI'&&r.validation==='VALIDEE'&&
        ['PREVUE','TERMINEE'].includes(r.statut_seance)};
  }
  if(!Object.keys(map).length)throw new Error('SEANCES_INDISPONIBLES');
  return Object.values(map).sort((a,b)=>a.numero-b.numero);
}
function academyLot4SeanceWindow_(s,action,settings){
  if(!s.validee)return false;
  const start=Date.parse(s.date+'T'+s.heureDebut+':00Z');
  const end=Date.parse(s.date+'T'+s.heureFin+':00Z');
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return false;
  // Africa/Bamako = UTC+00 toute l'année.
  const now=Date.now();
  const before=Math.max(0,Math.min(180,Number(settings.ACADEMIE_POINTAGE_AVANT_MIN)||0))*60000;
  const after=Math.max(0,Math.min(720,Number(settings.ACADEMIE_POINTAGE_APRES_MIN)||0))*60000;
  if(action==='POINTAGE')return now>=start-before && now<=end+after;
  if(action==='ABSENCE'||action==='EXCUSE')return now>=end;
  if(action==='CORRECTION')return now>=start;
  return false;
}
function academyLot4Normalize_(input){
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('DEMANDE_INVALIDE');
  const code=normaliserCodePhoto_(input.code);
  const codeSession=String(input.codeSession||'').trim().toUpperCase();
  const numeroSeance=Number(input.numeroSeance);
  const action=String(input.action||'').trim().toUpperCase();
  const statut=String(input.statut||'').trim().toUpperCase();
  const cleIdempotence=String(input.cleIdempotence||'').trim();
  const motif=String(input.motif||'').trim().replace(/\s+/g,' ').slice(0,250);
  const versionAttendue=Number(input.versionAttendue),versionDecision=Number(input.versionDecision);
  if(!code||!/^[A-Z0-9_-]{3,80}$/.test(codeSession)||!Number.isInteger(numeroSeance)||numeroSeance<1||numeroSeance>1000||
    !ACAD4_ACTIONS_.includes(action)||!ACAD4_STATUTS_.includes(statut)||
    !/^[A-Za-z0-9_-]{12,100}$/.test(cleIdempotence)||
    !Number.isInteger(versionAttendue)||versionAttendue<0||versionAttendue>10000||
    !Number.isInteger(versionDecision)||versionDecision<1||versionDecision>10000||
    /^[=+@\-]/.test(motif)|| (action==='CORRECTION'&&motif.length<8)||
    (action==='POINTAGE'&&!['PRESENT','RETARD'].includes(statut))||
    (action==='ABSENCE'&&statut!=='ABSENT')||(action==='EXCUSE'&&statut!=='EXCUSE'))
    throw new Error('DEMANDE_INVALIDE');
  return {code,codeSession,numeroSeance,action,statut,cleIdempotence,motif,versionAttendue,versionDecision};
}
function academyLot4Fingerprint_(p){
  const secret=String(PropertiesService.getScriptProperties().getProperty('AUDIT_HASH_SECRET')||'');
  if(secret.length<32)throw new Error('AUDIT_NON_CONFIGURE');
  const payload=[p.code,p.codeSession,p.numeroSeance,p.action,p.statut,p.motif,p.versionAttendue,p.versionDecision].join('|');
  return Utilities.computeHmacSha256Signature(payload,secret)
    .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function academyLot4Key_(id,session,num){return [id,session,String(num)].join('|');}
function academyLot4ReadEvents_(book){
  const tab=book.getSheetByName('HISTORIQUE_PRESENCES_ACADEMIE');
  if(!tab||tab.getLastRow()<1||tab.getLastRow()>10001)throw new Error('SCHEMA_PRESENCES_INDISPONIBLE');
  const header=tab.getRange(1,1,1,ACAD4_HEADERS_.length).getDisplayValues()[0];
  if(ACAD4_HEADERS_.some((h,i)=>header[i]!==h))throw new Error('SCHEMA_PRESENCES_INDISPONIBLE');
  if(tab.getLastRow()===1)return [];
  return tab.getRange(2,1,tab.getLastRow()-1,ACAD4_HEADERS_.length).getDisplayValues()
    .filter(r=>r[0]).map(row=>Object.fromEntries(ACAD4_HEADERS_.map((h,i)=>[h,String(row[i]||'').trim()])));
}
function academyLot4Snapshot_(events){
  const states={},eventIds=new Set(),ids=new Set();
  for(const e of events){
    const key=academyLot4Key_(e.inscription_id,e.code_session,e.numero_seance);
    const old=states[key],v=Number(e.version_presence);
    if(!e.evenement_id||!e.inscription_id||!e.code_session||!e.numero_seance||
      eventIds.has(e.evenement_id)||!e.cle_idempotence||ids.has(e.cle_idempotence)||
      !ACAD4_ACTIONS_.includes(e.action)||!ACAD4_STATUTS_.includes(e.statut_apres)||
      !Number.isInteger(v)||v!==(old?old.version+1:1)||
      (old && old.statut!==e.statut_avant)||(!old&&e.statut_avant!=='NON_RENSEIGNE')||
      (!old && e.action==='CORRECTION')||(old && e.action!=='CORRECTION'))throw new Error('JOURNAL_PRESENCES_INCOHERENT');
    eventIds.add(e.evenement_id);ids.add(e.cle_idempotence);
    states[key]={id:e.inscription_id,code:e.code_public,session:e.code_session,
      numero:Number(e.numero_seance),date:e.date_seance,statut:e.statut_apres,version:v,
      dernierEvenement:e.evenement_id,agent:e.agent_id,maj:e.cree_utc};
  }
  return states;
}
function academyLot4Progress_(dossier,session,seances,snapshot){
  const active=seances.filter(s=>s.validee);
  let present=0,retard=0,absence=0,excuse=0;
  for(const s of active){
    const item=snapshot[academyLot4Key_(dossier.inscriptionId,session,s.numero)];
    if(!item)continue;
    if(item.statut==='PRESENT')present++;
    if(item.statut==='RETARD')retard++;
    if(item.statut==='ABSENT')absence++;
    if(item.statut==='EXCUSE')excuse++;
  }
  const total=active.length,recorded=present+retard+absence+excuse;
  return {prevues:total,presences:present,retards:retard,absences:absence,excusees:excuse,
    renseignees:recorded,restantes:Math.max(0,total-recorded),
    tauxPresence:total?Math.round(100*(present+retard)/total):0,
    statut:!recorded?'NON_COMMENCEE':recorded===total?'BILAN_COMPLET':'EN_COURS'};
}
function academyLot4Audit_(book,agentId,inscriptionId,action,eventId){
  const tab=book.getSheetByName('AUDIT');if(!tab)throw new Error('AUDIT_INDISPONIBLE');
  try{tab.appendRow(['AUD-'+Utilities.getUuid(),new Date().toISOString(),agentId,
    'PRESENCE_ACADEMIE_'+action,inscriptionId,'','INTENTION','',eventId,
    'LOT4 : vérification avant écriture dans le journal des présences']);}
  catch(err){throw new Error('AUDIT_INDISPONIBLE');}
}
function academyLot4Repair_(book,client,events){
  const attendance=book.getSheetByName('ETAT_PRESENCES_ACADEMIE');
  const progress=book.getSheetByName('PROGRESSION_ACADEMIE');
  if(!attendance||!progress)throw new Error('PROJECTIONS_INDISPONIBLES');
  const snap=academyLot4Snapshot_(events);
  const rows=Object.values(snap).map(s=>[s.id,s.code,s.session,s.numero,s.statut,s.maj,s.version,
    s.dernierEvenement,s.agent,s.date]);
  const grouped=new Map();
  for(const s of Object.values(snap)){
    const key=s.id+'|'+s.session;
    if(!grouped.has(key))grouped.set(key,{inscriptionId:s.id,code:s.code,session:s.session});
  }
  const progressRows=[];
  for(const item of grouped.values()){
    const seances=academyLot4Seances_(client,item.session);
    const p=academyLot4Progress_(item,item.session,seances,snap);
    progressRows.push([item.inscriptionId,item.code,item.session,p.prevues,p.presences,p.retards,
      p.absences,p.excusees,p.renseignees,p.restantes,p.tauxPresence,p.statut,events.length,new Date().toISOString()]);
  }
  academyLot3Rewrite_(attendance,rows,10);
  academyLot3Rewrite_(progress,progressRows,14);
}
/** Réconciliation depuis l'éditeur Apps Script sur copies TEST uniquement. */
function reparerProjectionsAcademieLot4_(){
  const book=controlWorkbook_(),settings=readControlSettings_(book);
  if(settings.APP_MODE!=='TEST')throw new Error('MODE_TEST_OBLIGATOIRE');
  const client=ouvrirSourceClientPhoto_(settings);
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw new Error('SERVICE_OCCUPE');
  try{academyLot4Repair_(book,client,academyLot4ReadEvents_(book));}
  finally{lock.releaseLock();}
}
