/** Listes opérationnelles en lecture seule. Identité et autorisations historiques ; aucun PII de contact. */
function BXCT_ACA_ROSTER_LIST(token,input){
 try{
  const ctx=academyLookupContext_(token),mode=String(input?.mode||'');
  if(!['inscriptions','apprenants','presences'].includes(mode))throw new Error('MODE_INVALIDE');
  if(mode==='presences'){
   const p=academyLot4Context_(token,true);
   if(!['SUPERVISEUR','ADMIN_CONTROL'].includes(p.agent.role))throw new Error('LISTE_PRESENCES_RESTREINTE');
  }
  academyLookupLimit_(ctx.agent,ctx.settings);
  const source=ouvrirSourceClientPhoto_(ctx.settings),sheet=source.getSheetByName('INSCRIPTIONS');
  if(!sheet||sheet.getLastRow()<1||sheet.getLastRow()>25001)throw new Error('SOURCE_INDISPONIBLE');
  const fields=['inscription_id','code_public','code_prestation','code_session','statut','maj_le_utc'];
  const head=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  const n=sheet.getLastRow()-1,cols=fields.map(k=>{const p=head.indexOf(k);if(p<0)throw new Error('SCHEMA_INCOMPATIBLE');return n?sheet.getRange(2,p+1,n,1).getDisplayValues():[];});
  const decisions=academyLot3Snapshot_(academyLot3ReadEvents_(ctx.book));
  const sessions=BXCT_CORE_DATA_readTable_(source,'SESSIONS_ACADEMIE',['code_session','titre_session','code_formation'],500),map=new Map(sessions.map(s=>[s.code_session,s]));
  if(map.size!==sessions.length)throw new Error('SESSIONS_INCOHERENTES');
  const q=String(input?.q||'').trim().toUpperCase().slice(0,100),page=Number(input?.page||1),session=String(input?.session||'');
  if(!Number.isInteger(page)||page<1||page>2500||session&&!map.has(session))throw new Error('FILTRE_INVALIDE');
  const found=[],seen=new Set(),codes=new Set();
  for(let i=0;i<n;i++){
   const [id,code,prestation,origin,request,updated]=cols.map(c=>String(c[i][0]||'').trim());
   if(prestation.toUpperCase()!=='FORMATION')continue;
   if(!id||seen.has(id)||!academyLot2NormaliserCode_(code)||codes.has(code))throw new Error('DOSSIERS_INCOHERENTS');seen.add(id);codes.add(code);
   const d=decisions[id];if(d&&d.code!==code)throw new Error('JOURNAL_INCOHERENT');
   const status=request==='ANNULEE'?'ANNULEE':d?.statut||'EN_ATTENTE';
   const sid=d?.session||origin,ref=map.get(sid);
   if(mode==='inscriptions'&&!['EN_ATTENTE','LISTE_ATTENTE'].includes(status)||mode!=='inscriptions'&&status!=='CONFIRMEE')continue;
   if(mode==='presences'&&!ref)continue;
   if(session&&sid!==session)continue;
   if(q&&![code,sid,ref?.titre_session].some(x=>String(x||'').toUpperCase().includes(q)))continue;
   found.push({code,session:ref?sid:'',titre:ref?.titre_session||'À affecter',statut:status,maj:updated});
  }
  found.sort((a,b)=>b.maj.localeCompare(a.maj)||a.code.localeCompare(b.code));
  const p=Math.min(page,Math.max(1,Math.ceil(found.length/10))),items=found.slice((p-1)*10,p*10);
  // Journal d'accès avant toute divulgation ; pas de code individuel en clair.
  academyLookupAudit_(ctx.book,ctx.agent.agentId,'LISTE_ACADEMIE','LISTE_'+mode.toUpperCase(),mode+'|'+p+'|'+session+'|'+q);
  return {ok:true,code:'LISTE_OK',message:'Liste officielle.',data:{items,page:p,total:found.length,sessions:sessions.map(s=>({code:s.code_session,titre:s.titre_session}))}};
 }catch(e){return {ok:false,code:'LISTE_FERMEE',message:'Liste non autorisée ou source indisponible. La recherche individuelle reste accessible selon vos droits.',data:null};}
}
