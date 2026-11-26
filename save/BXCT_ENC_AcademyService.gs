/** Adapter FORMATION. Depends on canonical service and historical public projection. */
function BXCT_ENC_ACADEMY_ledger_(book){
  const ledger=BXCT_ENC_SERVICE_ledger_(book),byId=new Map();
  for(const e of ledger.events)if(e.action==='ENREGISTRER'&&e.code_prestation==='FORMATION'){
    if(!/^ACA-TXN-[A-Za-z0-9-]{8,100}$/.test(e.transaction_id))throw new Error('JOURNAL_ACADEMIE_INCOHERENT');
    byId.set(e.transaction_id,{formation:e.code_formation,session:e.code_session,ref:e.reference_devis,echeance:e.echeance_id});
  }
  return {...ledger,byId};
}
function BXCT_ENC_ACADEMY_balance_(ledger,quote){
  let paid=0,pending=0,refund=0,pendingRefund=0;const transactions=[];
  for(const t of ledger.states.values())if(t.inscriptionId===quote.inscriptionId){
    const meta=ledger.byId.get(t.transactionId);
    if(!meta||meta.ref!==quote.ref||meta.formation!==quote.formation||meta.session!==quote.session||t.code!==quote.code||Number(t.create.devis_client_fcfa)!==quote.total)throw new Error('PAIEMENT_AUTRE_PRESTATION');
    const a=BXCT_ENC_SERVICE_amount_(t);paid+=a.paid;pending+=a.pending;refund+=a.refund;pendingRefund+=a.pendingRefund;
    transactions.push(photo6Public_(t));
  }
  const net=paid-refund;
  return {devisFcfa:quote.total,totalValideFcfa:paid,totalEnAttenteFcfa:pending,
    remboursementsFcfa:refund,remboursementsEnAttenteFcfa:pendingRefund,attenteNetteFcfa:pending-pendingRefund,netEncaisseFcfa:net,soldeFcfa:Math.max(0,quote.total-net),
    statut:net>=quote.total?'REGLE':net>0?'PARTIEL':'NON_REGLE',transactions};
}
