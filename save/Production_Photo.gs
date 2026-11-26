/**
 * BOXY CONTROL - LOT 5/7 : affectation, shooting, retouche, livraison.
 * PREPRODUCTION: AUCUN deploiement ni droit actif par defaut.
 * HISTORIQUE_PRODUCTION_PHOTO et HISTORIQUE_AFFECTATIONS_PHOTO sont les journaux
 * autoritaires; SUIVI_PRODUCTION et AFFECTATIONS_PHOTO sont des projections.
 * Ne modifie JAMAIS BOXY_CLIENT/INSCRIPTIONS, PA IEMENTS, ou des fichiers photo.
 */
const PHOTO5_VERSION_ = '5.0.0-rc1';
const PHOTO5_STAGES_ = ['A_FAIRE','EN_SHOOTING','SHOOTING_TERMINE','EN_RETOUCHE','PRET','LIVRE'];
const PHOTO5_EVENT_KEYS_ = [
  'evenement_id','inscription_id','code_public','reservation_id','action',
  'statut_avant','statut_apres','photographe_id','retoucheur_id',
  'date_prevue_livraison','reference_livrable_prive','canal_livraison',
  'preuve_livraison_privee','nombre_photos_livrees','agent_auteur_id',
  'cle_idempotence','empreinte_requete','version','cree_utc','commentaire_interne'
];
const PHOTO5_ASSIGN_KEYS_ = [
  'evenement_id','inscription_id','code_public','reservation_id',
  'agent_affecte_id','fonction','action','agent_auteur_id',
  'cle_idempotence','empreinte_requete','version','cree_utc','note_interne'
];
const PHOTO5_PROJECTION_KEYS_ = [
  'suivi_id','inscription_id','code_public','statut_production','photographe_id',
  'date_realisation','date_prevue_livraison','date_livraison',
  'reference_livrable_prive','maj_utc','version','note','reservation_id',
  'retoucheur_id','derniere_action_id','canal_livraison','preuve_livraison_privee',
  'nombre_photos_livrees','version_reservation','livraison_validee_par'
];
const PHOTO5_ASSIGN_VIEW_KEYS_ = [
  'affectation_id','inscription_id','agent_id','fonction','statut',
  'date_affectation_utc','note','code_public','reservation_id',
  'version_affectation','dernier_evenement_id','maj_utc'
];

function photo5AgentContext_(token) {
  // Fresh identity & role permissions for EVERY request; no cached authority.
  const identity=verifyGoogleIdToken_(token);
  const book=controlWorkbook_();
  const agent=findEnabledAgent_(book,identity);
  const settings=readControlSettings_(book);
  const permissions=loadRolePermissions_(book,agent.role);
  return {book,agent,settings,permissions};
}
function photo5AssertReady_(ctx,write) {
  const cfg=ctx.settings;
  if (!['TEST','PRODUCTION'].includes(cfg.APP_MODE) || cfg.OPERATIONS_ACTIVES!=='OUI' ||
      cfg.PRODUCTION_PHOTO_ACTIF!=='OUI') throw new Error('PRODUCTION_PHOTO_DESACTIVEE');
  const props=PropertiesService.getScriptProperties();
  if(cfg.APP_MODE==='TEST' && props.getProperty('CONTROL_USE_TEST_SHEET')!=='OUI')
    throw new Error('COPIE_CONTROL_TEST_OBLIGATOIRE');
  if(cfg.APP_MODE==='PRODUCTION' && props.getProperty('CONTROL_USE_TEST_SHEET')==='OUI')
    throw new Error('CONFIGURATION_ENVIRONNEMENT_INCOHERENTE');
  if(write && cfg.PAIEMENTS_ACTIFS!=='NON' && cfg.APP_MODE==='TEST')
    throw new Error('PAIEMENTS_TEST_NON_BLOQUES');
}
function photo5Has_(ctx,p){return ctx.permissions.indexOf(p)>=0;}
function photo5Require_(ctx,p){if(!photo5Has_(ctx,p))throw new Error('AUTORISATION_REFUSEE');}
function photo5Source_(ctx,code){return photo3FindClient_(ctx.settings,code);}
function photo5Booking_(ctx,id){return photo3Latest_(ctx.book,id);}
function photo5MustBeBooked_(b){if(!b || b.statut_apres!=='CONFIRMEE')throw new Error('RESERVATION_NON_CONFIRMEE');}
function photo5SheetEvents_(book,name,keys) {
  const sh=book.getSheetByName(name);if(!sh)throw new Error('CONFIGURATION_INCOMPLETE');
  photo3AssertHeader_(sh,keys);
  return sh.getDataRange().getDisplayValues().slice(1).filter(r=>String(r[0]||'').trim()).map(r=>{
    const o={};keys.forEach((k,i)=>o[k]=String(r[i]??''));return o;
  });
}
function photo5Events_(book){return photo5SheetEvents_(book,'HISTORIQUE_PRODUCTION_PHOTO',PHOTO5_EVENT_KEYS_);}
function photo5AssignmentEvents_(book){return photo5SheetEvents_(book,'HISTORIQUE_AFFECTATIONS_PHOTO',PHOTO5_ASSIGN_KEYS_);}
function photo5State_(events,id,reservationId) {
  const relevant=events.filter(e=>e.inscription_id===id && e.reservation_id===reservationId);
  let st={inscriptionId:id,reservationId,statut:'A_FAIRE',version:0,
    photographeId:'',retoucheurId:'',dateRealisation:'',datePrevueLivraison:'',
    dateLivraison:'',referenceLivrablePrive:'',canalLivraison:'',preuveLivraisonPrivee:'',
    nombrePhotosLivrees:0,livraisonValideePar:'',lastId:'',lastComment:'',code:''};
  for(const e of relevant){
    if(Number(e.version)!==st.version+1 || e.statut_avant!==st.statut ||
      PHOTO5_STAGES_.indexOf(e.statut_apres)!==PHOTO5_STAGES_.indexOf(st.statut)+1 ||
      e.action!==e.statut_apres)throw new Error('HISTORIQUE_PRODUCTION_INCOHERENT');
    st={...st,code:e.code_public,statut:e.statut_apres,version:st.version+1,
      photographeId:e.photographe_id||st.photographeId,
      retoucheurId:e.retoucheur_id||st.retoucheurId,
      dateRealisation:e.action==='SHOOTING_TERMINE'?e.cree_utc:st.dateRealisation,
      datePrevueLivraison:e.date_prevue_livraison||st.datePrevueLivraison,
      dateLivraison:e.action==='LIVRE'?e.cree_utc:st.dateLivraison,
      referenceLivrablePrive:e.reference_livrable_prive||st.referenceLivrablePrive,
      canalLivraison:e.canal_livraison||st.canalLivraison,
      preuveLivraisonPrivee:e.preuve_livraison_privee||st.preuveLivraisonPrivee,
      nombrePhotosLivrees:e.nombre_photos_livrees?Number(e.nombre_photos_livrees):st.nombrePhotosLivrees,
      livraisonValideePar:e.action==='LIVRE'?e.agent_auteur_id:st.livraisonValideePar,
      lastId:e.evenement_id,lastComment:e.commentaire_interne||''};
  }
  return st;
}
function photo5AssignmentsState_(events,id,reservationId){
  const list=events.filter(e=>e.inscription_id===id&&e.reservation_id===reservationId);
  const byKey={};let v=0;
  for(const e of list){
    if(Number(e.version)!==v+1)throw new Error('HISTORIQUE_AFFECTATIONS_INCOHERENT');
    if(!['PHOTOGRAPHE','RETOUCHEUR'].includes(e.fonction) || !['AFFECTER','RETIRER'].includes(e.action))
      throw new Error('HISTORIQUE_AFFECTATIONS_INCOHERENT');
    const k=e.fonction+'|'+e.agent_affecte_id;const prev=byKey[k];
    if((e.action==='AFFECTER' && prev?.active)||(e.action==='RETIRER'&&!prev?.active))
      throw new Error('HISTORIQUE_AFFECTATIONS_INCOHERENT');
    byKey[k]={agentId:e.agent_affecte_id,fonction:e.fonction,active:e.action==='AFFECTER',
      version:Number(e.version),eventId:e.evenement_id,at:e.cree_utc,note:e.note_interne,
      inscriptionId:id,reservationId,code:e.code_public};v++;
  }
  return {version:v,items:Object.values(byKey),active:Object.values(byKey).filter(x=>x.active)};
}
function photo5ActiveAgents_(book){
  const sh=book.getSheetByName('AGENTS');if(!sh)throw new Error('CONFIGURATION_INCOMPLETE');
  const rows=sh.getDataRange().getDisplayValues();const h=rows[0]||[];
  const names=['agent_id','nom_affiche','role','actif']; const idx={};
  names.forEach(k=>{idx[k]=h.indexOf(k);if(idx[k]<0)throw new Error('SCHEMA_CONTROL_INCOMPATIBLE');});
  return rows.slice(1).filter(r=>r[idx.actif]==='OUI').map(r=>({id:r[idx.agent_id],name:r[idx.nom_affiche]||'Agent',role:r[idx.role]}))
    .filter(x=>x.id && ['PHOTOGRAPHE','RETOUCHEUR','SUPERVISEUR'].includes(x.role));
}
function photo5Public_(st, assignments,book){
  const names={};photo5ActiveAgents_(book).forEach(x=>names[x.id]=x.name);
  return {statut:st.statut,version:st.version,reservationId:st.reservationId,
    dateRealisation:st.dateRealisation,datePrevueLivraison:st.datePrevueLivraison,
    dateLivraison:st.dateLivraison,livrablePrepare:Boolean(st.referenceLivrablePrive),
    preuveLivraisonPresente:Boolean(st.preuveLivraisonPrivee),
    nombrePhotosLivrees:st.nombrePhotosLivrees,canalLivraison:st.canalLivraison,
    assignmentsVersion:assignments.version,
    affectations:assignments.active.map(a=>({agentId:a.agentId,nom:names[a.agentId]||'Intervenant',fonction:a.fonction})),
    derniereNote:st.lastComment};
}
function photo5AuthForCase_(ctx,assignments){
  if(ctx.agent.role==='PHOTOGRAPHE'||ctx.agent.role==='RETOUCHEUR') {
    if(!assignments.active.some(a=>a.agentId===ctx.agent.agentId))throw new Error('DOSSIER_NON_AFFECTE');
  }
}

/** Read-only view for authorized staff; no raw private delivery refs sent to browser. */
function controlPhotoGetProduction(idToken,codeInput){
  const ctx=photo5AgentContext_(idToken);photo5AssertReady_(ctx,false);
  if(!['CONSULTER_PRODUCTION','SUIVI_PRODUCTION','GERER_AFFECTATIONS','VALIDER_LIVRAISON_PHOTO'].some(p=>photo5Has_(ctx,p)))
    throw new Error('AUTORISATION_REFUSEE');
  const code=normaliserCodePhoto_(codeInput);if(!code)throw new Error('CODE_INVALIDE');
  const source=photo5Source_(ctx,code);const booking=photo5Booking_(ctx,source.inscriptionId);
  const rid=booking?booking.reservation_id:'';
  const assigns=photo5AssignmentsState_(photo5AssignmentEvents_(ctx.book),source.inscriptionId,rid);
  photo5AuthForCase_(ctx,assigns);
  const state=photo5State_(photo5Events_(ctx.book),source.inscriptionId,rid);
  const b=photo3Public_(booking);
  const canAssign=photo5Has_(ctx,'GERER_AFFECTATIONS');
  const canDeliver=photo5Has_(ctx,'VALIDER_LIVRAISON_PHOTO')&&ctx.settings.PHOTO_LIVRAISON_ACTIF==='OUI';
  return {ok:true,found:true,code,production:photo5Public_(state,assigns,ctx.book),reservation:b,
    canAssign,canDeliver,
    candidats:canAssign?photo5ActiveAgents_(ctx.book).filter(a=>['PHOTOGRAPHE','RETOUCHEUR'].includes(a.role)):[],
    release:PHOTO5_VERSION_};
}
function photo5SafeText_(v,max){
  const s=String(v||'').trim();
  if(s.length>max || /[<>\x00-\x1f]/.test(s) || /^[=+@-]/.test(s))throw new Error('TEXTE_INVALIDE');
  return s;
}
function photo5SafePrivateId_(s){
  const v=String(s||'').trim();
  if(v && !/^[A-Za-z0-9_\-]{12,128}$/.test(v))throw new Error('REFERENCE_PRIVEE_INVALIDE');
  return v;
}
function photo5Key_(s){const v=String(s||'').trim();if(!/^[A-Za-z0-9_-]{16,100}$/.test(v))throw new Error('CLE_INVALIDE');return v;}
function photo5Version_(v){if(v==null||v==='')throw new Error('VERSION_INVALIDE');const n=Number(v);if(!Number.isInteger(n)||n<0||n>100000)throw new Error('VERSION_INVALIDE');return n;}
function photo5Hash_(r){
  const h=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(r),Utilities.Charset.UTF_8);
  return h.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function photo5Safety_(ctx){
  photo5AssertReady_(ctx,true);
}
function photo5BookingVersions_(ctx,source,expected) {
  const booking=photo5Booking_(ctx,source.inscriptionId);photo5MustBeBooked_(booking);
  if(Number(booking.version)!==expected)throw new Error('RESERVATION_MODIFIEE_RECHARGER');
  return booking;
}

/** Supervisor/CONTROL admin only: assign or remove a photographer/retoucher. */
function controlPhotoAssign(idToken,input){
  const ctx=photo5AgentContext_(idToken);photo5Safety_(ctx);photo5Require_(ctx,'GERER_AFFECTATIONS');
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('DONNEES_INVALIDES');
  const r={code:normaliserCodePhoto_(input.code),action:String(input.action||'').trim(),
    fonction:String(input.fonction||'').trim(),agentId:String(input.agentId||'').trim(),
    versionAttendue:photo5Version_(input.versionAttendue),versionReservation:photo5Version_(input.versionReservation),
    cle:photo5Key_(input.cleIdempotence),note:photo5SafeText_(input.note,220)};
  if(!r.code||!['AFFECTER','RETIRER'].includes(r.action)||!['PHOTOGRAPHE','RETOUCHEUR'].includes(r.fonction)||
    !/^[A-Za-z0-9_-]{2,100}$/.test(r.agentId))throw new Error('DONNEES_INVALIDES');
  const fp=photo5Hash_(r);const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw new Error('SERVICE_OCCUPE');
  try{
    const source=photo5Source_(ctx,r.code);const booking=photo5BookingVersions_(ctx,source,r.versionReservation);
    const hist=photo5AssignmentEvents_(ctx.book);
    const replay=hist.find(e=>e.cle_idempotence===r.cle);
    if(replay){
      if(replay.empreinte_requete!==fp || replay.agent_auteur_id!==ctx.agent.agentId || replay.inscription_id!==source.inscriptionId)
        throw new Error('CLE_DEJA_UTILISEE');
      const state=photo5AssignmentsState_(hist,source.inscriptionId,booking.reservation_id);
      return {ok:true,replay:true,version:state.version,affectations:photo5Public_(photo5State_(photo5Events_(ctx.book),source.inscriptionId,booking.reservation_id),state,ctx.book).affectations};
    }
    const current=photo5AssignmentsState_(hist,source.inscriptionId,booking.reservation_id);
    if(current.version!==r.versionAttendue)throw new Error('AFFECTATIONS_MODIFIEES_RECHARGER');
    const selected=photo5ActiveAgents_(ctx.book).find(a=>a.id===r.agentId&&a.role===r.fonction);
    if(r.action==='AFFECTER'&&!selected)throw new Error('INTERVENANT_NON_AUTORISE');
    const already=current.active.some(a=>a.agentId===r.agentId&&a.fonction===r.fonction);
    if(r.action==='AFFECTER'&&already)throw new Error('AFFECTATION_EXISTANTE');
    if(r.action==='RETIRER'&&!already)throw new Error('AFFECTATION_ABSENTE');
    const now=new Date().toISOString();
    const e={evenement_id:'AFP-'+Utilities.getUuid(),inscription_id:source.inscriptionId,
      code_public:r.code,reservation_id:booking.reservation_id,agent_affecte_id:r.agentId,
      fonction:r.fonction,action:r.action,agent_auteur_id:ctx.agent.agentId,
      cle_idempotence:r.cle,empreinte_requete:fp,version:current.version+1,cree_utc:now,note_interne:r.note};
    const sh=ctx.book.getSheetByName('HISTORIQUE_AFFECTATIONS_PHOTO');
    photo3AssertHeader_(sh,PHOTO5_ASSIGN_KEYS_);
    sh.appendRow(PHOTO5_ASSIGN_KEYS_.map(k=>e[k]));SpreadsheetApp.flush();
    const next=photo5AssignmentsState_(hist.concat([e]),source.inscriptionId,booking.reservation_id);
    const warnings=[];
    try{photo5RepairAssignments_(ctx.book,next);}catch(err){warnings.push('PROJECTION_A_RECONCILIER');}
    try{photo5Audit_(ctx.book,ctx.agent.agentId,source.inscriptionId,'AFFECTATION_'+r.action,e.evenement_id,fp);}catch(err){warnings.push('AUDIT_A_RECONCILIER');}
    return {ok:true,replay:false,version:next.version,
      affectations:photo5Public_(photo5State_(photo5Events_(ctx.book),source.inscriptionId,booking.reservation_id),next,ctx.book).affectations,
      avertissements:warnings};
  }finally{lock.releaseLock();}
}

/** Five sequential milestones; LIVRE requires a separate supervisor permission. */
function controlPhotoAdvanceProduction(idToken,input){
  const ctx=photo5AgentContext_(idToken);photo5Safety_(ctx);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('DONNEES_INVALIDES');
  const r={code:normaliserCodePhoto_(input.code),action:String(input.action||'').trim(),
    versionAttendue:photo5Version_(input.versionAttendue),versionReservation:photo5Version_(input.versionReservation),
    cle:photo5Key_(input.cleIdempotence),note:photo5SafeText_(input.note,280),
    prevision:photo5SafeText_(input.datePrevueLivraison,10),
    livrable:photo5SafePrivateId_(input.referenceLivrablePrive),
    canal:String(input.canalLivraison||'').trim().toUpperCase(),
    preuve:photo5SafePrivateId_(input.preuveLivraisonPrivee),
    nbPhotos:input.nombrePhotosLivrees==null||input.nombrePhotosLivrees===''?0:Number(input.nombrePhotosLivrees)};
  if(!r.code||!PHOTO5_STAGES_.slice(1).includes(r.action))throw new Error('DONNEES_INVALIDES');
  if(r.prevision && !/^\d{4}-\d{2}-\d{2}$/.test(r.prevision))throw new Error('DATE_PREVISION_INVALIDE');
  if(r.prevision && new Date(r.prevision+'T00:00:00Z').toISOString().slice(0,10)!==r.prevision)throw new Error('DATE_PREVISION_INVALIDE');
  if(!Number.isInteger(r.nbPhotos)||r.nbPhotos<0||r.nbPhotos>100000)throw new Error('QUANTITE_INVALIDE');
  if(r.action==='LIVRE'){
    photo5Require_(ctx,'VALIDER_LIVRAISON_PHOTO');
    if(ctx.settings.PHOTO_LIVRAISON_ACTIF!=='OUI')throw new Error('LIVRAISON_DESACTIVEE');
    if(!r.preuve||!['LIEN_PRIVE','SUR_PLACE','TRANSFERT_PRIVE','AUTRE'].includes(r.canal))throw new Error('PREUVE_LIVRAISON_OBLIGATOIRE');
  }else{
    photo5Require_(ctx,'SUIVI_PRODUCTION');
    if(r.canal||r.preuve||r.nbPhotos)throw new Error('DONNEES_INVALIDES');
  }
  const fingerprint=photo5Hash_(r);const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw new Error('SERVICE_OCCUPE');
  try{
    const source=photo5Source_(ctx,r.code),booking=photo5BookingVersions_(ctx,source,r.versionReservation);
    const hist=photo5Events_(ctx.book);
    const replay=hist.find(e=>e.cle_idempotence===r.cle);
    if(replay){
      if(replay.empreinte_requete!==fingerprint||replay.agent_auteur_id!==ctx.agent.agentId||replay.inscription_id!==source.inscriptionId)
        throw new Error('CLE_DEJA_UTILISEE');
      const st=photo5State_(hist,source.inscriptionId,booking.reservation_id);
      const ass=photo5AssignmentsState_(photo5AssignmentEvents_(ctx.book),source.inscriptionId,booking.reservation_id);
      return {ok:true,replay:true,production:photo5Public_(st,ass,ctx.book)};
    }
    const before=photo5State_(hist,source.inscriptionId,booking.reservation_id);
    if(before.version!==r.versionAttendue)throw new Error('DOSSIER_PRODUCTION_MODIFIE');
    if(PHOTO5_STAGES_.indexOf(r.action)!==PHOTO5_STAGES_.indexOf(before.statut)+1)
      throw new Error('ETAPE_INVALIDE');
    const assignments=photo5AssignmentsState_(photo5AssignmentEvents_(ctx.book),source.inscriptionId,booking.reservation_id);
    const isManager=['SUPERVISEUR','ADMIN_CONTROL'].includes(ctx.agent.role)&&photo5Has_(ctx,'SUIVI_PRODUCTION');
    if(r.action!=='LIVRE'&&!isManager){
      photo5AuthForCase_(ctx,assignments);
      const current=assignments.active.find(a=>a.agentId===ctx.agent.agentId);
      if((r.action==='EN_SHOOTING'||r.action==='SHOOTING_TERMINE')&&current.fonction!=='PHOTOGRAPHE')
        throw new Error('AFFECTATION_PHOTOGRAPHE_REQUISE');
    }
    if(r.action==='EN_SHOOTING'){
      if(!assignments.active.some(a=>a.fonction==='PHOTOGRAPHE'))throw new Error('PHOTOGRAPHE_NON_AFFECTE');
      if(ctx.settings.PRODUCTION_EXIGE_POINTAGE==='OUI'){
        const state=photo4BuildState_(photo4Journal_(ctx.book),source.inscriptionId,booking.reservation_id);
        if(state.statut!=='SUR_PLACE')throw new Error('ARRIVEE_NON_POINTEE');
      }
    }
    const lastPrivate=r.livrable||before.referenceLivrablePrive;
    if(r.action==='PRET'&&ctx.settings.PHOTO_REF_LIVRABLE_OBLIGATOIRE==='OUI'&&!lastPrivate)
      throw new Error('LIVRABLE_PRIVE_OBLIGATOIRE');
    if(r.action==='LIVRE'&&!lastPrivate)throw new Error('LIVRABLE_PRIVE_OBLIGATOIRE');
    const now=new Date().toISOString();
    const shot=assignments.active.find(a=>a.fonction==='PHOTOGRAPHE');
    const ret=assignments.active.find(a=>a.fonction==='RETOUCHEUR');
    const e={evenement_id:'PRO-'+Utilities.getUuid(),inscription_id:source.inscriptionId,
      code_public:r.code,reservation_id:booking.reservation_id,
      action:r.action,statut_avant:before.statut,statut_apres:r.action,
      photographe_id:shot?shot.agentId:'',retoucheur_id:ret?ret.agentId:'',
      date_prevue_livraison:r.prevision||before.datePrevueLivraison,
      reference_livrable_prive:lastPrivate,
      canal_livraison:r.action==='LIVRE'?r.canal:'',
      preuve_livraison_privee:r.action==='LIVRE'?r.preuve:'',
      nombre_photos_livrees:r.action==='LIVRE'?r.nbPhotos:'',
      agent_auteur_id:ctx.agent.agentId,cle_idempotence:r.cle,empreinte_requete:fingerprint,
      version:before.version+1,cree_utc:now,commentaire_interne:r.note};
    const sheet=ctx.book.getSheetByName('HISTORIQUE_PRODUCTION_PHOTO');
    photo3AssertHeader_(sheet,PHOTO5_EVENT_KEYS_);
    sheet.appendRow(PHOTO5_EVENT_KEYS_.map(k=>e[k]));SpreadsheetApp.flush();
    const next=photo5State_(hist.concat([e]),source.inscriptionId,booking.reservation_id);
    const warnings=[];
    try{photo5RepairProduction_(ctx.book,next,booking);}catch(err){warnings.push('PROJECTION_A_RECONCILIER');}
    try{photo5Audit_(ctx.book,ctx.agent.agentId,source.inscriptionId,'PRODUCTION_'+r.action,e.evenement_id,fingerprint);}catch(err){warnings.push('AUDIT_A_RECONCILIER');}
    return {ok:true,replay:false,production:photo5Public_(next,assignments,ctx.book),avertissements:warnings};
  }finally{lock.releaseLock();}
}

function photo5RepairProduction_(book,st,booking){
  if(st.version===0)return;
  const sh=book.getSheetByName('SUIVI_PRODUCTION');if(!sh)throw new Error('PROJECTION_INDISPONIBLE');
  photo3AssertHeader_(sh,PHOTO5_PROJECTION_KEYS_);
  const rows=sh.getDataRange().getDisplayValues();const hits=[];
  rows.slice(1).forEach((r,i)=>{if(r[1]===st.inscriptionId)hits.push(i+2);});
  if(hits.length>1)throw new Error('PROJECTION_DUPLIQUEE');
  const item={suivi_id:'SVI-'+st.inscriptionId,inscription_id:st.inscriptionId,
    code_public:st.code,statut_production:st.statut,photographe_id:st.photographeId,
    date_realisation:st.dateRealisation,date_prevue_livraison:st.datePrevueLivraison,
    date_livraison:st.dateLivraison,reference_livrable_prive:st.referenceLivrablePrive,
    maj_utc:new Date().toISOString(),version:st.version,note:st.lastComment,
    reservation_id:st.reservationId,retoucheur_id:st.retoucheurId,
    derniere_action_id:st.lastId,canal_livraison:st.canalLivraison,
    preuve_livraison_privee:st.preuveLivraisonPrive,
    nombre_photos_livrees:st.nombrePhotosLivrees||'',
    version_reservation:booking?Number(booking.version):'',
    livraison_validee_par:st.livraisonValideePar};
  const values=PHOTO5_PROJECTION_KEYS_.map(k=>item[k]??'');
  if(hits.length)sh.getRange(hits[0],1,1,values.length).setValues([values]);
  else sh.appendRow(values);
}
function photo5RepairAssignments_(book,state){
  const sh=book.getSheetByName('AFFECTATIONS_PHOTO');if(!sh)throw new Error('PROJECTION_INDISPONIBLE');
  photo3AssertHeader_(sh,PHOTO5_ASSIGN_VIEW_KEYS_);
  const rows=sh.getDataRange().getDisplayValues();
  for(const x of state.items){
    const key=x.inscriptionId+'|'+x.fonction+'|'+x.agentId;
    const hits=[];
    rows.slice(1).forEach((r,i)=>{if(r[1]+'|'+r[3]+'|'+r[2]===key)hits.push(i+2);});
    if(hits.length>1)throw new Error('PROJECTION_DUPLIQUEE');
    const val={affectation_id:'AFV-'+x.inscriptionId+'-'+x.agentId+'-'+x.fonction,
      inscription_id:x.inscriptionId,agent_id:x.agentId,fonction:x.fonction,
      statut:x.active?'ACTIVE':'RETIREE',date_affectation_utc:x.at,note:x.note,
      code_public:x.code,reservation_id:x.reservationId,version_affectation:x.version,
      dernier_evenement_id:x.eventId,maj_utc:new Date().toISOString()};
    const out=PHOTO5_ASSIGN_VIEW_KEYS_.map(k=>val[k]??'');
    if(hits.length)sh.getRange(hits[0],1,1,out.length).setValues([out]);
    else{sh.appendRow(out);rows.push(out);}
  }
}
function photo5Audit_(book,agentId,inscriptionId,action,eventId,hash){
  const sh=book.getSheetByName('AUDIT');if(!sh)throw new Error('AUDIT_INDISPONIBLE');
  sh.appendRow(['AUD-'+Utilities.getUuid(),new Date().toISOString(),agentId,action,
    inscriptionId,'','ENREGISTRE',eventId,hash.slice(0,20),'Journal LOT5 autoritaire']);
}
/** For editor-only reconciliation; never called from an unauthenticated page. */
function reconcilerProductionPhoto_(){
  const book=controlWorkbook_();const prod=photo5Events_(book),assign=photo5AssignmentEvents_(book);
  const ids=Array.from(new Set(prod.map(x=>x.inscription_id).concat(assign.map(x=>x.inscription_id))));
  const result={reconcilies:0,problemes:[]};
  ids.forEach(id=>{
    try{
      const b=photo3Latest_(book,id);if(!b)throw new Error('RESERVATION_ABSENTE');
      const ast=photo5AssignmentsState_(assign,id,b.reservation_id);
      const st=photo5State_(prod,id,b.reservation_id);
      photo5RepairAssignments_(book,ast);photo5RepairProduction_(book,st,b);
      result.reconcilies++;
    }catch(e){result.problemes.push({inscriptionId:id,code:String(e.message||e)});}
  });return result;
}
/** Diagnostic, requires manual execution by the file owner in Apps Script editor. */
function diagnosticControlLot5_(){
  const book=controlWorkbook_();const s=readControlSettings_(book);
  return {release:PHOTO5_VERSION_,onglets:['HISTORIQUE_PRODUCTION_PHOTO','HISTORIQUE_AFFECTATIONS_PHOTO','SUIVI_PRODUCTION','AFFECTATIONS_PHOTO']
    .filter(n=>!book.getSheetByName(n)),
    productionVerrouillee:s.PRODUCTION_PHOTO_ACTIF==='NON',
    livraisonVerrouillee:s.PHOTO_LIVRAISON_ACTIF==='NON',
    clientsInchanges:true};
}
