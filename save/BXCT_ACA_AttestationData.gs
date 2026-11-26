/** Unique registry of TEST drafts. Append only; JSON is plain text, not a formula. */
const BXCT_ACA_ATTESTATION_HEADERS_=['brouillon_id','date_utc','agent_id','empreinte','snapshot_json'];
function BXCT_ACA_ATTESTATION_table_(book,create){
 let sh=book.getSheetByName('BXCT_ACA_ATTESTATIONS_TEST');
 if(!sh&&create){sh=book.insertSheet('BXCT_ACA_ATTESTATIONS_TEST');sh.getRange(1,1,1,5).setValues([BXCT_ACA_ATTESTATION_HEADERS_]);sh.setFrozenRows(1);}
 if(!sh)return null;
 if(sh.getLastColumn()!==5||sh.getLastRow()<1||sh.getLastRow()>5001||sh.getRange(1,1,1,5).getDisplayValues()[0].join('|')!==BXCT_ACA_ATTESTATION_HEADERS_.join('|'))throw new Error('REGISTRE_INCOHERENT');
 const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,5).getDisplayValues():[],map=new Map();
 for(const r of rows){if(!r.some(Boolean))continue;const d=JSON.parse(r[4]);if(!d||d.statut!=='BROUILLON_NON_OFFICIEL'||!/^BX\.FOR\.[A-Z0-9]{2,20}$/.test(d.code)||!/^ATT-TEST-[a-f0-9]{64}$/.test(r[0])||r[0]!=='ATT-TEST-'+r[3]||photo6Hash_(d)!==r[3]||map.has(r[0]))throw new Error('REGISTRE_INCOHERENT');map.set(r[0],{id:r[0],date:r[1],data:d});}
 return {sh,map};
}
function BXCT_ACA_ATTESTATION_append_(table,agent,data,hash){
 const id='ATT-TEST-'+hash,prior=table.map.get(id);if(prior)return {id,date:prior.date,rejoue:true};
 if(table.sh.getLastRow()>=5001)throw new Error('LIMITE_REGISTRE');
 const date=new Date().toISOString();table.sh.appendRow([id,date,agent,hash,JSON.stringify(data)]);SpreadsheetApp.flush();
 const reread=BXCT_ACA_ATTESTATION_table_( {getSheetByName:()=>table.sh},false).map.get(id);
 if(!reread)throw new Error('RESULTAT_NON_CONFIRME');return {id,date:reread.date,rejoue:false};
}
