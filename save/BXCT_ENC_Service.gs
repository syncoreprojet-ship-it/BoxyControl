/** Service unique d'ajout. Les appelants historiques conservent auth, validation,
 * verrou et idempotence. Aucun endpoint de mutation nouveau. */
function BXCT_ENC_SERVICE_append_(book,e,extended) {
  const domain=BXCT_ENC_SERVICE_domain_(e);
  if(!domain||(extended===true)!==(domain==='FORMATION'))throw new Error('PRESTATION_INCOHERENTE');
  if(domain==='FORMATION'&&!BXCT_ENC_ACADEMY_WRITE_ACTIVE_)throw new Error('ENCAISSEMENTS_ACADEMIE_RECETTE_LECTURE_SEULE');
  BXCT_ENC_DATA_append_(book,e,extended);
}
/** Projection en memoire uniquement; devis historiques des dossiers avec transactions. */
function BXCT_ENC_SERVICE_summary_(events,filter,quotes) {
  const states=photo6States_(events),totals={},dossiers=new Map(),history=[];
  const fresh=()=>({encaisseFcfa:0,rembourseFcfa:0,netFcfa:0,especesNetFcfa:0,mobileNetFcfa:0,attenteFcfa:0,versementsAttenteFcfa:0,remboursementsAttenteFcfa:0,soldeFcfa:0,dossiers:0});
  const all=fresh();
  for(const t of states.values()){
    const e=t.create;
    const domain=BXCT_ENC_SERVICE_domain_(e);
    if(!domain||!['ESPECES','MOBILE_MONEY'].includes(t.methode))throw new Error('JOURNAL_PAIEMENT_INCOHERENT');
    if(filter.prestation!=='TOUTES'&&filter.prestation!==domain)continue;
    const total=totals[domain]||(totals[domain]=fresh());
    const key=domain+'|'+t.inscriptionId,quote=photo6Int_(e.devis_client_fcfa,1,999999999,'DEVIS_INVALIDE');
    if(!dossiers.has(key))dossiers.set(key,{domain,quote,net:0,code:t.code,ref:e.reference_devis,formation:e.code_formation,session:e.code_session});
    const d=dossiers.get(key);if(d.quote!==quote||d.code!==t.code||(domain==='FORMATION'&&(d.ref!==e.reference_devis||d.formation!==e.code_formation||d.session!==e.code_session)))throw new Error('DEVIS_HISTORIQUE_INCOHERENT');
    const signed=BXCT_ENC_SERVICE_amount_(t).signed;
    if(t.statut==='VALIDE'){
      d.net+=signed;
      for(const x of [all,total]){x.netFcfa+=signed;x[t.type==='REMBOURSEMENT'?'rembourseFcfa':'encaisseFcfa']+=t.montant;x[t.methode==='ESPECES'?'especesNetFcfa':'mobileNetFcfa']+=signed;}
    }else if(t.statut==='EN_ATTENTE'){for(const x of [all,total]){x.attenteFcfa+=signed;x[t.type==='REMBOURSEMENT'?'remboursementsAttenteFcfa':'versementsAttenteFcfa']+=t.montant;}}
    history.push({id:t.transactionId,prestation:domain,code:t.code,type:t.type,methode:t.methode,montantFcfa:t.montant,statut:t.statut,date:t.dernier.cree_utc});
  }
  const seenQuotes=new Set();
  if(filter.prestation!=='PHOTO')for(const q of (quotes||[])){
    if(seenQuotes.has(q.inscriptionId))throw new Error('DEVIS_AMBIGU');seenQuotes.add(q.inscriptionId);
    const key='FORMATION|'+q.inscriptionId,d=dossiers.get(key);
    if(d&&(d.quote!==q.total||d.code!==q.code||d.ref!==q.ref||d.formation!==q.formation||d.session!==q.session))throw new Error('DEVIS_HISTORIQUE_INCOHERENT');
    if(!d){dossiers.set(key,{domain:'FORMATION',quote:q.total,net:0,code:q.code});if(!totals.FORMATION)totals.FORMATION=fresh();}
  }
  for(const d of dossiers.values()){const s=Math.max(0,d.quote-d.net);all.soldeFcfa+=s;all.dossiers++;totals[d.domain].soldeFcfa+=s;totals[d.domain].dossiers++;}
  if(filter.desk===true&&filter.prestation==='FORMATION'){
    const match=x=>!filter.code||x.code===filter.code;
    const rows=filter.view==='SOLDES'?Array.from(dossiers.values()).filter(match).map(d=>({code:d.code,devisFcfa:d.quote,netFcfa:d.net,soldeFcfa:Math.max(0,d.quote-d.net)})).sort((a,b)=>a.code.localeCompare(b.code)):
      history.filter(t=>match(t)&&(filter.view!=='ATTENTE'||t.statut==='EN_ATTENTE')&&(filter.view!=='RECUS'||t.statut==='VALIDE')).sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.id.localeCompare(b.id));
    return {totaux:all,vue:filter.view,lignes:rows.slice(filter.page*50,filter.page*50+50),nombre:rows.length,page:filter.page,ecritureActive:false};
  }
  history.sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.id.localeCompare(b.id));
  return {totaux:all,prestations:totals,historique:history.slice(filter.page*50,filter.page*50+50),nombre:history.length,page:filter.page,ecritureActive:false};
}
function BXCT_ENC_SERVICE_read_(ctx,filter){return BXCT_ENC_SERVICE_summary_(BXCT_ENC_DATA_read_(ctx.book),filter,filter.prestation==='PHOTO'?[]:BXCT_ENC_DATA_quotes_(ctx.book));}

/** Canonical transaction projection; no mutation. */
function BXCT_ENC_SERVICE_amount_(t){
  const refund=t.type==='REMBOURSEMENT';
  const signed=refund?-t.montant:t.montant;
  return {signed,paid:t.statut==='VALIDE'&&!refund?t.montant:0,
    refund:t.statut==='VALIDE'&&refund?t.montant:0,
    pending:t.statut==='EN_ATTENTE'&&!refund?t.montant:0,pendingRefund:t.statut==='EN_ATTENTE'&&refund?t.montant:0};
}
function BXCT_ENC_SERVICE_ledger_(book){
  const events=BXCT_ENC_DATA_read_(book);
  return {events,states:photo6States_(events)};
}

/** Domain classification shared by reconciliation and audit. */
function BXCT_ENC_SERVICE_domain_(e){
  const id=String(e.transaction_id||''),raw=e.code_prestation||'';
  if(/^ACA-TXN-[A-Za-z0-9-]{8,100}$/.test(id)&&raw==='FORMATION')return 'FORMATION';
  if(/^TXN-[A-Za-z0-9-]{8,100}$/.test(id)&&(!raw||raw==='SHOOTING'||raw==='PHOTO'))return 'PHOTO';
  return null;
}
