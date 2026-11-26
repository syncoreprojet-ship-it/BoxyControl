/** v7.0.14-rc2. Lecture officielle, création via HMAC en TEST seulement. */
function BXCT_ACA_SESSION_context_(token){
 const ctx=BXCT_FORM_ADMIN_AUTH_context_(token);
 if(ctx.settings.ACADEMIE_SESSIONS_LECTURE_ACTIVE!=='OUI')throw new Error('LECTURE_FERMEE');
 return ctx;
}
function BXCT_ACA_SESSION_canCreate_(ctx){return BXCT_FORM_ADMIN_AUTH_write_(ctx)&&PropertiesService.getScriptProperties().getProperty('BXCT_ACA_SESSION_TEST_ENABLED')==='OUI';}
function BXCT_ACA_SESSION_group_(status){return ['TERMINEE','TERMINE','ANNULEE','ARCHIVEE'].includes(status)?'archives':status==='EN_COURS'?'actives':'avenir';}
function BXCT_ACA_SESSION_LIST(token,filter){
 try{
  const ctx=BXCT_ACA_SESSION_context_(token),source=BXCT_CORE_DATA_clientSource_(ctx.settings),catalogue=BXCT_FORM_ADMIN_DATA_read_(source);
  const fields=['code_session','code_formation','titre_session','date_debut','date_fin','heure_debut','heure_fin','capacite_max','statut_session','validation_session','visible_public'];
  const all=BXCT_CORE_DATA_readTable_(source,'SESSIONS_ACADEMIE',fields,500),seen=new Set();
  all.forEach(s=>{if(!/^[A-Z0-9_-]{3,80}$/.test(s.code_session)||seen.has(s.code_session)||!catalogue.some(f=>f.code===s.code_formation))throw new Error('SCHEMA_SESSION_INCOHERENT');seen.add(s.code_session);});
  const form=String(filter?.formation||''),q=String(filter?.q||'').slice(0,120).toLowerCase(),year=String(filter?.year||''),group=String(filter?.group||'actives'),page=Math.max(1,Math.min(50,Number(filter?.page)||1));
  if(!Number.isInteger(page)||!['actives','avenir','archives'].includes(group)||year&&!/^\d{4}$/.test(year))throw new Error('FILTRE_INVALIDE');
  const subset=all.filter(s=>(!year||s.date_debut.startsWith(year))&&(!q||[s.titre_session,s.code_session,catalogue.find(f=>f.code===s.code_formation)?.titre].some(x=>String(x||'').toLowerCase().includes(q))));
  const counts={actives:0,avenir:0,archives:0};subset.forEach(s=>counts[BXCT_ACA_SESSION_group_(s.statut_session)]++);
  const scoped=subset.filter(s=>BXCT_ACA_SESSION_group_(s.statut_session)===group);
  const groups=catalogue.map(f=>({code:f.code,titre:f.titre,total:scoped.filter(s=>s.code_formation===f.code).length})).filter(f=>f.total>0);
  const matches=form?scoped.filter(s=>s.code_formation===form).sort((a,b)=>b.date_debut.localeCompare(a.date_debut)||b.code_session.localeCompare(a.code_session)):[];
  const pageActual=Math.min(page,Math.max(1,Math.ceil(matches.length/10)));
  const slice=matches.slice((pageActual-1)*10,pageActual*10);
  const metrics=slice.length?academyLot1SuiviInterne_(source,ctx.book,slice.map(s=>({...s,code:s.code_session}))):{sessions:[]};
  if(slice.length){const lessons=BXCT_CORE_DATA_readTable_(source,'SEANCES_ACADEMIE',['code_session','numero_seance','date_seance','heure_debut','heure_fin','activite','validation','actif'],1000);metrics.sessions.forEach(s=>{s.seances=lessons.filter(x=>x.code_session===s.code_session&&x.actif==='OUI').sort((a,b)=>Number(a.numero_seance)-Number(b.numero_seance));});}
  return {ok:true,code:'SESSIONS_OK',message:'Sessions officielles.',data:{counts,groups,totalSessions:all.length,totalFormations:catalogue.length,page:pageActual,total:matches.length,sessions:metrics.sessions,years:[...new Set(all.map(s=>s.date_debut.slice(0,4)).filter(x=>/^\d{4}$/.test(x)))].sort().reverse(),formations:catalogue.filter(f=>f.inscription==='PARCOURS_HISTORIQUE'&&f.validation==='VALIDEE'&&f.visiblePublic==='OUI'&&f.visibleVitrine!=='NON').map(f=>({code:f.code,titre:f.titre})),canCreate:BXCT_ACA_SESSION_canCreate_(ctx)}};
 }catch(e){return {ok:false,code:'SESSIONS_INDISPONIBLES',message:'Lecture fermée ou source incohérente.',data:null};}
}
function BXCT_ACA_SESSION_CREATE(token,body){return BXCT_ACA_SESSION_mutate_(token,body,'ACA_SESSION_CREATE');}
function BXCT_ACA_SESSION_SEANCE(token,body){return BXCT_ACA_SESSION_mutate_(token,body,'ACA_SESSION_SEANCE');}
function BXCT_ACA_SESSION_CHANGE(token,body){return BXCT_ACA_SESSION_mutate_(token,body,'ACA_SESSION_CHANGE');}
function BXCT_ACA_SESSION_mutate_(token,body,operation){
 let transportStarted=false,lock=null;
 try{
  const ctx=BXCT_ACA_SESSION_context_(token);if(!BXCT_ACA_SESSION_canCreate_(ctx))throw new Error('CREATION_FERMEE');
  const source=BXCT_CORE_DATA_clientSource_(ctx.settings);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('DEMANDE_INVALIDE');
  if(operation==='ACA_SESSION_CREATE')body={...body,formateur:''};
  if(operation==='ACA_SESSION_CHANGE'){
   lock=LockService.getScriptLock();if(!lock.tryLock(20000)){lock=null;throw new Error('SERVICE_OCCUPE');}
   if(!/^SES-[A-F0-9]{32}$/.test(String(body.code||'')))throw new Error('SESSION_INVALIDE');
   const lifecycle=['FERMER','DEMARRER','TERMINER'].includes(body.action);
   if(lifecycle)body={...body,proof:BXCT_ACA_LIFECYCLE_proof_(ctx,source,body)};
   if(!lifecycle&&body.action!=='OUVRIR'&&Object.values(academyLot3Snapshot_(academyLot3ReadEvents_(ctx.book))).some(x=>x.session===body.code&&['CONFIRMEE','LISTE_ATTENTE'].includes(x.statut)))throw new Error('SESSION_OCCUPEE');
  }
  const req={issuer:'BOXY_CONTROL',schema:1,requestId:Utilities.getUuid().toUpperCase(),ts:Date.now(),operation:operation,agentId:ctx.agent.agentId,prestations:['FORMATION'],body:Object.assign({},body,{target:source.getId()})};
  transportStarted=true;const r=BXCT_L8_TRANSPORT_envoyerSigne_(req);if(!r||typeof r.ok!=='boolean')throw new Error('TRANSPORT');
  return {ok:r.ok,code:r.code,message:r.ok?r.message:'Création refusée par CLIENT : '+String(r.code||'ERREUR'),data:r.ok?r.data:null};
 }catch(e){return transportStarted?{ok:false,code:'CREATION_NON_CONFIRMEE',message:'Résultat incertain. Réessayez avec la même demande.',data:null}:{ok:false,code:'OPERATION_CONTROL_REFUSEE',message:'Opération refusée avant transmission : droits, configuration, demandes ou bilans à traiter.',data:null};}finally{if(lock)lock.releaseLock();}
}
function BXCT_ACA_SESSION_AUDIT(){
 try{const ctx=BXCT_CORE_AUTH_proprietaire_(),settings=readControlSettings_(ctx.book),source=BXCT_CORE_DATA_clientSource_(settings),sessions=academyLot3Sessions_(source),events=academyLot3ReadEvents_(ctx.book),snap=academyLot3Snapshot_(events);let incoherences=0;Object.values(snap).forEach(d=>{if(!sessions[d.session]||sessions[d.session].formation!==d.formation)incoherences++;});const r={ok:incoherences===0,version:'7.0.14-rc3',schemaVersion:1,mode:settings.APP_MODE,sessions:Object.keys(sessions).length,decisions:events.length,incoherences,testMutationOptIn:PropertiesService.getScriptProperties().getProperty('BXCT_ACA_SESSION_TEST_ENABLED')==='OUI'};console.log(JSON.stringify(r));return r;}catch(e){return {ok:false,code:'AUDIT_INDISPONIBLE'};}
}
