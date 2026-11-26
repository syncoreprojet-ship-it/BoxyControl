/** Session transition policy. CONTROL holds the historical decision/attendance script lock
 * through HMAC; CLIENT rechecks the source request fingerprint under its own lock.
 * Direct edits by spreadsheet owners are outside that distributed lock. */
function BXCT_ACA_LIFECYCLE_requests_(source,session){
 const sh=source.getSheetByName('INSCRIPTIONS');if(!sh||sh.getLastRow()<1||sh.getLastRow()>25001)throw new Error('SOURCE_INDISPONIBLE');
 const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0],keys=['inscription_id','code_public','code_prestation','code_session','statut'],n=sh.getLastRow()-1;
 const cols=keys.map(k=>{const p=h.indexOf(k);if(p<0)throw new Error('SOURCE_INDISPONIBLE');return n?sh.getRange(2,p+1,n,1).getDisplayValues():[];});
 const out=[],seen=new Set();for(let i=0;i<n;i++){const [id,pub,pre,sessionCode,status]=cols.map(c=>String(c[i][0]||'').trim());if(pre.toUpperCase()!=='FORMATION')continue;
  if(!id||seen.has(id)||!/^BX\.FOR\.[A-Z0-9]{2,20}$/.test(pub))throw new Error('DOSSIERS_INCOHERENTS');seen.add(id);out.push([id,pub,status.toUpperCase(),sessionCode.toUpperCase()]);}
 return out.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
}
function BXCT_ACA_LIFECYCLE_check_(requests,decisions,session,action,seances,presences){
 const sourceById=new Map(requests.map(r=>[r[0],r]));
 for(const [id,code,statut,origin] of requests){if(origin!==undefined&&origin!==session)continue;const d=Object.prototype.hasOwnProperty.call(decisions,id)?decisions[id]:null;if(statut==='ANNULEE'){if(d&&d.statut==='CONFIRMEE'&&d.session===session)throw new Error('ANNULATION_A_TRAITER');continue;}if(!d||d.code!==code||!['CONFIRMEE','ANNULEE'].includes(d.statut))throw new Error('DEMANDES_A_TRAITER');}
 const roster=Object.values(decisions).filter(d=>d.session===session);
 if(roster.some(d=>d.statut==='CONFIRMEE'&&(!sourceById.has(d.id)||sourceById.get(d.id)[1]!==d.code||sourceById.get(d.id)[2]==='ANNULEE')))throw new Error('DOSSIER_CONFIRME_INCOHERENT');
 if(roster.some(d=>d.statut==='LISTE_ATTENTE'))throw new Error('LISTE_ATTENTE_NON_VIDEE');
 if(action==='FERMER')return;
 const confirmed=roster.filter(d=>d.statut==='CONFIRMEE');
 if(!confirmed.length||!seances.length||seances.some(s=>!s.validee))throw new Error('SESSION_NON_PREPAREE');
 if(action==='TERMINER')for(const d of confirmed)for(const s of seances){const p=presences[academyLot4Key_(d.id,session,s.numero)];if(!p||p.code!==d.code||p.date!==s.date||!ACAD4_STATUTS_.includes(p.statut))throw new Error('BILANS_INCOMPLETS');}
}
function BXCT_ACA_LIFECYCLE_proof_(ctx,source,body){
 const requests=BXCT_ACA_LIFECYCLE_requests_(source,body.code),decisions=academyLot3Snapshot_(academyLot3ReadEvents_(ctx.book));
 const seances=body.action==='FERMER'?[]:academyLot4Seances_(source,body.code),presences=body.action==='TERMINER'?academyLot4Snapshot_(academyLot4ReadEvents_(ctx.book)):{};
 BXCT_ACA_LIFECYCLE_check_(requests,decisions,body.code,body.action,seances,presences);
 return photo6Hash_(requests);
}
