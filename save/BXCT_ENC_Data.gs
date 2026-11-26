/** Depend de: Config, schemas historiques. Utilise par: Service, Setup. */
function BXCT_ENC_DATA_schema_(book, extended) {
  const sh=book.getSheetByName(BXCT_ENC_SHEET_);
  const keys=PHOTO6_EVENTS_.concat(extended?ACA5_META_:[]);
  photo6AssertHeader_(sh,keys);
  return {sh,keys};
}
function BXCT_ENC_DATA_read_(book) {
  const {sh,keys}=BXCT_ENC_DATA_schema_(book,true);
  const n=sh.getLastRow();
  if(n>BXCT_ENC_MAX_ROWS_)throw new Error('JOURNAL_TROP_VOLUMINEUX');
  if(n<2)return [];
  const rows=sh.getRange(2,1,n-1,keys.length).getDisplayValues();
  if(rows.some(r=>!r[0]&&r.some(v=>String(v).trim()!=='')))throw new Error('EVENEMENT_SANS_IDENTIFIANT');
  return rows.filter(r=>r[0]).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]])));
}
function BXCT_ENC_DATA_append_(book,e,extended) {
  const {sh,keys}=BXCT_ENC_DATA_schema_(book,extended);
  sh.appendRow(keys.map(k=>e[k]===undefined?'':e[k]));
  SpreadsheetApp.flush();
}

/** Only frozen, validated CONTROL quotes; no CLIENT scan or inferred prices. */
function BXCT_ENC_DATA_quotes_(book){
  const rows=acad5Table_(book,'DEVIS_ACADEMIE_CONTROL',ACA5_QUOTE_HEADER_,500),seen=new Set();
  const result=[];
  for(const r of rows){
    const id=String(r.inscription_id||'');if(!id||seen.has(id))throw new Error('DEVIS_AMBIGU');seen.add(id);
    if(r.statut_devis!=='VALIDE')continue;
    if(!r.code_public||!r.code_formation||!r.code_session||!r.reference_devis_client)throw new Error('DEVIS_INVALIDE');
    result.push({inscriptionId:id,code:String(r.code_public),formation:String(r.code_formation),session:String(r.code_session),ref:String(r.reference_devis_client),total:photo6Int_(r.montant_total_fcfa,1,999999999,'DEVIS_INVALIDE')});
  }
  return result;
}
