/** v7.0.14-rc3. Pilotage read-only. Depends on core, LOT1/3/4 and canonical ENC.
 * No new financial calculation or projection. No write except existing access audit. */
function BXCT_ACA_PILOTAGE_context_(token){
 const ctx=BXCT_CORE_AUTH_context_(token);
 if(ctx.agent.role!=='ADMIN_CONTROL'||!ctx.rights.includes('CONSULTER_ACADEMIE'))throw new Error('ACCES_REFUSE');
 return ctx;
}
function BXCT_ACA_PILOTAGE_metrics_(sessions,metrics){
 const groups={actives:0,avenir:0,archives:0};
 const formations=new Map();
 for(const s of metrics.sessions){
  if(!sessions[s.code])throw new Error('SESSION_INCOHERENTE');
  const k=BXCT_ACA_SESSION_group_(s.statut),f=formations.get(s.formation)||{code:s.formation,sessions:0,actives:0,avenir:0,archives:0,confirmes:0,aTraiter:0,attente:0};
  groups[k]++;f.sessions++;f[k]++;f.confirmes+=s.confirmesControl;f.aTraiter+=s.aTraiter;f.attente+=s.attenteControl;formations.set(s.formation,f);
 }
 return {sessions:groups,dossiers:metrics.totaux,formations:[...formations.values()].sort((a,b)=>a.code.localeCompare(b.code))};
}
function BXCT_ACA_PILOTAGE_read_(ctx){
 const source=BXCT_CORE_DATA_clientSource_(ctx.settings),sessions=academyLot3Sessions_(source),catalogue=BXCT_FORM_ADMIN_DATA_read_(source);
 const list=Object.values(sessions),metrics=academyLot1SuiviInterne_(source,ctx.book,list);
 const data=BXCT_ACA_PILOTAGE_metrics_(sessions,metrics),titles=new Map(catalogue.map(f=>[f.code,f.titre]));
 data.formations.forEach(f=>{f.titre=titles.get(f.code)||f.code;});
 data.catalogue=catalogue.length;data.date=new Date().toISOString();data.mode=ctx.settings.APP_MODE;
 // A missing finance privilege or malformed register is not a zero balance.
 data.finances=null;
 try{BXCT_ENC_ACADEMY_DESK_permission_(ctx);data.finances=BXCT_ENC_SERVICE_read_(ctx,BXCT_ENC_ACADEMY_DESK_filter_({view:'SOLDES',page:0})).totaux;}catch(e){}
 return data;
}
function BXCT_ACA_PILOTAGE_LIRE(token){
 try{const ctx=BXCT_ACA_PILOTAGE_context_(token);academyLookupLimit_(ctx.agent,ctx.settings);const data=BXCT_ACA_PILOTAGE_read_(ctx);
  academyLookupAudit_(ctx.book,ctx.agent.agentId,'PILOTAGE_ACADEMIE','PILOTAGE_ACADEMIE','PILOTAGE');
  return {ok:true,code:'PILOTAGE_OK',message:'Sources officielles · toutes périodes.',data};
 }catch(e){return {ok:false,code:'PILOTAGE_INDISPONIBLE',message:'Accès administrateur ou sources indisponibles.',data:null};}
}
/** Owner-only read audit; no sync writes. Exposes only counts and flags. */
function BXCT_ACA_FINAL_AUDIT(){
 try{const owner=BXCT_CORE_AUTH_proprietaire_(),book=owner.book,settings=readControlSettings_(book),source=BXCT_CORE_DATA_clientSource_(settings);
  const sessions=academyLot3Sessions_(source),decisions=academyLot3Snapshot_(academyLot3ReadEvents_(book)),presences=academyLot4Snapshot_(academyLot4ReadEvents_(book));
  const seances=BXCT_CORE_DATA_readTable_(source,'SEANCES_ACADEMIE',['code_session','numero_seance','validation','actif'],1000),seen=new Set();let anomalies=0;
  for(const s of seances){const k=s.code_session+'|'+Number(s.numero_seance);if(!sessions[s.code_session]||!Number.isInteger(Number(s.numero_seance))||Number(s.numero_seance)<1||seen.has(k))anomalies++;seen.add(k);}
  for(const d of Object.values(decisions))if(!sessions[d.session]||sessions[d.session].formation!==d.formation)anomalies++;
  for(const p of Object.values(presences))if(!seen.has(p.session+'|'+p.numero)||!decisions[p.id]||decisions[p.id].code!==p.code)anomalies++;
  const result={ok:anomalies===0,version:'7.0.14-rc3',schemaVersion:1,mode:settings.APP_MODE,source:'CLIENT',sessions:Object.keys(sessions).length,seances:seances.length,decisions:Object.keys(decisions).length,presences:Object.keys(presences).length,anomalies,lectureSeule:true};console.log(JSON.stringify(result));return result;
 }catch(e){return {ok:false,code:'AUDIT_INDISPONIBLE',message:'Vérifiez les sources et la configuration.'};}
}
