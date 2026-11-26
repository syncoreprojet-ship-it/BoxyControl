/** Read-only integrity checks. No repairs, no customer data in output. */
function BXCT_ENC_AUDIT_checks_(events,quotes){
  const issues=new Set(),keys=new Set(),refs=new Set(),receipts=new Set(),origins=new Map(),first=new Map();
  const flag=c=>issues.add(c);
  let states;
  try{states=photo6States_(events);}catch(_){return ['JOURNAL_EVENEMENTS_INCOHERENT'];}
  for(const e of events){
    if(!e.evenement_id||!e.inscription_id||!e.code_public||!e.cle_idempotence||keys.has(e.cle_idempotence))flag('IDENTIFIANT_OU_IDEMPOTENCE_INCOHERENT');
    keys.add(e.cle_idempotence);
    const domain=BXCT_ENC_SERVICE_domain_(e);
    if(!domain)flag('PRESTATION_INCOHERENTE');
    if(e.action==='ENREGISTRER'){
      first.set(e.transaction_id,e);
      if(e.statut_avant)flag('STATUT_INITIAL_INCOHERENT');
      if(!e.agent_auteur_id)flag('AUTEUR_ABSENT');
      if(domain==='FORMATION'&&(!e.code_formation||!e.code_session||!e.reference_devis))flag('METADONNEES_FORMATION_ABSENTES');
      if(e.methode==='MOBILE_MONEY'){
        const ref=String(e.fournisseur||'')+'|'+String(e.reference_externe||'').toUpperCase();
        if(!e.fournisseur||!e.reference_externe||refs.has(ref))flag('REFERENCE_MM_INCOHERENTE');refs.add(ref);
      }
    }else{
      const base=first.get(e.transaction_id);
      if(!base||e.statut_avant!=='EN_ATTENTE'||['code_public','agent_auteur_id','transaction_origine_id','fournisseur','reference_externe','devis_client_fcfa','code_prestation','code_formation','code_session','reference_devis'].some(k=>String(e[k]||'')!==String(base[k]||'')))flag('DECISION_DONNEES_MODIFIEES');
      if(e.statut_apres==='VALIDE'){
        if(!e.agent_verificateur_id||e.agent_verificateur_id===e.agent_auteur_id)flag('DOUBLE_CONTROLE_ABSENT');
        if(!e.numero_recu||receipts.has(e.numero_recu))flag('RECU_INCOHERENT');receipts.add(e.numero_recu);
      }
    }
  }
  for(const t of states.values()){
    if(t.type!=='REMBOURSEMENT')continue;
    const orig=states.get(t.origine);
    if(!orig||orig.type!=='ENCAISSEMENT'||orig.statut!=='VALIDE'||orig.inscriptionId!==t.inscriptionId||orig.methode!==t.methode||BXCT_ENC_SERVICE_domain_(orig.create)!==BXCT_ENC_SERVICE_domain_(t.create)){flag('ORIGINE_REMBOURSEMENT_INVALIDE');continue;}
    if(t.statut!=='REJETE')origins.set(t.origine,(origins.get(t.origine)||0)+t.montant);
  }
  const netByDossier=new Map();
  for(const t of states.values())if(t.statut==='VALIDE'){
    const key=BXCT_ENC_SERVICE_domain_(t.create)+'|'+t.inscriptionId;
    const current=netByDossier.get(key)||{net:0,quote:Number(t.create.devis_client_fcfa)};
    current.net+=BXCT_ENC_SERVICE_amount_(t).signed;netByDossier.set(key,current);
  }
  for(const d of netByDossier.values())if(d.net<0||d.net>d.quote)flag('SOLDE_HORS_LIMITES');
  for(const [id,sum] of origins)if(sum>states.get(id).montant)flag('REMBOURSEMENT_EXCESSIF');
  try{
    const global=BXCT_ENC_SERVICE_summary_(events,{prestation:'TOUTES',page:0},quotes);
    const photo=BXCT_ENC_SERVICE_summary_(events,{prestation:'PHOTO',page:0},[]);
    const academy=BXCT_ENC_SERVICE_summary_(events,{prestation:'FORMATION',page:0},quotes);
    for(const k of Object.keys(global.totaux))if(global.totaux[k]!==photo.totaux[k]+academy.totaux[k])flag('TOTAL_INTER_PRESTATIONS_INCOHERENT');
    const byId=new Map(), dossiers=new Map();
    for(const t of states.values())if(BXCT_ENC_SERVICE_domain_(t.create)==='FORMATION'){
      const e=t.create;byId.set(t.transactionId,{formation:e.code_formation,session:e.code_session,ref:e.reference_devis,echeance:e.echeance_id});
      dossiers.set(t.inscriptionId,{inscriptionId:t.inscriptionId,code:t.code,formation:e.code_formation,session:e.code_session,ref:e.reference_devis,total:Number(e.devis_client_fcfa)});
    }
    for(const q of quotes||[])dossiers.set(q.inscriptionId,q);
    // Index by dossier once: avoids repeated scanning of the full journal.
    const groups=new Map();for(const t of states.values()){if(!groups.has(t.inscriptionId))groups.set(t.inscriptionId,new Map());groups.get(t.inscriptionId).set(t.transactionId,t);}
    let net=0,solde=0,pending=0,pendingRefund=0;
    for(const q of dossiers.values()){
      const b=BXCT_ENC_ACADEMY_balance_({states:groups.get(q.inscriptionId)||new Map(),byId},q);
      net+=b.netEncaisseFcfa;solde+=b.soldeFcfa;pending+=b.totalEnAttenteFcfa;pendingRefund+=b.remboursementsEnAttenteFcfa;
    }
    if(net!==academy.totaux.netFcfa||solde!==academy.totaux.soldeFcfa||pending!==academy.totaux.versementsAttenteFcfa||pendingRefund!==academy.totaux.remboursementsAttenteFcfa)flag('SOLDE_ACADEMIE_INCOHERENT');
  }catch(_){flag('PROJECTION_OU_DEVIS_INCOHERENT');}
  return Array.from(issues).sort();
}
function BXCT_ENC_AUDIT_(){
  const result={ok:false,version:BXCT_ENC_VERSION_,schemaVersion:BXCT_ENC_SCHEMA_VERSION_,ecritureActive:false,anomalies:[]};
  try{
    const book=controlWorkbook_();
    result.anomalies=BXCT_ENC_AUDIT_checks_(BXCT_ENC_DATA_read_(book),BXCT_ENC_DATA_quotes_(book));
    result.ok=result.anomalies.length===0 && BXCT_ENC_ACADEMY_WRITE_ACTIVE_===false;
    if(BXCT_ENC_ACADEMY_WRITE_ACTIVE_!==false)result.anomalies.push('ECRITURES_ACADEMIE_ACTIVES');
  }catch(_){result.anomalies.push('JOURNAL_OU_SCHEMA_INCOHERENT');}
  console.log(JSON.stringify(result));return result;
}
/** Public editor entry; aggregate diagnostic codes only. */
function BXCT_ENC_AUDIT(){return BXCT_ENC_AUDIT_();}
