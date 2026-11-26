/** Existing CONTROL registry is the sole authority for trainer access. TEST only.
 * Depends on session API, role permissions, LOT3 session reader, existing LOT4 authorization. */
const BXCT_ACA_FORMATEUR_HEADER_=['affectation_id','code_session','agent_id','fonction','actif','validation','attribue_par','cree_utc','note_interne'];
function BXCT_ACA_FORMATEUR_context_(token){const ctx=BXCT_ACA_SESSION_context_(token);if(!BXCT_ACA_SESSION_canCreate_(ctx)||ctx.agent.role!=='ADMIN_CONTROL')throw new Error('TEST_REQUIS');return ctx;}
function BXCT_ACA_FORMATEUR_agents_(book){
 const sh=book.getSheetByName('AGENTS');if(!sh||sh.getLastRow()<1||sh.getLastRow()>2001)throw new Error('AGENTS_INDISPONIBLES');
 const head=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0],n=sh.getLastRow()-1;
 const cols=['agent_id','nom_affiche','role','actif'].map(k=>{const p=head.indexOf(k);if(p<0)throw new Error('SCHEMA_AGENTS');return n?sh.getRange(2,p+1,n,1).getDisplayValues():[];});
 const ids=new Set(),out=[];for(let i=0;i<n;i++){const [id,name,role,active]=cols.map(c=>String(c[i][0]||'').trim());if(!id&&!name&&!role&&!active)continue;if(!/^[A-Za-z0-9_:-]{2,80}$/.test(id)||ids.has(id))throw new Error('AGENTS_INCOHERENTS');ids.add(id);if(role==='FORMATEUR'&&active==='OUI'&&name)out.push({id,name:name.slice(0,120)});}
 return out.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
function BXCT_ACA_FORMATEUR_table_(book){
 const sh=book.getSheetByName('AFFECTATIONS_SESSIONS_ACADEMIE');if(!sh||sh.getLastColumn()!==BXCT_ACA_FORMATEUR_HEADER_.length||sh.getLastRow()<1||sh.getLastRow()>5001||sh.getRange(1,1,1,BXCT_ACA_FORMATEUR_HEADER_.length).getDisplayValues()[0].join('|')!==BXCT_ACA_FORMATEUR_HEADER_.join('|'))throw new Error('SCHEMA_AFFECTATIONS');
 const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,BXCT_ACA_FORMATEUR_HEADER_.length).getDisplayValues().filter(r=>r.some(Boolean)):[],ids=new Set();for(const r of rows){if(!r[0]||ids.has(r[0]))throw new Error('AFFECTATIONS_INCOHERENTES');ids.add(r[0]);}return {sh,rows};
}
function BXCT_ACA_FORMATEUR_session_(ctx,code){
 if(!/^SES-[A-F0-9]{32}$/.test(String(code||'')))throw new Error('SESSION_INVALIDE');const source=BXCT_CORE_DATA_clientSource_(ctx.settings),s=academyLot3Sessions_(source)[code];
 if(!s||!['BROUILLON','ANNONCEE','OUVERTE','COMPLETE','FERMEE'].includes(s.statut))throw new Error('SESSION_PROTEGEE');return s;
}
function BXCT_ACA_FORMATEUR_current_(rows,code){const active=rows.filter(r=>r[1]===code&&r[3]==='FORMATEUR'&&r[4]==='OUI');if(active.length>1||active.some(r=>r[5]!=='VALIDEE'))throw new Error('AFFECTATION_A_VERIFIER');return active[0]||null;}
function BXCT_ACA_FORMATEURS_LIST(token,input){
 try{const ctx=BXCT_ACA_FORMATEUR_context_(token),s=BXCT_ACA_FORMATEUR_session_(ctx,input?.code),agents=BXCT_ACA_FORMATEUR_agents_(ctx.book),t=BXCT_ACA_FORMATEUR_table_(ctx.book),current=BXCT_ACA_FORMATEUR_current_(t.rows,s.code);
  academyLookupAudit_(ctx.book,ctx.agent.agentId,'AFFECTATIONS_ACADEMIE','LECTURE_FORMATEURS',s.code);return {ok:true,code:'FORMATEURS_OK',message:'Agents FORMATEUR actifs.',data:{agents,current:current?{id:current[2],name:agents.find(a=>a.id===current[2])?.name||'Agent historique / inactif'}:null}};
 }catch(e){return {ok:false,code:'FORMATEURS_INDISPONIBLES',message:'Affectation TEST indisponible ou session protégée.',data:null};}
}
function BXCT_ACA_FORMATEUR_AFFECTER(token,input){
 try{const ctx=BXCT_ACA_FORMATEUR_context_(token),lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw new Error('SERVICE_OCCUPE');
  try{const s=BXCT_ACA_FORMATEUR_session_(ctx,input?.code),agent=BXCT_ACA_FORMATEUR_agents_(ctx.book).find(a=>a.id===input?.agentId);if(!agent)throw new Error('FORMATEUR_INACTIF');
   const table=BXCT_ACA_FORMATEUR_table_(ctx.book),current=BXCT_ACA_FORMATEUR_current_(table.rows,s.code);if(current){if(current[2]!==agent.id)throw new Error('FORMATEUR_DEJA_AFFECTE');return {ok:true,code:'AFFECTATION_REJOUEE',message:'Formateur déjà affecté.',data:{id:current[0]}};}
   if(table.sh.getLastRow()>=5001)throw new Error('LIMITE');const id='ACA-AFF-'+photo6Hash_([s.code,agent.id]);if(table.rows.some(r=>r[0]===id))throw new Error('AFFECTATION_HISTORIQUE');
   academyLookupAudit_(ctx.book,ctx.agent.agentId,'AFFECTATIONS_ACADEMIE','INTENTION_AFFECTER_FORMATEUR',s.code+'|'+agent.id);
   table.sh.appendRow([id,s.code,agent.id,'FORMATEUR','OUI','VALIDEE',ctx.agent.agentId,new Date().toISOString(),'Affectation manuelle TEST v7.0.14-rc3']);SpreadsheetApp.flush();
   const persisted=BXCT_ACA_FORMATEUR_current_(BXCT_ACA_FORMATEUR_table_(ctx.book).rows,s.code);if(!persisted||persisted[0]!==id)throw new Error('RESULTAT_NON_CONFIRME');
   return {ok:true,code:'AFFECTATION_OK',message:'Formateur responsable affecté dans CONTROL TEST.',data:{id}};
  }finally{lock.releaseLock();}
 }catch(e){return {ok:false,code:'AFFECTATION_NON_CONFIRMEE',message:'Affectation refusée ou non confirmée. Vérifiez les agents actifs et l’affectation existante.',data:null};}
}
