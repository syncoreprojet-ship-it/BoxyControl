/**
 * BOXY CONTROL ACADEMIE - LOT 5/6. PREPRODUCTION, ALL SWITCHES OFF.
 * One shared canonical cash ledger: HISTORIQUE_PAIEMENTS (also used by BOXY PHOTO).
 * Academy-specific sheets are REPAIRABLE PROJECTIONS, not new financial authorities.
 * This file depends on Code.gs, Academie_Lot2.gs, Academie_Lot3.gs and Paiements_Photo.gs.
 * No call creates an inscription or transfers money to a provider or ADMIN.
 */
const ACA5_VERSION_='5.0.0-rc1';
const ACA5_META_=['code_prestation','code_formation','code_session','reference_devis','echeance_id'];
const ACA5_QUOTE_HEADER_=['devis_id','inscription_id','code_public','code_formation','code_session','code_tarif','version_tarif','montant_initial_fcfa','remise_fcfa','montant_total_fcfa','code_modalite','reference_devis_client','empreinte_source','version_devis','date_validation_utc','statut_devis','evenement_source'];
const ACA5_INSTALLMENTS_HEADER_=['echeance_id','devis_id','inscription_id','code_session','code_modalite','ordre_echeance','pourcentage','montant_fcfa','declencheur','date_limite','montant_couvert_fcfa','montant_restant_fcfa','statut_echeance','version_devis','date_actualisation_utc'];
const ACA5_BALANCE_HEADER_=['inscription_id','code_public','code_formation','code_session','devis_id','total_du_fcfa','total_valide_fcfa','montant_en_attente_fcfa','remboursements_valides_fcfa','net_encaisse_fcfa','solde_restant_fcfa','statut_paiement','version_journal','maj_utc'];
const ACA5_RECEIPT_HEADER_=['numero_recu','transaction_id','inscription_id','code_public','code_formation','code_session','methode','type_mouvement','montant_fcfa','date_validation_utc','evenement_validation_id','reference_externe_masquee','statut','version'];
const ACA5_SYNC_META_=['code_prestation','inscription_id','code_formation'];

function acad5Context_(token,permission,write){
  const identity=verifyGoogleIdToken_(token),book=controlWorkbook_();
  const agent=findEnabledAgent_(book,identity),settings=readControlSettings_(book);
  const rights=loadRolePermissions_(book,agent.role);
  if(!rights.includes(permission))throw new Error('AUTORISATION_REFUSEE');
  if(!['TEST','PRODUCTION'].includes(settings.APP_MODE))throw new Error('FINANCES_ACADEMIE_FERMEES');
  const test=PropertiesService.getScriptProperties().getProperty('CONTROL_USE_TEST_SHEET')==='OUI';
  if((settings.APP_MODE==='TEST')!==test)throw new Error('ENVIRONNEMENT_INCOHERENT');
  if(settings.ACADEMIE_FINANCES_LECTURE_ACTIVE!=='OUI' && (write || !BXCT_CORE_AUTH_isAdmin_(agent.role)))throw new Error('FINANCES_ACADEMIE_FERMEES');
  if(write && !BXCT_ENC_ACADEMY_WRITE_ACTIVE_)throw new Error('ENCAISSEMENTS_ACADEMIE_RECETTE_LECTURE_SEULE');
  if(write && ['OPERATIONS_ACTIVES','PAIEMENTS_ACTIFS','ACADEMIE_OPERATIONS_ACTIVES','ACADEMIE_ENCAISSEMENTS_ACTIFS','ACADEMIE_DEVIS_OFFICIELS_VALIDES'].some(k=>settings[k]!=='OUI'))throw new Error('FINANCES_ACADEMIE_FERMEES');
  return {book,agent,settings,rights,write:write===true};
}
function acad5Table_(book,name,header,maxRows){
  const sheet=book.getSheetByName(name);photo6AssertHeader_(sheet,header);
  const n=sheet.getLastRow();if(n<1||n>(maxRows||1000))throw new Error('TABLE_TROP_VOLUMINEUSE');
  if(n===1)return [];
  const rows=sheet.getRange(2,1,n-1,header.length).getValues();
  return rows.filter(r=>String(r[0]||'').trim()).map(r=>Object.fromEntries(header.map((key,i)=>[key,r[i]])));
}
function acad5SheetHeader_(sheet,base,ext){
  photo6AssertHeader_(sheet,base.concat(ext||[]));return sheet;
}
function acad5Scope_(scopeFormation,scopeSession,formation,session){
  return (scopeFormation==='TOUTES'||scopeFormation===formation)&&(scopeSession==='TOUTES'||scopeSession===session);
}
function acad5ReadClientQuote_(ctx,code){
  const client=ouvrirSourceClientPhoto_(ctx.settings);const dossier=academyLot3DossierClient_(client,code);
  if(dossier.statutDemande==='ANNULEE')throw new Error('DOSSIER_NON_ELIGIBLE');
  const state=academyLot3Snapshot_(academyLot3ReadEvents_(ctx.book))[dossier.inscriptionId];
  if(!state||state.statut!=='CONFIRMEE'||state.formation!==dossier.formationCode)throw new Error('INSCRIPTION_NON_CONFIRMEE');
  const ss=academyLot3Sessions_(client),session=ss[state.session];
  if(!session||session.formation!==dossier.formationCode||session.validation!=='VALIDEE'||(!session.valid&&(ctx.write!==false||!['OUVERTE','COMPLETE','FERMEE','EN_COURS','TERMINEE','TERMINE','ARCHIVEE'].includes(session.statut))))throw new Error('SESSION_NON_VALIDEE');
  // Direct exact code lookup, no writing to CLIENT.
  const source=client.getSheetByName('INSCRIPTIONS');if(!source||source.getLastRow()>25001)throw new Error('SOURCE_INDISPONIBLE');
  const head=source.getRange(1,1,1,18).getDisplayValues()[0];
  const at=key=>{const idx=head.indexOf(key);if(idx<0)throw new Error('SCHEMA_CLIENT_INCOMPATIBLE');return idx;};
  const kCode=at('code_public'),kJson=at('details_json');
  const matches=source.getLastRow()>1?source.getRange(2,kCode+1,source.getLastRow()-1,1).createTextFinder(code).matchEntireCell(true).matchCase(true).findAll():[];
  if(matches.length!==1)throw new Error('DOSSIER_INDISPONIBLE');
  const raw=String(source.getRange(matches[0].getRow(),kJson+1).getValue()||'');
  if(raw.length>15000||raw.length<10)throw new Error('DEVIS_INDISPONIBLE');
  let data;try{data=JSON.parse(raw);}catch(_){throw new Error('DEVIS_INDISPONIBLE');}
  const snapshot=data&&data.tarif_snapshot;
  if(!snapshot||typeof snapshot!=='object')throw new Error('DEVIS_INDISPONIBLE');
  if(snapshot.code_formation!==dossier.formationCode||snapshot.code_session!==dossier.codeSession || state.session!==dossier.codeSession)throw new Error('DEVIS_SESSION_A_REVALIDER');
  if(snapshot.devise!=='XOF'||!/^DEV4-[A-F0-9]{24}$/.test(String(snapshot.reference_devis||'')))throw new Error('DEVIS_INVALIDE');
  const net=photo6Int_(snapshot.montant_estime_fcfa,1,999999999,'DEVIS_INVALIDE');
  const total=photo6Int_(snapshot.montant_initial_fcfa,1,999999999,'DEVIS_INVALIDE');
  const discount=photo6Int_(snapshot.montant_remise_fcfa,0,total,'DEVIS_INVALIDE');
  if(total-discount!==net)throw new Error('DEVIS_INVALIDE');
  const ref=String(snapshot.reference_devis),existing=acad5Table_(ctx.book,'DEVIS_ACADEMIE_CONTROL',ACA5_QUOTE_HEADER_,500)
    .filter(r=>r.inscription_id===dossier.inscriptionId);
  if(existing.length>1||existing.some(r=>String(r.reference_devis_client)!==ref||Number(r.montant_total_fcfa)!==net||r.code_session!==state.session))throw new Error('DEVIS_FIGE_DIFFERENT');
  if(!session.valid&&!existing.length)throw new Error('SESSION_NON_VALIDEE');
  if(existing.length && existing[0].statut_devis!=='VALIDE')throw new Error('DEVIS_A_REVALIDER');
  // A fixed CONTROL quote takes precedence over newer CLIENT tariffs and schedules.
  if(existing.length){
    const saved=existing[0], snap=Array.isArray(snapshot.echeances)?snapshot.echeances:[];
    if(String(saved.code_tarif)!==String(snapshot.code_tarif)||
       Number(saved.version_tarif)!==Number(snapshot.version_tarif)||
       Number(saved.montant_initial_fcfa)!==total||Number(saved.remise_fcfa)!==discount||
       String(saved.code_modalite)!==String(snapshot.modalite)||
       String(saved.code_formation)!==String(dossier.formationCode)||
       String(saved.devis_id)!=='DVA-'+ref || !snap.length || snap.length>6)
      throw new Error('DEVIS_FIGE_DIFFERENT');
    const historic=acad5Table_(ctx.book,'ECHEANCIER_ACADEMIE_CONTROL',ACA5_INSTALLMENTS_HEADER_,2500)
      .filter(r=>String(r.devis_id)===String(saved.devis_id)&&String(r.inscription_id)===String(dossier.inscriptionId));
    if(historic.length!==snap.length)throw new Error('DEVIS_ECHEANCES_HISTORIQUES_ABSENTES');
    const parts=snap.map((p,i)=>{
      const old=historic.find(r=>Number(r.ordre_echeance)===Number(p.numero));
      if(!old||Number(p.numero)!==i+1||Number(old.montant_fcfa)!==Number(p.montant_fcfa)||
         Number(old.pourcentage)!==Number(p.pourcentage)||String(old.declencheur)!==String(p.moment))
        throw new Error('DEVIS_ECHEANCES_MODIFIE');
      return {numero:Number(p.numero),pourcentage:Number(p.pourcentage),
        montant_fcfa:Number(p.montant_fcfa),moment:String(p.moment),
        decalage_jours:photo6Int_(p.decalage_jours,0,365,'DEVIS_ECHEANCES_MODIFIE')};
    });
    if(parts.reduce((n,p)=>n+p.montant_fcfa,0)!==net)throw new Error('DEVIS_ECHEANCES_MODIFIE');
    return {client,dossier,session:state.session,versionDecision:state.version,quote:{
      inscriptionId:dossier.inscriptionId,code:dossier.code,formation:dossier.formationCode,session:state.session,
      devisId:String(saved.devis_id),ref,codeTarif:String(saved.code_tarif),
      versionTarif:Number(saved.version_tarif),initial:total,remise:discount,total:net,
      modalite:String(saved.code_modalite),parts,hash:String(saved.empreinte_source)}};
  }
  if(!existing.length){
    const tariffs=acad5Table_(client,'TARIFS_ACADEMIE',['code_tarif','code_formation','code_session','prix_fcfa','devise','version_tarif','validation','actif','ordre','note_interne'],600);
    const matching=tariffs.filter(t=>t.code_tarif===snapshot.code_tarif&&t.code_formation===dossier.formationCode&&acad5Scope_(t.code_formation,t.code_session,dossier.formationCode,state.session)&&t.validation==='VALIDE'&&t.actif==='OUI');
    if(matching.length!==1 || Number(matching[0].prix_fcfa)!==total||String(matching[0].devise)!=='XOF'||Number(matching[0].version_tarif)!==Number(snapshot.version_tarif))throw new Error('TARIF_NON_VALIDE');
    const rules=acad5Table_(client,'MODALITES_ACADEMIE',['code_modalite','libelle','type_modalite','code_formation','code_session','ordre','validation','actif','note_interne'],600);
    if(rules.filter(r=>r.code_modalite===snapshot.modalite&&acad5Scope_(r.code_formation,r.code_session,dossier.formationCode,state.session)&&r.validation==='VALIDE'&&r.actif==='OUI').length!==1)throw new Error('MODALITE_NON_VALIDEE');
    if(snapshot.remise){
      const promos=acad5Table_(client,'REMISES_ACADEMIE',['code_remise','code_formation','code_session','libelle','type_remise','valeur','plafond_fcfa','date_debut','date_fin','validation','actif','note_interne'],500);
      const active=promos.filter(p=>p.code_remise===snapshot.remise&&acad5Scope_(p.code_formation,p.code_session,dossier.formationCode,state.session)&&p.validation==='VALIDE'&&p.actif==='OUI');
      if(active.length!==1)throw new Error('REMISE_NON_VALIDEE');
      const p=active[0],now=Utilities.formatDate(new Date(),'Africa/Bamako','yyyy-MM-dd');
      if((p.date_debut&&now<String(p.date_debut))||(p.date_fin&&now>String(p.date_fin)))throw new Error('REMISE_EXPIREE');
      const val=photo6Int_(p.valeur,1,999999999),limit=photo6Int_(p.plafond_fcfa||0,0,999999999);
      const expected=p.type_remise==='POURCENT'?Math.round(total*val/100):p.type_remise==='FIXE'?val:NaN;
      if(!Number.isSafeInteger(expected)||val>(p.type_remise==='POURCENT'?100:999999999)||Math.min(total,limit?Math.min(limit,expected):expected)!==discount)throw new Error('REMISE_INVALIDE');
    }else if(discount!==0)throw new Error('DEVIS_INVALIDE');
  }
  const schedule=acad5Table_(client,'ECHEANCES_ACADEMIE',['code_modalite','ordre_echeance','pourcentage','declencheur','decalage_jours','libelle_public','validation','actif'],600)
    .filter(r=>r.code_modalite===snapshot.modalite && r.validation==='VALIDE' && r.actif==='OUI')
    .sort((a,b)=>Number(a.ordre_echeance)-Number(b.ordre_echeance));
  if(!schedule.length||schedule.length>6||schedule.reduce((n,r)=>n+Number(r.pourcentage),0)!==100)throw new Error('ECHEANCIER_NON_VALIDE');
  const parts=[];let allocated=0;
  for(let i=0;i<schedule.length;i++){
    const t=schedule[i],n=photo6Int_(t.ordre_echeance,1,6),percent=photo6Int_(t.pourcentage,1,100),delay=photo6Int_(t.decalage_jours,0,365);
    if(n!==i+1||!['AVANT_CONFIRMATION','AVANT_DEBUT','APRES_DEBUT'].includes(t.declencheur))throw new Error('ECHEANCIER_NON_VALIDE');
    const amount=i===schedule.length-1?net-allocated:Math.round(net*percent/100);allocated+=amount;
    parts.push({numero:n,pourcentage:percent,montant_fcfa:amount,moment:t.declencheur,decalage_jours:delay});
  }
  const snapParts=Array.isArray(snapshot.echeances)?snapshot.echeances:[];
  if(parts.length!==snapParts.length||parts.some((p,i)=>p.numero!==Number(snapParts[i].numero)||p.montant_fcfa!==Number(snapParts[i].montant_fcfa)||p.moment!==snapParts[i].moment))throw new Error('DEVIS_ECHEANCES_MODIFIE');
  return {client,dossier,session:state.session,versionDecision:state.version,quote:{
    inscriptionId:dossier.inscriptionId,code:dossier.code,formation:dossier.formationCode,session:state.session,
    devisId:'DVA-'+ref,ref,codeTarif:String(snapshot.code_tarif),versionTarif:Number(snapshot.version_tarif),
    initial:total,remise:discount,total:net,modalite:String(snapshot.modalite),parts,
    hash:photo6Hash_({ref,code,session:state.session,initial:total,discount,net,parts})}};
}
function acad5Ledger_(book){return BXCT_ENC_ACADEMY_ledger_(book);}
function acad5Balance_(ledger,quote){return BXCT_ENC_ACADEMY_balance_(ledger,quote);}
function acad5Upsert_(sheet,head,matchCol,key,row){
  photo6AssertHeader_(sheet,head);
  const last=sheet.getLastRow(),range=last>1?sheet.getRange(2,matchCol+1,last-1,1).getDisplayValues():[];
  const found=[];for(let i=0;i<range.length;i++)if(range[i][0]===key)found.push(i+2);
  if(found.length>1)throw new Error('PROJECTION_AMBIGUE');
  const vals=head.map(k=>row[k]===undefined?'':row[k]);
  if(found.length)sheet.getRange(found[0],1,1,head.length).setValues([vals]);else sheet.appendRow(vals);
}
function acad5StoreQuote_(book,quote,sourceEvent){
  // Immutable once validated: never refresh the price or original validation date.
  const old=acad5Table_(book,'DEVIS_ACADEMIE_CONTROL',ACA5_QUOTE_HEADER_,500)
    .filter(r=>r.inscription_id===quote.inscriptionId);
  if(old.length>1)throw new Error('DEVIS_AMBIGU');
  if(old.length){
    if(String(old[0].reference_devis_client)!==quote.ref||
       Number(old[0].montant_total_fcfa)!==quote.total||
       Number(old[0].version_tarif)!==quote.versionTarif||
       String(old[0].empreinte_source)!==quote.hash)
      throw new Error('DEVIS_FIGE_DIFFERENT');
    return;
  }
  acad5Upsert_(book.getSheetByName('DEVIS_ACADEMIE_CONTROL'),ACA5_QUOTE_HEADER_,1,quote.inscriptionId,{
    devis_id:quote.devisId,inscription_id:quote.inscriptionId,code_public:quote.code,code_formation:quote.formation,
    code_session:quote.session,code_tarif:quote.codeTarif,version_tarif:quote.versionTarif,
    montant_initial_fcfa:quote.initial,remise_fcfa:quote.remise,montant_total_fcfa:quote.total,
    code_modalite:quote.modalite,reference_devis_client:quote.ref,empreinte_source:quote.hash,
    version_devis:1,date_validation_utc:new Date().toISOString(),statut_devis:'VALIDE',evenement_source:sourceEvent});
}
function acad5Installments_(book,quote,balance){
  const sh=book.getSheetByName('ECHEANCIER_ACADEMIE_CONTROL');photo6AssertHeader_(sh,ACA5_INSTALLMENTS_HEADER_);
  let allocated=Math.max(0,balance.netEncaisseFcfa);
  for(const p of quote.parts){
    const covered=Math.min(p.montant_fcfa,allocated);allocated-=covered;
    const id=quote.devisId+'-'+p.numero;
    const due=p.moment==='AVANT_CONFIRMATION'?'':p.moment==='AVANT_DEBUT'?'':null;
    const status=covered>=p.montant_fcfa?'COUVERTE':due===''?'DATE_A_VALIDER':'A_VENIR';
    acad5Upsert_(sh,ACA5_INSTALLMENTS_HEADER_,0,id,{
      echeance_id:id,devis_id:quote.devisId,inscription_id:quote.inscriptionId,code_session:quote.session,
      code_modalite:quote.modalite,ordre_echeance:p.numero,pourcentage:p.pourcentage,
      montant_fcfa:p.montant_fcfa,declencheur:p.moment,date_limite:due||'',montant_couvert_fcfa:covered,
      montant_restant_fcfa:p.montant_fcfa-covered,statut_echeance:status,version_devis:1,date_actualisation_utc:new Date().toISOString()});
  }
}
function acad5Projection_(book,t,meta){
  const sh=book.getSheetByName('PAIEMENTS');acad5SheetHeader_(sh,PHOTO6_PROJECTION_,ACA5_META_);
  const base={transaction_id:t.transactionId,inscription_id:t.inscriptionId,code_public:t.code,type_mouvement:t.type,
    methode:t.methode,montant_fcfa:t.montant,statut_validation:t.statut,reference_externe:t.reference,
    agent_id:t.create.agent_auteur_id,verifie_par:t.decide?t.decide.agent_verificateur_id:'',
    encaisse_le_utc:t.create.cree_utc,verifie_le_utc:t.decide?t.decide.cree_utc:'',
    cle_idempotence:t.create.cle_idempotence,transaction_origine_id:t.origine,
    note:t.create.commentaire_interne,version:t.version,dernier_evenement_id:t.dernier.evenement_id,
    fournisseur_mm:t.fournisseur,preuve_verification_privee:t.decide?t.decide.preuve_verification_privee:'',
    numero_recu:t.decide&&t.statut==='VALIDE'?t.decide.numero_recu:'',
    jour_caisse:t.decide?t.decide.jour_caisse:'',devis_client_fcfa:t.create.devis_client_fcfa,
    commentaire_interne:t.decide?t.decide.commentaire_interne:'',code_prestation:'FORMATION',
    code_formation:meta.formation,code_session:meta.session,reference_devis:meta.ref,echeance_id:meta.echeance};
  acad5Upsert_(sh,PHOTO6_PROJECTION_.concat(ACA5_META_),0,t.transactionId,base);
}
function acad5ReceiptProjection_(book,t,meta){
  if(t.statut!=='VALIDE')return;
  const e=t.decide,receipt={numero_recu:e.numero_recu,transaction_id:t.transactionId,
    inscription_id:t.inscriptionId,code_public:t.code,code_formation:meta.formation,code_session:meta.session,
    methode:t.methode,type_mouvement:t.type,montant_fcfa:t.montant,date_validation_utc:e.cree_utc,
    evenement_validation_id:e.evenement_id,reference_externe_masquee:t.reference?'****'+t.reference.slice(-4):'',
    statut:t.type==='REMBOURSEMENT'?'REMBOURSEMENT_VALIDE':'VALIDE',version:t.version};
  acad5Upsert_(book.getSheetByName('RECUS_ACADEMIE'),ACA5_RECEIPT_HEADER_,0,e.numero_recu,receipt);
}
function acad5AdminOutbox_(book,t,meta){
  if(t.statut!=='VALIDE')return;
  const head=['evenement_id','transaction_id','type_projection','statut','version','cle_idempotence','cree_utc','envoye_utc','accuse_utc','nb_essais','erreur_securisee'].concat(ACA5_SYNC_META_);
  const sh=book.getSheetByName('SYNC_ADMIN');photo6AssertHeader_(sh,head);
  const eventId=t.decide.evenement_id;
  const ids=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues().map(x=>x[0]):[];
  if(ids.includes(eventId))return;
  sh.appendRow([eventId,t.transactionId,t.type==='REMBOURSEMENT'?'REMBOURSEMENT_VALIDE':'TRANSACTION_VALIDEE',
    'A_ENVOYER',t.version,eventId,t.decide.cree_utc,'','',0,'','FORMATION',t.inscriptionId,meta.formation]);
}
function acad5ReconcileOne_(book,t,meta){
  if(!meta)throw new Error('METADONNEES_ACADEMIE_ABSENTES');
  const warnings=[];
  for(const [f,code] of [[()=>acad5Projection_(book,t,meta),'PROJECTION_A_RECONCILIER'],
    [()=>acad5ReceiptProjection_(book,t,meta),'RECU_A_RECONCILIER'],
    [()=>acad5AdminOutbox_(book,t,meta),'ADMIN_A_RECONCILIER']]){
    try{f();}catch(_){warnings.push(code);}
  }
  return warnings;
}
function acad5RefreshBalance_(book,quote,ledger,sourceEvent){
  const bal=acad5Balance_(ledger,quote);
  acad5StoreQuote_(book,quote,sourceEvent);
  acad5Installments_(book,quote,bal);
  acad5Upsert_(book.getSheetByName('SOLDE_ACADEMIE'),ACA5_BALANCE_HEADER_,0,quote.inscriptionId,{
    inscription_id:quote.inscriptionId,code_public:quote.code,code_formation:quote.formation,
    code_session:quote.session,devis_id:quote.devisId,total_du_fcfa:quote.total,
    total_valide_fcfa:bal.totalValideFcfa,montant_en_attente_fcfa:bal.totalEnAttenteFcfa,
    remboursements_valides_fcfa:bal.remboursementsFcfa,net_encaisse_fcfa:bal.netEncaisseFcfa,
    solde_restant_fcfa:bal.soldeFcfa,statut_paiement:bal.statut,
    version_journal:ledger.events.length,maj_utc:new Date().toISOString()});
  return bal;
}
function acad5Append_(book,e){
  BXCT_ENC_SERVICE_append_(book,e,true);
}
function acad5Public_(t){return photo6Public_(t);}
function acad5State_(ctx,code){
  const source=acad5ReadClientQuote_(ctx,code),ledger=acad5Ledger_(ctx.book);
  const summary=acad5Balance_(ledger,source.quote);
  return {source,ledger,summary};
}
/** READ: agent-specific, no data returned when OAuth / permissions / tariffs are unapproved. */
function controlAcademieFinancesLot5(token,codeSaisi){
  const ctx=acad5Context_(token,'CONSULTER_FINANCES_ACADEMIE',false);
  const code=normaliserCodePhoto_(codeSaisi);if(!code)throw new Error('CODE_INVALIDE');
  const {source,summary}=acad5State_(ctx,code);
  academyLookupAudit_(ctx.book,ctx.agent.agentId,source.dossier.inscriptionId,'CONSULTATION_FINANCES',code);
  return {ok:true,code,formation:source.dossier.formationTitre,session:source.session,
    devis:{reference:source.quote.ref,totalFcfa:source.quote.total,modalite:source.quote.modalite,
      echeances:source.quote.parts.map(p=>({...p}))},summary,
    ecritureActive:BXCT_ENC_ACADEMY_WRITE_ACTIVE_,registre:'HISTORIQUE_PAIEMENTS',
    permissions:{enregistrer:BXCT_ENC_ACADEMY_WRITE_ACTIVE_&&ctx.rights.includes('ENREGISTRER_PAIEMENT_ACADEMIE'),
      verifier:BXCT_ENC_ACADEMY_WRITE_ACTIVE_&&ctx.rights.includes('VALIDER_PAIEMENT_ACADEMIE'),
      rembourser:BXCT_ENC_ACADEMY_WRITE_ACTIVE_&&ctx.rights.includes('ENREGISTRER_REMBOURSEMENT_ACADEMIE')},
    avertissement:'Devis validé, aucun paiement n’est confirmé avant contrôle.',version:ACA5_VERSION_};
}
/** CREATE EN_ATTENTE transaction in the SAME ledger as PHOTO. */
function controlAcademieEnregistrerPaiementLot5(token,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('DEMANDE_INVALIDE');
  const r={code:normaliserCodePhoto_(input.code),type:String(input.typeMouvement||'ENCAISSEMENT'),
    methode:String(input.methode||''),montant:photo6Int_(input.montantFcfa,1,999999999),
    fournisseur:photo6Safe_(input.fournisseur||'',35),reference:photo6Safe_(input.referenceExterne||'',80),
    origine:photo6Safe_(input.transactionOrigineId||'',110),note:photo6Safe_(input.commentaire||'',200),
    cle:photo6Idem_(input.cleIdempotence)};
  if(!r.code||!['ENCAISSEMENT','REMBOURSEMENT'].includes(r.type)||!['ESPECES','MOBILE_MONEY'].includes(r.methode))throw new Error('DEMANDE_INVALIDE');
  if(r.methode==='ESPECES'&&(r.fournisseur||r.reference))throw new Error('REFERENCE_INUTILE');
  if(r.methode==='MOBILE_MONEY'&&(!['ORANGE_MONEY','MOOV_MONEY','AUTRE'].includes(r.fournisseur)||!/^[A-Za-z0-9_-]{6,80}$/.test(r.reference)))throw new Error('REFERENCE_MM_OBLIGATOIRE');
  if(r.type==='ENCAISSEMENT'&&r.origine)throw new Error('ORIGINE_INVALIDE');
  if(r.type==='REMBOURSEMENT'&&!/^ACA-TXN-[A-Za-z0-9-]{8,100}$/.test(r.origine))throw new Error('ORIGINE_INVALIDE');
  const permission=r.type==='REMBOURSEMENT'?'ENREGISTRER_REMBOURSEMENT_ACADEMIE':'ENREGISTRER_PAIEMENT_ACADEMIE';
  const ctx=acad5Context_(token,permission,true);
  if(r.type==='REMBOURSEMENT'&&ctx.settings.ACADEMIE_REMBOURSEMENTS_ACTIFS!=='OUI')throw new Error('REMBOURSEMENTS_FERMES');
  const fp=photo6Hash_(r),lock=photo6Lock_();
  try{
    const {source,ledger,summary}=acad5State_(ctx,r.code),q=source.quote;
    const replay=photo6FindReplay_(ledger.events,r.cle,fp);
    if(replay){const t=ledger.states.get(replay.transaction_id),meta=ledger.byId.get(t.transactionId);
      if(!meta||t.inscriptionId!==q.inscriptionId)throw new Error('CLE_DEJA_UTILISEE');
      return {ok:true,rejoue:true,transaction:acad5Public_(t),summary,
        avertissements:acad5ReconcileOne_(ctx.book,t,meta)};}
    if(r.methode==='MOBILE_MONEY')for(const t of ledger.states.values()){
      if(t.methode==='MOBILE_MONEY'&&t.fournisseur===r.fournisseur&&t.reference.toUpperCase()===r.reference.toUpperCase())throw new Error('REFERENCE_MM_DEJA_UTILISEE');
    }
    if(r.type==='ENCAISSEMENT'){
      if(r.montant>q.total-summary.netEncaisseFcfa-summary.totalEnAttenteFcfa)throw new Error('MONTANT_DEPASSE_DEVIS');
    }else{
      const origin=ledger.states.get(r.origine);
      if(!origin||!ledger.byId.has(r.origine)||origin.inscriptionId!==q.inscriptionId||origin.type!=='ENCAISSEMENT'||origin.statut!=='VALIDE'||origin.methode!==r.methode)throw new Error('ORIGINE_NON_VALIDE');
      let used=0;for(const t of ledger.states.values())if(t.type==='REMBOURSEMENT'&&t.origine===r.origine&&t.statut!=='REJETE')used+=t.montant;
      if(r.montant>origin.montant-used)throw new Error('REMBOURSEMENT_DEPASSE_ORIGINE');
    }
    const now=new Date().toISOString(),eid='ACA-FNE-'+Utilities.getUuid(),txid='ACA-TXN-'+Utilities.getUuid();
    const row={evenement_id:eid,transaction_id:txid,inscription_id:q.inscriptionId,code_public:r.code,
      action:'ENREGISTRER',type_mouvement:r.type,methode:r.methode,fournisseur:r.fournisseur,
      montant_fcfa:r.montant,statut_avant:'',statut_apres:'EN_ATTENTE',reference_externe:r.reference,
      transaction_origine_id:r.origine,agent_auteur_id:ctx.agent.agentId,agent_verificateur_id:'',
      preuve_verification_privee:'',cle_idempotence:r.cle,empreinte_requete:fp,version:1,
      cree_utc:now,jour_caisse:'',devis_client_fcfa:q.total,commentaire_interne:r.note,numero_recu:'',
      code_prestation:'FORMATION',code_formation:q.formation,code_session:q.session,
      reference_devis:q.ref,echeance_id:''};
    // AUDIT BEFORE canonical append: if unavailable, no new financial entry.
    photo6Audit_(ctx.book,ctx.agent.agentId,'ACAD_PAIEMENT_EN_ATTENTE',q.inscriptionId,txid,fp);
    acad5Append_(ctx.book,row);
    const next=acad5Ledger_(ctx.book),t=next.states.get(txid),meta=next.byId.get(txid),warnings=acad5ReconcileOne_(ctx.book,t,meta);
    try{acad5RefreshBalance_(ctx.book,q,next,eid);}catch(_){warnings.push('SOLDE_A_RECONCILIER');}
    return {ok:true,rejoue:false,transaction:acad5Public_(t),summary:acad5Balance_(next,q),avertissements:warnings};
  }finally{lock.releaseLock();}
}
/** REVIEW by a DIFFERENT habilitated agent; Mobile Money is verified externally, not via API. */
function controlAcademieDeciderPaiementLot5(token,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('DEMANDE_INVALIDE');
  const r={transactionId:String(input.transactionId||''),action:String(input.action||''),
    version:photo6Int_(input.versionAttendue,1,100000),preuve:photo6Private_(input.preuveVerificationPrivee||''),
    externe:input.verificationExterneConfirmee===true,especes:input.especesPhysiquementConfirmees===true,
    note:photo6Safe_(input.commentaire||'',200),cle:photo6Idem_(input.cleIdempotence)};
  if(!/^ACA-TXN-[A-Za-z0-9-]{8,100}$/.test(r.transactionId)||!['VALIDER','REJETER'].includes(r.action))throw new Error('DEMANDE_INVALIDE');
  const ctx=acad5Context_(token,'VALIDER_PAIEMENT_ACADEMIE',true),fp=photo6Hash_(r),lock=photo6Lock_();
  try{
    const ledger=acad5Ledger_(ctx.book),replay=photo6FindReplay_(ledger.events,r.cle,fp);
    if(replay){const st=ledger.states.get(replay.transaction_id),meta=ledger.byId.get(st.transactionId);
      if(!meta)throw new Error('TRANSACTION_AUTRE_SERVICE');return {ok:true,rejoue:true,transaction:acad5Public_(st),avertissements:acad5ReconcileOne_(ctx.book,st,meta)};}
    const t=ledger.states.get(r.transactionId),meta=ledger.byId.get(r.transactionId);
    if(!t||!meta)throw new Error('TRANSACTION_INTROUVABLE');
    if(t.statut!=='EN_ATTENTE'||t.version!==r.version)throw new Error('TRANSACTION_MODIFIEE');
    if(t.type==='REMBOURSEMENT'&&!ctx.rights.includes('VALIDER_REMBOURSEMENT_ACADEMIE'))throw new Error('AUTORISATION_REFUSEE');
    if(t.type==='REMBOURSEMENT'&&ctx.settings.ACADEMIE_REMBOURSEMENTS_ACTIFS!=='OUI')throw new Error('REMBOURSEMENTS_FERMES');
    if(t.methode==='MOBILE_MONEY'&&ctx.settings.ACADEMIE_VALIDATION_MM_ACTIVE!=='OUI')throw new Error('VALIDATION_MM_FERMEE');
    if(t.methode==='ESPECES'&&ctx.settings.ACADEMIE_VALIDATION_ESPECES_ACTIVE!=='OUI')throw new Error('VALIDATION_ESPECES_FERMEE');
    if(r.action==='VALIDER'){
      if(t.create.agent_auteur_id===ctx.agent.agentId)throw new Error('CONTROLE_DISTINCT_OBLIGATOIRE');
      if(t.methode==='ESPECES'&&!r.especes)throw new Error('ESPECES_NON_VERIFIEES');
      if(t.methode==='MOBILE_MONEY'&&(!r.externe||!r.preuve))throw new Error('VERIFICATION_EXTERNE_REQUISE');
    }else if(r.note.length<6)throw new Error('MOTIF_REJET_OBLIGATOIRE');
    const source=acad5ReadClientQuote_(ctx,t.code);
    if(source.quote.inscriptionId!==t.inscriptionId||source.quote.ref!==meta.ref)throw new Error('DEVIS_MODIFIE');
    const now=new Date().toISOString(),day=Utilities.formatDate(new Date(),'Africa/Bamako','yyyy-MM-dd');
    const e={...t.create,evenement_id:'ACA-FNE-'+Utilities.getUuid(),action:r.action,statut_avant:t.statut,
      statut_apres:r.action==='VALIDER'?'VALIDE':'REJETE',agent_verificateur_id:ctx.agent.agentId,
      preuve_verification_privee:r.action==='VALIDER'?r.preuve:'',cle_idempotence:r.cle,empreinte_requete:fp,
      version:t.version+1,cree_utc:now,jour_caisse:r.action==='VALIDER'?day:'',
      commentaire_interne:r.note,numero_recu:r.action==='VALIDER'?'REC-ACA-'+day.replace(/-/g,'')+'-'+Utilities.getUuid().slice(0,10).toUpperCase():''};
    photo6Audit_(ctx.book,ctx.agent.agentId,'ACAD_PAIEMENT_'+r.action,t.inscriptionId,t.transactionId,fp);
    acad5Append_(ctx.book,e);
    const next=acad5Ledger_(ctx.book),st=next.states.get(t.transactionId),warnings=acad5ReconcileOne_(ctx.book,st,meta);
    try{acad5RefreshBalance_(ctx.book,source.quote,next,e.evenement_id);}catch(_){warnings.push('SOLDE_A_RECONCILIER');}
    return {ok:true,rejoue:false,transaction:acad5Public_(st),summary:acad5Balance_(next,source.quote),avertissements:warnings};
  }finally{lock.releaseLock();}
}
function controlAcademieRecuLot5(token,transactionId){
  const ctx=acad5Context_(token,'CONSULTER_RECU_ACADEMIE',false);
  if(ctx.settings.ACADEMIE_RECUS_ACTIFS!=='OUI')throw new Error('RECUS_FERMES');
  const ledger=acad5Ledger_(ctx.book),t=ledger.states.get(String(transactionId||''));
  if(!t||!ledger.byId.has(t.transactionId)||t.statut!=='VALIDE')throw new Error('RECU_INDISPONIBLE');
  academyLookupAudit_(ctx.book,ctx.agent.agentId,t.inscriptionId,'CONSULTATION_RECU_ACADEMIE',t.code);
  return {ok:true,numero:t.decide.numero_recu,dateUtc:t.decide.cree_utc,code:t.code,
    methode:t.methode,type:t.type,montantFcfa:t.montant,referenceMasquee:t.reference?'****'+t.reference.slice(-4):'',
    mention:'Justificatif interne BOXY ACADÉMIE, non fiscal et soumis à la vérification manuelle'};
}
/** Editor-only repair. Never creates an event, changes CLIENT, or posts to ADMIN. */
function reparerFinancesAcademieLot5_(){
  const book=controlWorkbook_(),ledger=acad5Ledger_(book),errors=[];let repaired=0;
  for(const t of ledger.states.values())if(ledger.byId.has(t.transactionId)){
    const warnings=acad5ReconcileOne_(book,t,ledger.byId.get(t.transactionId));
    if(warnings.length)errors.push({id:t.transactionId,warnings});else repaired++;
  }
  return {transactionsAcademie:ledger.byId.size,projectionsReparees:repaired,problemes:errors};
}
