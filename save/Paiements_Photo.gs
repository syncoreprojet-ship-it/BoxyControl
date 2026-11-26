/**
 * BOXY CONTROL - LOT 6/7 - payments, receipts, cash desk.
 * PREPRODUCTION: default flags remain OFF. No transfers to Mobile Money or BOXY ADMIN.
 * Single financial authority: append-only HISTORIQUE_PAIEMENTS. PAIEMENTS and RECUS_PHOTO
 * are projections. SYNC_ADMIN is an unsent outbox. BOXY_CLIENT is read-only.
 */
const PHOTO6_VERSION_ = '6.0.0-rc1';
const PHOTO6_EVENTS_ = ['evenement_id','transaction_id','inscription_id','code_public','action',
  'type_mouvement','methode','fournisseur','montant_fcfa','statut_avant','statut_apres',
  'reference_externe','transaction_origine_id','agent_auteur_id','agent_verificateur_id',
  'preuve_verification_privee','cle_idempotence','empreinte_requete','version','cree_utc',
  'jour_caisse','devis_client_fcfa','commentaire_interne','numero_recu'];
const PHOTO6_PROJECTION_ = ['transaction_id','inscription_id','code_public','type_mouvement',
  'methode','montant_fcfa','statut_validation','reference_externe','agent_id','verifie_par',
  'encaisse_le_utc','verifie_le_utc','cle_idempotence','transaction_origine_id','note',
  'version','dernier_evenement_id','fournisseur_mm','preuve_verification_privee',
  'numero_recu','jour_caisse','devis_client_fcfa','commentaire_interne'];
const PHOTO6_RECEIPTS_ = ['numero_recu','transaction_id','inscription_id','code_public',
  'methode','type_mouvement','montant_fcfa','date_validation_utc','evenement_validation_id',
  'reference_externe_masquee','statut','version'];
const PHOTO6_CLOSING_EVENTS_ = ['evenement_id','cloture_id','jour_caisse','caissier_id',
  'action','total_especes_valide_fcfa','especes_comptees_fcfa','ecart_fcfa','statut_apres',
  'superviseur_id','cle_idempotence','empreinte_requete','version','cree_utc','commentaire'];
const PHOTO6_CLOSING_PROJECTION_ = ['cloture_id','date_jour','agent_id',
  'especes_theoriques_fcfa','especes_comptees_fcfa','ecart_fcfa','statut_cloture',
  'valide_par','date_cloture_utc','note','version_cloture','dernier_evenement_id','empreinte_requete'];

function photo6Context_(idToken,permission,write){
  const identity=verifyGoogleIdToken_(idToken);
  const book=controlWorkbook_();
  const agent=findEnabledAgent_(book,identity);
  const settings=readControlSettings_(book);
  const rights=loadRolePermissions_(book,agent.role);
  if(!rights.includes(permission))throw new Error('AUTORISATION_REFUSEE');
  if(!['TEST','PRODUCTION'].includes(settings.APP_MODE))throw new Error('CAISSE_DESACTIVEE');
  const prop=PropertiesService.getScriptProperties();
  if(settings.APP_MODE==='TEST' && prop.getProperty('CONTROL_USE_TEST_SHEET')!=='OUI')throw new Error('COPIE_CONTROL_TEST_OBLIGATOIRE');
  if(settings.APP_MODE==='PRODUCTION' && prop.getProperty('CONTROL_USE_TEST_SHEET')==='OUI')throw new Error('CONFIGURATION_ENVIRONNEMENT_INCOHERENTE');
  if(write && (settings.OPERATIONS_ACTIVES!=='OUI'||settings.PAIEMENTS_ACTIFS!=='OUI'))throw new Error('PAIEMENTS_DESACTIVES');
  return {book,agent,settings,rights};
}
function photo6CheckSwitch_(ctx,which){
  if(ctx.settings[which]!=='OUI')throw new Error('FONCTION_CAISSE_DESACTIVEE');
}
function photo6AssertHeader_(sheet,fields){
  if(!sheet)throw new Error('CONFIGURATION_CAISSE_INCOMPLETE');
  const h=sheet.getRange(1,1,1,fields.length).getDisplayValues()[0];
  if(fields.some((x,i)=>h[i]!==x))throw new Error('SCHEMA_CAISSE_INCOMPATIBLE');
}
function photo6Read_(book,name,keys){
  const sheet=book.getSheetByName(name);photo6AssertHeader_(sheet,keys);
  const data=sheet.getDataRange().getDisplayValues().slice(1);
  return data.filter(r=>r[0]).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]])));
}
function photo6Safe_(text,max){
  const v=String(text==null?'':text).trim();
  if(v.length>max||/[<>\x00-\x1F]/.test(v)||/^[=+@-]/.test(v))throw new Error('TEXTE_INVALIDE');
  return v;
}
function photo6Private_(v){
  const s=photo6Safe_(v,120);
  if(s && !/^[A-Za-z0-9_:\/-]{8,120}$/.test(s))throw new Error('PREUVE_PRIVEE_INVALIDE');
  if(/^https?:/i.test(s))throw new Error('PREUVE_PRIVEE_INVALIDE');
  return s;
}
function photo6Idem_(s){
  const v=String(s||'').trim();
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(v))throw new Error('CLE_INVALIDE');
  return v;
}
function photo6Int_(v,min,max,name){
  const n=Number(v);
  if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(name||'MONTANT_INVALIDE');
  return n;
}
function photo6Hash_(v){
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(v),Utilities.Charset.UTF_8);
  return digest.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function photo6EventSource_(settings,code){
  const src=ouvrirSourceClientPhoto_(settings); // read-only, test copies enforced by LOT2
  const sh=src.getSheetByName('INSCRIPTIONS');if(!sh)throw new Error('SOURCE_INDISPONIBLE');
  const rows=sh.getDataRange().getDisplayValues(),h=rows[0]||[];
  const at={};['inscription_id','code_public','code_prestation','statut','details_json'].forEach(k=>{
    at[k]=h.indexOf(k);if(at[k]<0)throw new Error('SCHEMA_CLIENT_INCOMPATIBLE');
  });
  const matches=rows.slice(1).filter(r=>String(r[at.code_public]||'').trim()===code);
  if(matches.length!==1||String(matches[0][at.code_prestation]).toUpperCase()!=='SHOOTING')throw new Error('DEMANDE_INTROUVABLE');
  const row=matches[0];
  let details={};try{details=JSON.parse(String(row[at.details_json]||'{}'));}catch(e){throw new Error('DEVIS_INDISPONIBLE');}
  const quote=Number(details&&details.devis&&details.devis.total_fcfa);
  if(!Number.isSafeInteger(quote)||quote<1||quote>999999999)throw new Error('DEVIS_INDISPONIBLE');
  const inscriptionId=String(row[at.inscription_id]||'');
  if(!/^[A-Za-z0-9_-]{6,120}$/.test(inscriptionId))throw new Error('DOSSIER_INVALIDE');
  return {inscriptionId,code,devisFcfa:quote,statutClient:String(row[at.statut]||'RECU').toUpperCase()};
}
function photo6ReadyQuote_(ctx,code){
  if(ctx.settings.APP_MODE==='PRODUCTION'&&ctx.settings.PHOTO_DEVIS_OFFICIELS_VALIDES!=='OUI')throw new Error('DEVIS_NON_VALIDES');
  return photo6EventSource_(ctx.settings,code);
}
function photo6States_(events){
  const states=new Map();const unique=new Set();
  for(const e of events){
    if(unique.has(e.evenement_id))throw new Error('JOURNAL_PAIEMENT_INCOHERENT');unique.add(e.evenement_id);
    const n=Number(e.version),v=photo6Int_(n,1,100000,'JOURNAL_PAIEMENT_INCOHERENT');
    const previous=states.get(e.transaction_id);
    if((previous&&v!==previous.version+1)||(!previous&&v!==1))throw new Error('JOURNAL_PAIEMENT_INCOHERENT');
    if(!previous){
      if(e.action!=='ENREGISTRER'||e.statut_apres!=='EN_ATTENTE'||!['ENCAISSEMENT','REMBOURSEMENT'].includes(e.type_mouvement))throw new Error('JOURNAL_PAIEMENT_INCOHERENT');
      states.set(e.transaction_id,{transactionId:e.transaction_id,inscriptionId:e.inscription_id,
        code:e.code_public,type:e.type_mouvement,methode:e.methode,fournisseur:e.fournisseur,
        montant:photo6Int_(e.montant_fcfa,1,999999999,'JOURNAL_PAIEMENT_INCOHERENT'),
        reference:e.reference_externe,origine:e.transaction_origine_id,create:e,decide:null,
        statut:'EN_ATTENTE',version:v,dernier:e});
    }else{
      if(!['VALIDER','REJETER'].includes(e.action)||previous.statut!=='EN_ATTENTE'||
         !['VALIDE','REJETE'].includes(e.statut_apres)||e.statut_apres!==(e.action==='VALIDER'?'VALIDE':'REJETE')||
         e.inscription_id!==previous.inscriptionId||Number(e.montant_fcfa)!==previous.montant||
         e.methode!==previous.methode||e.type_mouvement!==previous.type)throw new Error('JOURNAL_PAIEMENT_INCOHERENT');
      states.set(e.transaction_id,{...previous,statut:e.statut_apres,decide:e,dernier:e,version:v});
    }
  }
  return states;
}
function photo6Summary_(states,source){
  let valides=0,attentes=0,rembourses=0,totalMobile=0;
  const transactions=[];
  for(const t of states.values()){
    if(!t.transactionId.startsWith('TXN-')||t.inscriptionId!==source.inscriptionId)continue;
    if(t.type==='ENCAISSEMENT'){
      if(t.statut==='VALIDE'){valides+=t.montant;if(t.methode==='MOBILE_MONEY')totalMobile+=t.montant;}
      if(t.statut==='EN_ATTENTE')attentes+=t.montant;
    }else if(t.type==='REMBOURSEMENT'){
      if(t.statut==='VALIDE')rembourses+=t.montant;
      if(t.statut==='EN_ATTENTE')attentes-=t.montant;
    }
    transactions.push(photo6Public_(t));
  }
  const net=valides-rembourses;
  return {devisFcfa:source.devisFcfa,totalValideFcfa:net,totalEnAttenteFcfa:attentes,
    soldeFcfa:Math.max(0,source.devisFcfa-net),totalMobileValideFcfa:totalMobile,
    statutPaiement:net>=source.devisFcfa?'REGLE':net>0?'PARTIEL':'NON_REGLE',transactions};
}
function photo6Public_(t){
  return {id:t.transactionId,type:t.type,methode:t.methode,
    fournisseur:t.fournisseur||'',montantFcfa:t.montant,statut:t.statut,
    version:t.version,numeroRecu:t.decide&&t.decide.statut_apres==='VALIDE'?t.decide.numero_recu:'',
    date:t.decide?t.decide.cree_utc:t.create.cree_utc,
    referenceMasquee:t.reference?('****'+t.reference.slice(-4)):'',
    origine:t.origine||''};
}
function photo6Audit_(book,agentId,action,sourceId,txId,fp){
  const sh=book.getSheetByName('AUDIT');if(!sh)throw new Error('AUDIT_INDISPONIBLE');
  sh.appendRow(['AUD-'+Utilities.getUuid(),new Date().toISOString(),agentId,action,sourceId,txId,
    'ENREGISTRE','COR-'+Utilities.getUuid(),fp.slice(0,18),'LOT6: journal canonique']);
}
function photo6Projection_(book,t){
  const sh=book.getSheetByName('PAIEMENTS');photo6AssertHeader_(sh,PHOTO6_PROJECTION_);
  const row={transaction_id:t.transactionId,inscription_id:t.inscriptionId,code_public:t.code,
    type_mouvement:t.type,methode:t.methode,montant_fcfa:t.montant,statut_validation:t.statut,
    reference_externe:t.reference,agent_id:t.create.agent_auteur_id,
    verifie_par:t.decide?t.decide.agent_verificateur_id:'',encaisse_le_utc:t.create.cree_utc,
    verifie_le_utc:t.decide?t.decide.cree_utc:'',cle_idempotence:t.create.cle_idempotence,
    transaction_origine_id:t.origine,note:t.create.commentaire_interne,
    version:t.version,dernier_evenement_id:t.dernier.evenement_id,
    fournisseur_mm:t.fournisseur,preuve_verification_privee:t.decide?t.decide.preuve_verification_privee:'',
    numero_recu:t.decide&&t.statut==='VALIDE'?t.decide.numero_recu:'',
    jour_caisse:t.decide?t.decide.jour_caisse:'',devis_client_fcfa:t.create.devis_client_fcfa,
    commentaire_interne:t.decide?t.decide.commentaire_interne:''};
  const rows=sh.getDataRange().getDisplayValues();const matching=[];
  for(let i=1;i<rows.length;i++)if(rows[i][0]===t.transactionId)matching.push(i+1);
  if(matching.length>1)throw new Error('PROJECTION_PAIEMENT_AMBIGUE');
  const values=PHOTO6_PROJECTION_.map(k=>row[k]===undefined?'':row[k]);
  if(matching.length)sh.getRange(matching[0],1,1,values.length).setValues([values]);else sh.appendRow(values);
}
function photo6ReceiptProjection_(book,t){
  if(t.statut!=='VALIDE')return;
  const sh=book.getSheetByName('RECUS_PHOTO');photo6AssertHeader_(sh,PHOTO6_RECEIPTS_);
  const e=t.decide,row={numero_recu:e.numero_recu,transaction_id:t.transactionId,
    inscription_id:t.inscriptionId,code_public:t.code,methode:t.methode,
    type_mouvement:t.type,montant_fcfa:t.montant,date_validation_utc:e.cree_utc,
    evenement_validation_id:e.evenement_id,reference_externe_masquee:t.reference?'****'+t.reference.slice(-4):'',
    statut:t.type==='REMBOURSEMENT'?'REMBOURSEMENT_VALIDE':'VALIDE',version:t.version};
  const existing=sh.getDataRange().getDisplayValues(),ix=existing.findIndex((r,i)=>i>0&&r[0]===e.numero_recu);
  const values=PHOTO6_RECEIPTS_.map(k=>row[k]);if(ix>=0)sh.getRange(ix+1,1,1,values.length).setValues([values]);else sh.appendRow(values);
}
function photo6AdminOutbox_(book,t){
  if(t.statut!=='VALIDE')return;
  const sh=book.getSheetByName('SYNC_ADMIN');
  const keys=['evenement_id','transaction_id','type_projection','statut','version','cle_idempotence',
    'cree_utc','envoye_utc','accuse_utc','nb_essais','erreur_securisee'];photo6AssertHeader_(sh,keys);
  if(sh.getDataRange().getDisplayValues().slice(1).some(r=>r[0]===t.decide.evenement_id))return;
  sh.appendRow([t.decide.evenement_id,t.transactionId,t.type==='REMBOURSEMENT'?'REMBOURSEMENT_VALIDE':'TRANSACTION_VALIDEE',
    'A_ENVOYER',String(t.version),t.decide.evenement_id,t.decide.cree_utc,'','',0,'']);
}
function photo6ReconcileOne_(book,t){
  // ACADEMIE uses the same journal, but NOT the PHOTO receipt projection.
  // Read the extended service fields and dispatch before photo-specific repair.
  if(String(t.transactionId||'').startsWith('ACA-TXN-')){
    const records=acad5Ledger_(book),meta=records.byId.get(t.transactionId);
    if(!meta)throw new Error('METADONNEES_ACADEMIE_ABSENTES');
    return acad5ReconcileOne_(book,t,meta);
  }
  const warnings=[];
  try{photo6Projection_(book,t);}catch(e){warnings.push('PROJECTION_A_RECONCILIER');}
  try{photo6ReceiptProjection_(book,t);}catch(e){warnings.push('RECU_A_RECONCILIER');}
  try{photo6AdminOutbox_(book,t);}catch(e){warnings.push('ADMIN_A_RECONCILIER');}
  return warnings;
}
function photo6Append_(book,e){
  BXCT_ENC_SERVICE_append_(book,e,false);
}
function photo6Lock_(){const lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw new Error('SERVICE_OCCUPE');return lock;}
function photo6FindReplay_(events,cle,fp){
  const e=events.find(x=>x.cle_idempotence===cle);
  if(e&&e.empreinte_requete!==fp)throw new Error('CLE_DEJA_UTILISEE');
  return e;
}
function photo6GetContextAndSource_(idToken,permission,code,write){
  const ctx=photo6Context_(idToken,permission,write);
  const clean=normaliserCodePhoto_(code);if(!clean)throw new Error('CODE_INVALIDE');
  const source=photo6ReadyQuote_(ctx,clean);
  return {ctx,source,code:clean};
}

/** Sensitive read; used by the finance screen after identity + permissions checks. */
function controlPhotoEtatPaiements(idToken,codeInput){
  const {ctx,source}=photo6GetContextAndSource_(idToken,'CONSULTER_PAIEMENTS',codeInput,false);
  if(ctx.settings.PAIEMENTS_ACTIFS!=='OUI' && !BXCT_CORE_AUTH_isAdmin_(ctx.agent.role))throw new Error('PAIEMENTS_DESACTIVES');
  const states=photo6States_(photo6Read_(ctx.book,'HISTORIQUE_PAIEMENTS',PHOTO6_EVENTS_));
  photo6Audit_(ctx.book,ctx.agent.agentId,'CONSULTATION_PAIEMENTS',source.inscriptionId,'',photo6Hash_({code:source.code}));
  return {ok:true,code:source.code,summary:photo6Summary_(states,source),canRecord:ctx.settings.OPERATIONS_ACTIVES==='OUI'&&ctx.settings.PAIEMENTS_ACTIFS==='OUI'&&(ctx.rights.includes('ENREGISTRER_ESPECES')||ctx.rights.includes('SOUMETTRE_MOBILE_MONEY')),
    canValidate:ctx.settings.OPERATIONS_ACTIVES==='OUI'&&ctx.settings.PAIEMENTS_ACTIFS==='OUI'&&ctx.rights.some(p=>['VALIDER_ESPECES','VALIDER_MOBILE_MONEY','VALIDER_REMBOURSEMENT'].includes(p)),
    canRefund:ctx.settings.OPERATIONS_ACTIVES==='OUI'&&ctx.settings.PAIEMENTS_ACTIFS==='OUI'&&ctx.rights.includes('ENREGISTRER_REMBOURSEMENT'),release:PHOTO6_VERSION_};
}

function controlPhotoEnregistrerPaiement(idToken,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('DONNEES_INVALIDES');
  const r={code:normaliserCodePhoto_(input.code),type:String(input.typeMouvement||'ENCAISSEMENT'),
    methode:String(input.methode||''),montant:photo6Int_(input.montantFcfa,1,999999999),
    fournisseur:photo6Safe_(input.fournisseur||'',35),reference:photo6Safe_(input.referenceExterne||'',80),
    origine:photo6Safe_(input.transactionOrigineId||'',100),note:photo6Safe_(input.commentaire||'',220),
    cle:photo6Idem_(input.cleIdempotence)};
  if(!r.code||!['ENCAISSEMENT','REMBOURSEMENT'].includes(r.type)||!['ESPECES','MOBILE_MONEY'].includes(r.methode))throw new Error('DONNEES_INVALIDES');
  if(r.methode==='ESPECES'&&(r.fournisseur||r.reference))throw new Error('REFERENCE_INUTILE');
  if(r.methode==='MOBILE_MONEY'&&(!['ORANGE_MONEY','MOOV_MONEY','AUTRE'].includes(r.fournisseur)||!/^[A-Za-z0-9_-]{6,80}$/.test(r.reference)))throw new Error('REFERENCE_MM_OBLIGATOIRE');
  if(r.type==='ENCAISSEMENT'&&r.origine)throw new Error('ORIGINE_INVALIDE');
  if(r.type==='REMBOURSEMENT'&&!/^TXN-[a-zA-Z0-9-]{8,100}$/.test(r.origine))throw new Error('ORIGINE_INVALIDE');
  const right=r.type==='REMBOURSEMENT'?'ENREGISTRER_REMBOURSEMENT':r.methode==='ESPECES'?'ENREGISTRER_ESPECES':'SOUMETTRE_MOBILE_MONEY';
  const {ctx,source}=photo6GetContextAndSource_(idToken,right,r.code,true);
  if(r.type==='REMBOURSEMENT')photo6CheckSwitch_(ctx,'PHOTO_REMBOURSEMENTS_ACTIFS');
  if(r.methode==='ESPECES')photo6CheckSwitch_(ctx,'CAISSE_PHOTO_ACTIVE');
  const fp=photo6Hash_(r),lock=photo6Lock_();
  try{
    const events=photo6Read_(ctx.book,'HISTORIQUE_PAIEMENTS',PHOTO6_EVENTS_);
    const states=photo6States_(events);
    const already=photo6FindReplay_(events,r.cle,fp);
    if(already){const t=states.get(already.transaction_id);if(!t||!t.transactionId.startsWith('TXN-')||t.inscriptionId!==source.inscriptionId)throw new Error('CLE_DEJA_UTILISEE');return {ok:true,replay:true,transaction:photo6Public_(t),summary:photo6Summary_(states,source),avertissements:photo6ReconcileOne_(ctx.book,t)};}
    if(r.methode==='MOBILE_MONEY'){
      for(const t of states.values())if(t.methode==='MOBILE_MONEY'&&t.fournisseur===r.fournisseur&&t.reference.toUpperCase()===r.reference.toUpperCase())throw new Error('REFERENCE_MM_DEJA_UTILISEE');
    }
    if(r.type==='ENCAISSEMENT'){
      if(['ANNULEE','REFUSEE'].includes(source.statutClient))throw new Error('DOSSIER_CLIENT_NON_ELIGIBLE');
      const summary=photo6Summary_(states,source);
      if(r.montant>summary.devisFcfa-summary.totalValideFcfa-summary.totalEnAttenteFcfa)throw new Error('MONTANT_DEPASSE_DEVIS');
    }else{
      const original=states.get(r.origine);
      if(!original||original.inscriptionId!==source.inscriptionId||original.type!=='ENCAISSEMENT'||original.statut!=='VALIDE'||original.methode!==r.methode)throw new Error('TRANSACTION_ORIGINE_INVALIDE');
      let alreadyRefunded=0;
      for(const t of states.values())if(t.type==='REMBOURSEMENT'&&t.origine===r.origine&&t.statut!=='REJETE')alreadyRefunded+=t.montant;
      if(r.montant>original.montant-alreadyRefunded)throw new Error('REMBOURSEMENT_DEPASSE_ORIGINE');
    }
    const now=new Date().toISOString();
    const event={evenement_id:'FNE-'+Utilities.getUuid(),transaction_id:'TXN-'+Utilities.getUuid(),
      inscription_id:source.inscriptionId,code_public:r.code,action:'ENREGISTRER',
      type_mouvement:r.type,methode:r.methode,fournisseur:r.fournisseur,montant_fcfa:r.montant,
      statut_avant:'',statut_apres:'EN_ATTENTE',reference_externe:r.reference,
      transaction_origine_id:r.origine,agent_auteur_id:ctx.agent.agentId,agent_verificateur_id:'',
      preuve_verification_privee:'',cle_idempotence:r.cle,empreinte_requete:fp,version:1,
      cree_utc:now,jour_caisse:'',devis_client_fcfa:source.devisFcfa,commentaire_interne:r.note,numero_recu:''};
    photo6Append_(ctx.book,event);
    const t=photo6States_(events.concat([event])).get(event.transaction_id);
    const warnings=photo6ReconcileOne_(ctx.book,t);
    try{photo6Audit_(ctx.book,ctx.agent.agentId,'PAIEMENT_EN_ATTENTE',source.inscriptionId,t.transactionId,fp);}catch(e){warnings.push('AUDIT_A_RECONCILIER');}
    return {ok:true,replay:false,transaction:photo6Public_(t),summary:photo6Summary_(photo6States_(events.concat([event])),source),avertissements:warnings};
  }finally{lock.releaseLock();}
}

function controlPhotoDeciderPaiement(idToken,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('DONNEES_INVALIDES');
  const transactionId=String(input.transactionId||'').trim();
  if(!/^TXN-[A-Za-z0-9-]{8,100}$/.test(transactionId))throw new Error('TRANSACTION_INVALIDE');
  const action=String(input.action||'');if(!['VALIDER','REJETER'].includes(action))throw new Error('DECISION_INVALIDE');
  const r={transactionId,action,version:photo6Int_(input.versionAttendue,1,100000,'VERSION_INVALIDE'),
    preuve:photo6Private_(input.preuveVerificationPrivee||''),
    mmConfirme:input.verificationExterneConfirmee===true,especesConfirmees:input.especesPhysiquementConfirmees===true,
    note:photo6Safe_(input.commentaire||'',220),cle:photo6Idem_(input.cleIdempotence)};
  const ctx=photo6Context_(idToken,'CONSULTER_PAIEMENTS',true);
  const lock=photo6Lock_(),fp=photo6Hash_(r);
  try{
    const events=photo6Read_(ctx.book,'HISTORIQUE_PAIEMENTS',PHOTO6_EVENTS_),states=photo6States_(events);
    const replay=photo6FindReplay_(events,r.cle,fp);
    if(replay){const st=states.get(replay.transaction_id);if(!st||!st.transactionId.startsWith('TXN-')||st.transactionId!==r.transactionId)throw new Error('CLE_DEJA_UTILISEE');return {ok:true,replay:true,transaction:photo6Public_(st),avertissements:photo6ReconcileOne_(ctx.book,st)};}
    const t=states.get(r.transactionId);if(!t)throw new Error('TRANSACTION_INTROUVABLE');
    if(t.statut!=='EN_ATTENTE'||r.version!==t.version)throw new Error('TRANSACTION_MODIFIEE_RECHARGER');
    const permission=t.type==='REMBOURSEMENT'?'VALIDER_REMBOURSEMENT':t.methode==='ESPECES'?'VALIDER_ESPECES':'VALIDER_MOBILE_MONEY';
    if(!ctx.rights.includes(permission))throw new Error('AUTORISATION_REFUSEE');
    if(t.type==='REMBOURSEMENT')photo6CheckSwitch_(ctx,'PHOTO_REMBOURSEMENTS_ACTIFS');
    if(t.methode==='ESPECES')photo6CheckSwitch_(ctx,'CAISSE_PHOTO_ACTIVE');
    if(t.methode==='MOBILE_MONEY')photo6CheckSwitch_(ctx,'PHOTO_MM_VALIDATION_ACTIVE');
    if(action==='VALIDER'){
      if(ctx.agent.agentId===t.create.agent_auteur_id)throw new Error('DOUBLE_CONTROLE_OBLIGATOIRE');
      if(t.methode==='MOBILE_MONEY'&&(!r.mmConfirme||!r.preuve))throw new Error('VERIFICATION_MM_EXTERNE_OBLIGATOIRE');
      if(t.methode==='ESPECES'&&!r.especesConfirmees)throw new Error('ESPECES_NON_VERIFIEES');
      if(t.type==='REMBOURSEMENT'){
        const orig=states.get(t.origine);
        if(!orig||orig.statut!=='VALIDE')throw new Error('TRANSACTION_ORIGINE_INVALIDE');
      }
    }else if(r.note.length<6)throw new Error('MOTIF_REJET_OBLIGATOIRE');
    const now=new Date().toISOString(),day=Utilities.formatDate(new Date(),'Africa/Bamako','yyyy-MM-dd');
    const event={evenement_id:'FNE-'+Utilities.getUuid(),transaction_id:t.transactionId,
      inscription_id:t.inscriptionId,code_public:t.code,action,
      type_mouvement:t.type,methode:t.methode,fournisseur:t.fournisseur,montant_fcfa:t.montant,
      statut_avant:t.statut,statut_apres:action==='VALIDER'?'VALIDE':'REJETE',
      reference_externe:t.reference,transaction_origine_id:t.origine,
      agent_auteur_id:t.create.agent_auteur_id,agent_verificateur_id:ctx.agent.agentId,
      preuve_verification_privee:action==='VALIDER'?r.preuve:'',cle_idempotence:r.cle,
      empreinte_requete:fp,version:t.version+1,cree_utc:now,jour_caisse:action==='VALIDER'?day:'',
      devis_client_fcfa:t.create.devis_client_fcfa,commentaire_interne:r.note,
      numero_recu:action==='VALIDER'?'REC-'+day.replace(/-/g,'')+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,10).toUpperCase():''};
    photo6Append_(ctx.book,event);
    const n=photo6States_(events.concat([event])).get(t.transactionId);
    const warnings=photo6ReconcileOne_(ctx.book,n);
    try{photo6Audit_(ctx.book,ctx.agent.agentId,'PAIEMENT_'+action,t.inscriptionId,t.transactionId,fp);}catch(e){warnings.push('AUDIT_A_RECONCILIER');}
    return {ok:true,replay:false,transaction:photo6Public_(n),avertissements:warnings};
  }finally{lock.releaseLock();}
}
function controlPhotoRecuPaiement(idToken,transactionId){
  const ctx=photo6Context_(idToken,'CONSULTER_PAIEMENTS',false);
  photo6CheckSwitch_(ctx,'PHOTO_RECU_ACTIF');
  const states=photo6States_(photo6Read_(ctx.book,'HISTORIQUE_PAIEMENTS',PHOTO6_EVENTS_));
  const t=states.get(String(transactionId||''));if(!t||!t.transactionId.startsWith('TXN-')||t.statut!=='VALIDE')throw new Error('RECU_INDISPONIBLE');
  photo6Audit_(ctx.book,ctx.agent.agentId,'CONSULTATION_RECU',t.inscriptionId,t.transactionId,'RECU');
  return {ok:true,numero:t.decide.numero_recu,dateUtc:t.decide.cree_utc,code:t.code,
    type:t.type,methode:t.methode,montantFcfa:t.montant,
    referenceMasquee:t.reference?'****'+t.reference.slice(-4):'',
    mention:'Justificatif interne de paiement verifie - BOXY STUDIO'};
}
function photo6Desk_(states,jour,caissierId){
  let cash=0,mobile=0,count=0;
  for(const t of states.values())if(t.transactionId.startsWith('TXN-')&&t.statut==='VALIDE'&&t.create.agent_auteur_id===caissierId&&t.decide.jour_caisse===jour){
    const delta=t.type==='REMBOURSEMENT'?-t.montant:t.montant;
    if(t.methode==='ESPECES')cash+=delta;else mobile+=delta;
    count++;
  }
  return {jour,caissierId,especesTheoriquesFcfa:cash,mobileMoneyVerifieFcfa:mobile,nombreTransactions:count};
}
function photo6ClosingStates_(events){
  const m=new Map();for(const e of events){const old=m.get(e.cloture_id),v=Number(e.version);
    if((!old&&v!==1)||(old&&v!==old.version+1))throw new Error('JOURNAL_CLOTURE_INCOHERENT');
    if(!old&&e.action!=='SOUMETTRE')throw new Error('JOURNAL_CLOTURE_INCOHERENT');
    if(old&&e.action!=='VALIDER')throw new Error('JOURNAL_CLOTURE_INCOHERENT');
    m.set(e.cloture_id,{id:e.cloture_id,jour:e.jour_caisse,caissierId:e.caissier_id,
      theoriques:Number(e.total_especes_valide_fcfa),comptes:Number(e.especes_comptees_fcfa),
      ecart:Number(e.ecart_fcfa),statut:e.statut_apres,version:v,last:e});}
  return m;
}
function photo6ClosingProjection_(book,s){
  const sh=book.getSheetByName('CAISSE_JOUR');photo6AssertHeader_(sh,PHOTO6_CLOSING_PROJECTION_);
  const e=s.last,record={cloture_id:s.id,date_jour:s.jour,agent_id:s.caissierId,
    especes_theoriques_fcfa:s.theoriques,especes_comptees_fcfa:s.comptes,ecart_fcfa:s.ecart,
    statut_cloture:s.statut,valide_par:e.statut_apres==='VALIDEE'?e.superviseur_id:'',
    date_cloture_utc:e.statut_apres==='VALIDEE'?e.cree_utc:'',note:e.commentaire,
    version_cloture:s.version,dernier_evenement_id:e.evenement_id,empreinte_requete:e.empreinte_requete};
  const vals=PHOTO6_CLOSING_PROJECTION_.map(k=>record[k]);const data=sh.getDataRange().getDisplayValues();
  const indexes=data.map((r,i)=>r[0]===s.id?i+1:0).filter(Boolean);
  if(indexes.length>1)throw new Error('PROJECTION_CLOTURE_AMBIGUE');
  if(indexes.length)sh.getRange(indexes[0],1,1,vals.length).setValues([vals]);else sh.appendRow(vals);
}
function controlPhotoCaisseJour(idToken,jour){
  const ctx=photo6Context_(idToken,'CONSULTER_PAIEMENTS',false);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(jour||'')))throw new Error('DATE_INVALIDE');
  const states=photo6States_(photo6Read_(ctx.book,'HISTORIQUE_PAIEMENTS',PHOTO6_EVENTS_));
  const own=photo6Desk_(states,String(jour),ctx.agent.agentId);
  const closes=photo6ClosingStates_(photo6Read_(ctx.book,'HISTORIQUE_CLOTURES_CAISSE',PHOTO6_CLOSING_EVENTS_));
  const closing=Array.from(closes.values()).find(x=>x.jour===jour&&x.caissierId===ctx.agent.agentId);
  return {ok:true,bilan:own,cloture:closing?{id:closing.id,statut:closing.statut,version:closing.version,ecartFcfa:closing.ecart}:null};
}
function controlPhotoSoumettreCloture(idToken,input){
  const ctx=photo6Context_(idToken,'CLOTURER_CAISSE',true);photo6CheckSwitch_(ctx,'PHOTO_CAISSE_CLOTURE_ACTIVE');
  if(!input||typeof input!=='object')throw new Error('DONNEES_INVALIDES');
  const r={jour:String(input.jour||''),compte:photo6Int_(input.especesCompteFcfa,0,999999999),
    cle:photo6Idem_(input.cleIdempotence),note:photo6Safe_(input.commentaire||'',180)};
  const today=Utilities.formatDate(new Date(),'Africa/Bamako','yyyy-MM-dd');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.jour)||r.jour>today)throw new Error('DATE_INVALIDE');
  const fp=photo6Hash_(r),lock=photo6Lock_();
  try{
    const events=photo6Read_(ctx.book,'HISTORIQUE_CLOTURES_CAISSE',PHOTO6_CLOSING_EVENTS_);
    const exists=photo6FindReplay_(events,r.cle,fp);const all=photo6ClosingStates_(events);
    if(exists){const s=all.get(exists.cloture_id);return {ok:true,replay:true,cloture:{id:s.id,statut:s.statut,ecartFcfa:s.ecart}};}
    if(Array.from(all.values()).some(s=>s.jour===r.jour&&s.caissierId===ctx.agent.agentId))throw new Error('CLOTURE_DEJA_SOUMISE');
    const states=photo6States_(photo6Read_(ctx.book,'HISTORIQUE_PAIEMENTS',PHOTO6_EVENTS_));
    const bilan=photo6Desk_(states,r.jour,ctx.agent.agentId),theorique=bilan.especesTheoriquesFcfa;
    const e={evenement_id:'CLE-'+Utilities.getUuid(),cloture_id:'CLO-'+Utilities.getUuid(),
      jour_caisse:r.jour,caissier_id:ctx.agent.agentId,action:'SOUMETTRE',
      total_especes_valide_fcfa:theorique,especes_comptees_fcfa:r.compte,
      ecart_fcfa:r.compte-theorique,statut_apres:'EN_REVUE',superviseur_id:'',
      cle_idempotence:r.cle,empreinte_requete:fp,version:1,cree_utc:new Date().toISOString(),commentaire:r.note};
    const sh=ctx.book.getSheetByName('HISTORIQUE_CLOTURES_CAISSE');photo6AssertHeader_(sh,PHOTO6_CLOSING_EVENTS_);
    sh.appendRow(PHOTO6_CLOSING_EVENTS_.map(k=>e[k]));SpreadsheetApp.flush();
    const st=photo6ClosingStates_(events.concat([e])).get(e.cloture_id);
    const warnings=[];try{photo6ClosingProjection_(ctx.book,st);}catch(e){warnings.push('PROJECTION_A_RECONCILIER');}
    return {ok:true,replay:false,cloture:{id:st.id,statut:st.statut,ecartFcfa:st.ecart},avertissements:warnings};
  }finally{lock.releaseLock();}
}
function controlPhotoValiderCloture(idToken,input){
  const ctx=photo6Context_(idToken,'VALIDER_CLOTURE',true);photo6CheckSwitch_(ctx,'PHOTO_CAISSE_CLOTURE_ACTIVE');
  if(!input||typeof input!=='object')throw new Error('DONNEES_INVALIDES');
  const r={id:String(input.clotureId||''),version:photo6Int_(input.versionAttendue,1,10000,'VERSION_INVALIDE'),
    cle:photo6Idem_(input.cleIdempotence),note:photo6Safe_(input.commentaire||'',180)};
  if(!/^CLO-[A-Za-z0-9-]{8,100}$/.test(r.id))throw new Error('CLOTURE_INVALIDE');
  const fp=photo6Hash_(r),lock=photo6Lock_();
  try{
    const events=photo6Read_(ctx.book,'HISTORIQUE_CLOTURES_CAISSE',PHOTO6_CLOSING_EVENTS_);
    const already=photo6FindReplay_(events,r.cle,fp),states=photo6ClosingStates_(events);
    if(already){const c=states.get(already.cloture_id);return {ok:true,replay:true,statut:c.statut};}
    const c=states.get(r.id);if(!c)throw new Error('CLOTURE_INTROUVABLE');
    if(c.statut!=='EN_REVUE'||c.version!==r.version)throw new Error('CLOTURE_MODIFIEE');
    if(c.caissierId===ctx.agent.agentId)throw new Error('DOUBLE_CONTROLE_OBLIGATOIRE');
    const money=photo6States_(photo6Read_(ctx.book,'HISTORIQUE_PAIEMENTS',PHOTO6_EVENTS_));
    const actual=photo6Desk_(money,c.jour,c.caissierId).especesTheoriquesFcfa;
    if(actual!==c.theoriques)throw new Error('CAISSE_MODIFIEE_RECOMPTER');
    const e={...c.last,evenement_id:'CLE-'+Utilities.getUuid(),action:'VALIDER',statut_apres:'VALIDEE',
      superviseur_id:ctx.agent.agentId,cle_idempotence:r.cle,empreinte_requete:fp,
      version:c.version+1,cree_utc:new Date().toISOString(),commentaire:r.note};
    const sh=ctx.book.getSheetByName('HISTORIQUE_CLOTURES_CAISSE');photo6AssertHeader_(sh,PHOTO6_CLOSING_EVENTS_);
    sh.appendRow(PHOTO6_CLOSING_EVENTS_.map(k=>e[k]));SpreadsheetApp.flush();
    const st=photo6ClosingStates_(events.concat([e])).get(c.id);
    const warnings=[];try{photo6ClosingProjection_(ctx.book,st);}catch(e){warnings.push('PROJECTION_A_RECONCILIER');}
    return {ok:true,replay:false,statut:st.statut,ecartFcfa:st.ecart,avertissements:warnings};
  }finally{lock.releaseLock();}
}
/** Editor-only repair. Never creates financial events nor modifies BOXY_CLIENT or BOXY_ADMIN. */
function reconcilerPaiementsPhoto_(){
  const book=controlWorkbook_();const items=photo6States_(photo6Read_(book,'HISTORIQUE_PAIEMENTS',PHOTO6_EVENTS_));
  const problems=[];let repaired=0;
  for(const t of items.values()){
    if(!t.transactionId.startsWith('TXN-'))continue;
    const warnings=photo6ReconcileOne_(book,t);if(warnings.length)problems.push({id:t.transactionId,warnings});else repaired++;
  }
  const closings=photo6ClosingStates_(photo6Read_(book,'HISTORIQUE_CLOTURES_CAISSE',PHOTO6_CLOSING_EVENTS_));
  for(const c of closings.values()){try{photo6ClosingProjection_(book,c);}catch(e){problems.push({id:c.id,warnings:['CLOTURE_A_RECONCILIER']});}}
  return {transactions:Array.from(items.values()).filter(t=>t.transactionId.startsWith('TXN-')).length,clotures:closings.size,reconcilies:repaired,problemes:problems};
}
