/**
 * BOXY CONTROL ACADEMIE — LOT 3/6 : decisions sur les places de formation.
 * Candidat de recette privee. AUCUN appel n'ecrit dans BOXY CLIENT.
 * Journal des decisions CONTROL = source autoritaire, projections reconstructibles.
 */
const BOXY_ACADEMIE_LOT3_VERSION_ = '3.0.0-rc1';
const ACADEMIE_LOT3_EVENTS_ = [
  'evenement_id','inscription_id','code_public','code_formation','code_session_source',
  'code_session_cible','action','statut_avant','statut_apres','motif','agent_id',
  'cle_idempotence','empreinte_requete','version_inscription','cree_utc','version_session'
];
const ACADEMIE_LOT3_STATUTS_ = ['CONFIRMEE','LISTE_ATTENTE','ANNULEE'];

/** Lecture securisee de l'etat du participant, sans ecriture metier. */
function controlAcademieEtatLot3(googleIdToken, codeSaisi) {
  const ctx = academyLot3Context_(googleIdToken);
  const code = normaliserCodePhoto_(codeSaisi);
  if (!code) throw new Error('CODE_INVALIDE');
  const client = ouvrirSourceClientPhoto_(ctx.settings);
  const dossier = academyLot3DossierClient_(client, code);
  const events = academyLot3ReadEvents_(ctx.book);
  const state = academyLot3Snapshot_(events);
  const current = state[dossier.inscriptionId] || null;
  const sessions = academyLot3Sessions_(client);
  const sessionCode = current && current.statut !== 'ANNULEE' ? current.session : dossier.codeSession;
  const session = sessions[sessionCode];
  if (!session || session.formation !== dossier.formationCode) throw new Error('SESSION_INCOHERENTE');
  // Lecture privee auditée avant toute divulgation de fiche.
  academyLookupAudit_(ctx.book, ctx.agent.agentId, dossier.inscriptionId, 'ETAT_LOT3', code);
  return {ok:true, dossier, version:current ? current.version : 0,
    statut:current ? current.statut : 'EN_ATTENTE', sessionActuelle:sessionCode,
    sessionCibleValidee:Boolean(session.valid),
    capacite:academyLot3Stats_(state, session),
    sessionsDisponibles:Object.values(sessions).filter(s=>s.formation===dossier.formationCode)
      .map(s=>({code:s.code,titre:s.titre,cap: s.capacite,active:s.valid,
        attenteAutorisee:s.attenteAutorisee, date:s.date, placesVerifiees:false})),
    paiement:'NON_VERIFIE', release:BOXY_ACADEMIE_LOT3_VERSION_};
}

/**
 * action: CONFIRMER | LISTE_ATTENTE | TRANSFERER | ANNULER.
 * sessionCible obligatoire pour les actions autres que ANNULER.
 * transfertVers: CONFIRMEE | LISTE_ATTENTE (pour TRANSFERER seulement).
 * versionAttendue et cleIdempotence obligatoires, verifiees sous LockService.
 */
function controlAcademieDecisionLot3(googleIdToken, demande) {
  const ctx=academyLot3Context_(googleIdToken);
  const req=academyLot3NormalizeDecision_(demande);
  if (req.action==='TRANSFERER' && ctx.settings.ACADEMIE_TRANSFERTS_ACTIFS!=='OUI') throw new Error('TRANSFERTS_FERMES');
  if ((req.action==='LISTE_ATTENTE' || (req.action==='TRANSFERER' && req.transfertVers==='LISTE_ATTENTE')) &&
      ctx.settings.ACADEMIE_ATTENTE_GESTION_ACTIVE!=='OUI') throw new Error('ATTENTE_FERMEE');
  if (ctx.settings.APP_MODE==='PRODUCTION' && ctx.settings['ACADEMIE_CLIENT_CATALOGUE_VALIDÉ']!=='OUI')
    throw new Error('CATALOGUE_NON_VALIDE');
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('SERVICE_OCCUPE');
  try {
    const client=ouvrirSourceClientPhoto_(ctx.settings);
    const dossier=academyLot3DossierClient_(client,req.code);
    const sessions=academyLot3Sessions_(client);
    const sheet=ctx.book.getSheetByName('HISTORIQUE_DECISIONS_ACADEMIE');
    if (!sheet) throw new Error('CONFIGURATION_LOT3_INCOMPLETE');
    const events=academyLot3ReadEvents_(ctx.book);
    const fingerprint=academyLot3Fingerprint_(req);
    const duplicates=events.filter(e=>e.cle_idempotence===req.cleIdempotence);
    if(duplicates.length>1) throw new Error('JOURNAL_INCOHERENT');
    if(duplicates.length){
      const e=duplicates[0];
      if(e.empreinte_requete!==fingerprint || e.inscription_id!==dossier.inscriptionId)
        throw new Error('CLE_DEJA_UTILISEE');
      // Repair obligatoire lors d'une reprise apres une panne de projection.
      let projectionEnAttente=false;
      try { academyLot3RepairProjections_(ctx.book,sessions,events); } catch(err) { projectionEnAttente=true; }
      return {ok:true,rejoue:true,evenementId:e.evenement_id,statut:e.statut_apres,
        version:Number(e.version_inscription),projectionEnAttente};
    }
    const snapshot=academyLot3Snapshot_(events);
    const before=snapshot[dossier.inscriptionId] || null;
    const actualVersion=before?before.version:0;
    if(req.versionAttendue!==actualVersion) throw new Error('FICHE_PERIMEE');
    if(dossier.statutDemande==='ANNULEE') throw new Error('DEMANDE_CLIENT_ANNULEE');
    const plan=academyLot3Plan_(req,dossier,before,snapshot,sessions);
    const now=new Date().toISOString();
    const event={
      evenement_id:'ACAD-EVT-'+Utilities.getUuid(),inscription_id:dossier.inscriptionId,
      code_public:dossier.code,code_formation:dossier.formationCode,
      code_session_source:before?before.session:dossier.codeSession,
      code_session_cible:plan.session,
      action:req.action,statut_avant:before?before.statut:'EN_ATTENTE',
      statut_apres:plan.statut,motif:req.motif,
      agent_id:ctx.agent.agentId,cle_idempotence:req.cleIdempotence,
      empreinte_requete:fingerprint,version_inscription:actualVersion+1,
      cree_utc:now,version_session:String(sessions[plan.session]?.validation || '')
    };
    // Audit avant journal: si indisponible, aucune attribution n'est effectuee.
    academyLot3AuditDecision_(ctx.book,ctx.agent.agentId,dossier.inscriptionId,req.action,event.evenement_id);
    sheet.appendRow(ACADEMIE_LOT3_EVENTS_.map(k=>event[k]));
    events.push(event);
    let projectionEnAttente=false;
    try { academyLot3RepairProjections_(ctx.book,sessions,events); } catch(err) {
      // Le journal reste source autoritaire; reprise par idempotence ou diagnostic prive.
      projectionEnAttente=true;
    }
    return {ok:true,rejoue:false,evenementId:event.evenement_id,
      statut:event.statut_apres,session:event.code_session_cible,
      version:event.version_inscription,projectionEnAttente,
      placesConfirmees:academyLot3Stats_(academyLot3Snapshot_(events),sessions[plan.session]).confirmes};
  } finally { lock.releaseLock(); }
}

function academyLot3Context_(token) {
  const identity=verifyGoogleIdToken_(token);
  const book=controlWorkbook_();
  const agent=findEnabledAgent_(book,identity);
  const settings=readControlSettings_(book);
  const permissions=loadRolePermissions_(book,agent.role);
  const useTest=PropertiesService.getScriptProperties().getProperty('CONTROL_USE_TEST_SHEET')==='OUI';
  if(!['TEST','PRODUCTION'].includes(settings.APP_MODE) ||
      settings.OPERATIONS_ACTIVES!=='OUI' ||
      settings.ACADEMIE_OPERATIONS_ACTIVES!=='OUI' ||
      settings.ACADEMIE_DECISIONS_ACTIVES!=='OUI' ||
      settings.ACADEMIE_RECHERCHE_ACTIVE!=='OUI' ||
      settings.ACADEMIE_AUDIT_RECHERCHE_OBLIGATOIRE!=='OUI' ||
      settings.ACADEMIE_RECHERCHE_SOURCE!=='CLIENT_SEUL' ||
      !permissions.includes('CONSULTER_INSCRIPTION_ACADEMIE') ||
      !permissions.includes('DECIDER_INSCRIPTION_ACADEMIE') ||
      !['SUPERVISEUR','ADMIN_CONTROL'].includes(agent.role)) throw new Error('DECISIONS_ACADEMIE_FERMEES');
  if((settings.APP_MODE==='TEST')!==useTest)throw new Error('ENVIRONNEMENT_INCOHERENT');
  return {book,agent,settings};
}

function academyLot3NormalizeDecision_(p) {
  if (!p || typeof p!=='object' || Array.isArray(p)) throw new Error('DEMANDE_INVALIDE');
  const code=normaliserCodePhoto_(p.code);
  const action=String(p.action||'').trim().toUpperCase();
  const sessionCible=String(p.sessionCible||'').trim().toUpperCase();
  const transfertVers=String(p.transfertVers||'CONFIRMEE').trim().toUpperCase();
  const cleIdempotence=String(p.cleIdempotence||'').trim();
  const motif=String(p.motif||'').trim().replace(/\s+/g,' ').slice(0,250);
  const versionAttendue=Number(p.versionAttendue);
  if(!code || !['CONFIRMER','LISTE_ATTENTE','TRANSFERER','ANNULER'].includes(action) ||
      !/^[A-Za-z0-9_-]{12,100}$/.test(cleIdempotence) ||
      !Number.isInteger(versionAttendue) || versionAttendue<0 || versionAttendue>10000 ||
      (action!=='ANNULER'&&!/^[A-Z0-9_-]{3,80}$/.test(sessionCible)) ||
      (action==='TRANSFERER'&&!['CONFIRMEE','LISTE_ATTENTE'].includes(transfertVers)) ||
      /^[=+@\-]/.test(motif) ||
      (['TRANSFERER','ANNULER'].includes(action)&&motif.length<5))throw new Error('DEMANDE_INVALIDE');
  return {code,action,sessionCible,transfertVers,cleIdempotence,motif,versionAttendue};
}

function academyLot3Fingerprint_(req) {
  const secret=String(PropertiesService.getScriptProperties().getProperty('AUDIT_HASH_SECRET')||'');
  if(secret.length<32)throw new Error('AUDIT_NON_CONFIGURE');
  const canonical=[req.code,req.action,req.sessionCible,req.transfertVers,req.motif,req.versionAttendue].join('|');
  return Utilities.computeHmacSha256Signature(canonical,secret)
    .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}

function academyLot3DossierClient_(client,code) {
  const tab=client.getSheetByName('INSCRIPTIONS');
  if(!tab || tab.getLastColumn()<18 || tab.getLastRow()<1 || tab.getLastRow()>25001)throw new Error('SOURCE_INDISPONIBLE');
  const h=tab.getRange(1,1,1,18).getDisplayValues()[0].map(x=>String(x||'').trim());
  const required=BOXY_ACADEMIE_LOOKUP_FIELDS_,pos={};
  required.forEach(k=>{pos[k]=h.indexOf(k);if(pos[k]<0)throw new Error('SCHEMA_CLIENT_INCOMPATIBLE')});
  const hits=tab.getLastRow()>1?tab.getRange(2,pos.code_public+1,tab.getLastRow()-1,1)
    .createTextFinder(code).matchEntireCell(true).matchCase(true).findAll():[];
  if(hits.length!==1)throw new Error('DOSSIER_INDISPONIBLE');
  const row=tab.getRange(hits[0].getRow(),1,1,18).getDisplayValues()[0];
  if(String(row[pos.code_prestation]||'').toUpperCase()!=='FORMATION')throw new Error('DOSSIER_INDISPONIBLE');
  return academyLookupMap_(client,row,pos);
}

function academyLot3Sessions_(client) {
  const rows=academyReadTable_(client,'SESSIONS_ACADEMIE',
    ['code_session','code_formation','titre_session','date_debut','capacite_max',
      'attente_autorisee','capacite_attente','statut_session','validation_session','visible_public'],500);
  const out={};
  for(const row of rows){
    const code=String(row.code_session||'').toUpperCase();
    if(!/^[A-Z0-9_-]{3,80}$/.test(code)||out[code])throw new Error('SCHEMA_SESSION_INCOHERENT');
    const cap=Number(row.capacite_max),lim=Number(row.capacite_attente);
    if(!Number.isInteger(cap)||cap<0||cap>10000||!Number.isInteger(lim)||lim<0||lim>10000)
      throw new Error('SCHEMA_SESSION_INCOHERENT');
    out[code]={code,formation:String(row.code_formation||'').toUpperCase(),titre:row.titre_session,
      date:row.date_debut,capacite:cap,attenteAutorisee:row.attente_autorisee==='OUI',
      limiteAttente:lim,statut:row.statut_session,validation:row.validation_session,
      valid:row.statut_session==='OUVERTE'&&row.validation_session==='VALIDEE'&&
        row.visible_public==='OUI'&&cap>0&&/^\d{4}-\d{2}-\d{2}$/.test(row.date_debut)
        && row.date_debut>=Utilities.formatDate(new Date(),'Africa/Bamako','yyyy-MM-dd')};
  }
  return out;
}

function academyLot3ReadEvents_(book) {
  const tab=book.getSheetByName('HISTORIQUE_DECISIONS_ACADEMIE');
  if(!tab)throw new Error('CONFIGURATION_LOT3_INCOMPLETE');
  const last=tab.getLastRow();
  if(last<1||last>5001)throw new Error('JOURNAL_TROP_VOLUMINEUX');
  const row0=tab.getRange(1,1,1,ACADEMIE_LOT3_EVENTS_.length).getDisplayValues()[0];
  if(ACADEMIE_LOT3_EVENTS_.some((x,i)=>row0[i]!==x))throw new Error('SCHEMA_JOURNAL_INCOMPATIBLE');
  if(last===1)return [];
  return tab.getRange(2,1,last-1,ACADEMIE_LOT3_EVENTS_.length).getDisplayValues()
    .filter(row=>String(row[0]||'').trim())
    .map(row=>Object.fromEntries(ACADEMIE_LOT3_EVENTS_.map((k,i)=>[k,String(row[i]||'').trim()])));
}

function academyLot3Snapshot_(events) {
  const current={}, seen=new Set(), usedKeys=new Set();
  for(let i=0;i<events.length;i++){
    const e=events[i],id=e.inscription_id,version=Number(e.version_inscription);
    if(!id || !e.evenement_id ||seen.has(e.evenement_id) ||
       !ACADEMIE_LOT3_STATUTS_.includes(e.statut_apres) ||
       !Number.isInteger(version)||version<1||version>10000 ||
       usedKeys.has(e.cle_idempotence))throw new Error('JOURNAL_INCOHERENT');
    seen.add(e.evenement_id);usedKeys.add(e.cle_idempotence);
    const prev=current[id];
    if(version!==(prev?prev.version+1:1) || (prev&&prev.statut!==e.statut_avant) ||
       !/^[A-Z0-9_-]{3,80}$/.test(e.code_session_cible))throw new Error('JOURNAL_INCOHERENT');
    current[id]={id,code:e.code_public,formation:e.code_formation,session:e.code_session_cible,
      statut:e.statut_apres,version,dernierEvenement:e.evenement_id,maj:e.cree_utc,
      ordreAttente:e.statut_apres==='LISTE_ATTENTE' && prev&&prev.statut==='LISTE_ATTENTE' && prev.session===e.code_session_cible?prev.ordreAttente:i,
      motif:e.motif};
  }
  return current;
}

function academyLot3Stats_(state,session) {
  if(!session) throw new Error('SESSION_INCOHERENTE');
  let confirmes=0,attente=0,queue=[];
  for(const item of Object.values(state))if(item.session===session.code){
    if(item.statut==='CONFIRMEE')confirmes++;
    if(item.statut==='LISTE_ATTENTE'){attente++;queue.push(item);}
  }
  queue.sort((a,b)=>a.ordreAttente-b.ordreAttente);
  if(confirmes>session.capacite || (session.attenteAutorisee && attente>session.limiteAttente))
    throw new Error('CAPACITE_INCOHERENTE');
  return {capacite:session.capacite,confirmes,attente,
    restantes:Math.max(0,session.capacite-confirmes),
    attenteRestantes:session.attenteAutorisee?Math.max(0,session.limiteAttente-attente):0,
    premierEnAttente:queue[0]?.id||'',
    statutSession:session.statut,validation:session.validation,
    placesVerifiees:Boolean(session.valid)};
}

function academyLot3Plan_(req,dossier,before,state,sessions) {
  const oldStat=before?before.statut:'EN_ATTENTE';
  if(oldStat==='ANNULEE'&&req.action!=='ANNULER')throw new Error('DOSSIER_ANNULE');
  if(req.action==='ANNULER'){
    if(oldStat==='ANNULEE')throw new Error('DEJA_ANNULE');
    return {statut:'ANNULEE',session:before?before.session:dossier.codeSession};
  }
  const target=sessions[req.sessionCible];
  if(!target || target.formation!==dossier.formationCode || !target.valid)throw new Error('SESSION_NON_OUVERTE');
  if(req.action==='TRANSFERER'){
    if(!before || !['CONFIRMEE','LISTE_ATTENTE'].includes(before.statut)||before.session===req.sessionCible)
      throw new Error('TRANSFERT_INVALIDE');
  }else if(before && before.statut==='CONFIRMEE')throw new Error('DEJA_CONFIRMEE');
  else if(before && before.statut==='LISTE_ATTENTE'&&req.action==='LISTE_ATTENTE')throw new Error('DEJA_EN_ATTENTE');
  else if(before && before.session!==req.sessionCible)throw new Error('TRANSFERER_REQUIS');
  else if(!before && dossier.codeSession!==req.sessionCible)throw new Error('TRANSFERT_REQUIS');
  const stats=academyLot3Stats_(state,target);
  const status=req.action==='TRANSFERER'?req.transfertVers:
    req.action==='CONFIRMER'?'CONFIRMEE':'LISTE_ATTENTE';
  if(status==='CONFIRMEE'){
    if(stats.restantes<1)throw new Error('SESSION_COMPLETE');
    if(stats.premierEnAttente && stats.premierEnAttente!==dossier.inscriptionId)
      throw new Error('PRIORITE_LISTE_ATTENTE');
  }else{
    if(!target.attenteAutorisee || stats.attenteRestantes<1)throw new Error('ATTENTE_INDISPONIBLE');
  }
  return {statut:status,session:target.code};
}

function academyLot3AuditDecision_(book,agentId,inscriptionId,action,evt) {
  const s=book.getSheetByName('AUDIT');
  if(!s)throw new Error('AUDIT_INDISPONIBLE');
  try {s.appendRow(['AUD-'+Utilities.getUuid(),new Date().toISOString(),agentId,
    'DECISION_ACADEMIE_'+action,inscriptionId,'','INTENTION','',evt,
    'LOT3 : intent avant ecriture dans historique decisions']);}
  catch(err){throw new Error('AUDIT_INDISPONIBLE');}
}

function academyLot3RepairProjections_(book,sessions,events) {
  const etat=book.getSheetByName('ETAT_INSCRIPTIONS_CONTROL_ACADEMIE');
  const places=book.getSheetByName('ETAT_CAPACITES_CONTROL_ACADEMIE');
  if(!etat||!places)throw new Error('PROJECTION_INDISPONIBLE');
  const snap=academyLot3Snapshot_(events);
  const updates=Object.values(snap).map(x=>[
    x.id,x.code,x.formation,x.session,x.statut,x.version,x.dernierEvenement,
    x.maj,x.motif,'BOXY_CLIENT'
  ]);
  const capacity=Object.values(sessions).map(s=>{
    const st=academyLot3Stats_(snap,s);
    return [s.code,s.capacite,st.confirmes,st.attente,s.valid?st.restantes:'NON_VERIFIE',
      s.valid?st.attenteRestantes:'NON_VERIFIE',s.statut,
      events.length,new Date().toISOString(),events.length?events[events.length-1].evenement_id:''];
  });
  // Projections recalculables: aucun calcul de capacité ne dépend de leur contenu.
  academyLot3Rewrite_(etat,updates,10);
  academyLot3Rewrite_(places,capacity,10);
}
function academyLot3Rewrite_(tab,rows,cols) {
  if(tab.getLastRow()>1)tab.getRange(2,1,tab.getLastRow()-1,cols).clearContent();
  if(rows.length)tab.getRange(2,1,rows.length,cols).setValues(rows);
}

/** Opération de réparation manuelle (éditeur Apps Script uniquement). */
function reparerProjectionsAcademieLot3_() {
  const book=controlWorkbook_(),settings=readControlSettings_(book);
  if(settings.APP_MODE!=='TEST')throw new Error('MODE_TEST_OBLIGATOIRE');
  const client=ouvrirSourceClientPhoto_(settings);
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw new Error('SERVICE_OCCUPE');
  try{academyLot3RepairProjections_(book,academyLot3Sessions_(client),academyLot3ReadEvents_(book));}
  finally{lock.releaseLock();}
}
