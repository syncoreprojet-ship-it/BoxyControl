/**
 * BOXY CONTROL ACADEMIE - LOT 6/6 - projection vers BOXY CLIENT.
 * PREPRODUCTION. AUCUNE fonction publique de synchronisation.
 * Executer uniquement depuis l'editeur Apps Script, sur deux copies TEST,
 * apres approbation des parametres des DEUX classeurs.
 * Sources autoritaires : historiques des decisions / presences dans CONTROL.
 * Le journal des paiements CONTROL reste unique et n'est jamais recopie ici.
 * CLIENT.INSCRIPTIONS est TOUJOURS en lecture seule.
 */
const ACA6_VERSION_ = '6.0.0-rc1';
const ACA6_OUTBOX_ = [
 'evenement_sync_id','type_projection','identifiant_cible','version_source',
 'reference_source','statut','cree_utc','envoye_utc','acquitte_utc',
 'nb_essais','erreur_securisee','empreinte_projection'
];
const ACA6_PARTICIPANTS_ = [
 'inscription_id','code_session_confirmee','statut_inscription','statut_participation',
 'seances_prevues','seances_presentes','maj_control_utc','version_control',
 'reference_control','statut_sync'
];
const ACA6_SESSIONS_ = [
 'code_session','confirmes_control','attente_control','statut_sync',
 'version_control','maj_control_utc','maj_projection_utc','source_reference'
];
const ACA6_INCIDENTS_ = [
 'incident_id','evenement_sync_id','type_projection','code_erreur','gravite',
 'nb_essais','cree_utc','maj_utc','statut','observation_securisee'
];

/** Pure editor action: no google.script.run endpoint for sync. */
function synchroniserAcademieClientLot6_() {
  const book = controlWorkbook_();
  const settings = readControlSettings_(book);
  const props = PropertiesService.getScriptProperties();
  acad6RequireControl_(book, settings, props);
  const client = ouvrirSourceClientPhoto_(settings);
  acad6RequireClient_(client, settings, props);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('SERVICE_OCCUPE');
  try {
    const plans = acad6BuildPlans_(book, client, settings);
    const outboxSheet = acad6Sheet_(book,'SYNC_ACADEMIE_CLIENT',ACA6_OUTBOX_);
    acad6Enqueue_(outboxSheet,plans);
    const current = new Map(plans.map(p => [p.type+'|'+p.key,p]));
    const pending = acad6Read_(book,'SYNC_ACADEMIE_CLIENT',ACA6_OUTBOX_,15000)
      .filter(e => ['A_ENVOYER','EN_COURS','ERREUR'].includes(e.statut) && Number(e.nb_essais||0)<5)
      .sort((a,b) => a.identifiant_cible.localeCompare(b.identifiant_cible) || Number(a.version_source)-Number(b.version_source));
    const limit = Math.max(1,Math.min(50,Number(settings.ACADEMIE_SYNC_MAX_PAR_PASSAGE||20)));
    const stats = {release:ACA6_VERSION_,projections:plans.length,attente:pending.length,
      examinees:0,acquittees:0,supplantees:0,erreurs:0};
    for (const msg of pending.slice(0,limit)) {
      stats.examinees++;
      try {
        const plan=current.get(msg.type_projection+'|'+msg.identifiant_cible);
        if (!plan || Number(msg.version_source)<plan.version) {
          acad6Ack_(outboxSheet,msg,'BLOQUE','VERSION_DEPASSEE');
          stats.supplantees++;
          continue;
        }
        if (msg.type_projection!==plan.type || msg.identifiant_cible!==plan.key ||
          Number(msg.version_source)!==plan.version || msg.reference_source!==plan.reference ||
          msg.empreinte_projection!==plan.hash) throw new Error('FILE_INCOHERENTE');
        acad6Apply_(client,plan);
        acad6Ack_(outboxSheet,msg,'ACQUITTE','');
        stats.acquittees++;
      } catch(e) {
        const code=acad6SafeError_(e);
        try { acad6Ack_(outboxSheet,msg,'ERREUR',code); } catch(ignored) { /* retry possible */ }
        try { acad6Incident_(book,msg,code); } catch(ignored) { /* outbox is evidence */ }
        stats.erreurs++;
      }
    }
    return stats;
  } finally { lock.releaseLock(); }
}

function acad6RequireControl_(book,settings,props) {
  if (settings.ACADEMIE_SYNC_LOT6_AUTORISE!=='OUI' ||
      settings.SYNC_CLIENT_ACTIVE!=='OUI' || settings.OPERATIONS_ACTIVES!=='OUI' ||
      settings.ACADEMIE_OPERATIONS_ACTIVES!=='OUI' ||
      settings.ACADEMIE_SYNC_PRESENCES_CLIENT!=='OUI') throw new Error('SYNC_ACADEMIE_DESACTIVEE');
  if (settings.APP_MODE==='TEST') {
    if (props.getProperty('CONTROL_USE_TEST_SHEET')!=='OUI' ||
      !/^BOXY_CONTROL_TEST(?:\b|_|\s)/.test(book.getName()))
      throw new Error('COPIE_CONTROL_TEST_OBLIGATOIRE');
  } else if (settings.APP_MODE==='PRODUCTION') {
    if (props.getProperty('CONTROL_USE_TEST_SHEET')==='OUI' ||
       settings.ACADEMIE_SYNC_PRODUCTION_APPROUVEE!=='OUI' ||
       settings.ACADEMIE_ACOMPTE_AVANT_CONFIRMATION_ARBITRE!=='OUI' ||
       settings['ACADEMIE_CLIENT_CATALOGUE_VALID\u00c9']!=='OUI' ||
       props.getProperty('ACADEMIE_PROD_SYNC_CONFIRM')!=='AUTORISE_ACADEMIE6')
       throw new Error('SYNC_PRODUCTION_NON_APPROUVEE');
  } else throw new Error('MODE_PREPARATION');
}

function acad6RequireClient_(client,settings,props) {
  const config=control7Settings_(client);
  if(config.ACADEMIE_RECEPTION_CONTROL_ACTIVE!=='OUI')
    throw new Error('RECEPTION_CLIENT_DESACTIVEE');
  if(settings.APP_MODE==='TEST') {
    const id=String(props.getProperty('CLIENT_TEST_SHEET_ID')||'');
    if(!id || id===String(settings.CLIENT_SPREADSHEET_ID||'') ||
      !/^BOXY_CLIENT_TEST(?:\b|_|\s)/.test(client.getName()))
      throw new Error('COPIE_CLIENT_TEST_OBLIGATOIRE');
  } else if(settings.APP_MODE==='PRODUCTION' &&
    (!/^BOXY_CLIENT\b/.test(client.getName()) ||
      props.getProperty('ACADEMIE_PROD_SYNC_CONFIRM')!=='AUTORISE_ACADEMIE6'))
    throw new Error('SYNC_PRODUCTION_NON_APPROUVEE');
  acad6Sheet_(client,'INSCRIPTIONS',
    ['inscription_id','code_public','cree_le_utc','code_prestation']);
  acad6Sheet_(client,'SUIVI_PARTICIPANTS_ACADEMIE',ACA6_PARTICIPANTS_);
  acad6Sheet_(client,'ETAT_SESSIONS_ACADEMIE',ACA6_SESSIONS_);
}

function acad6Sheet_(book,name,headers) {
  const sh=book.getSheetByName(name);
  if(!sh || sh.getMaxColumns() < headers.length) throw new Error('SCHEMA_'+name+'_ABSENT');
  const h=sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
  if(headers.some((v,i)=>v!==h[i])) throw new Error('SCHEMA_'+name+'_INCOMPATIBLE');
  return sh;
}
function acad6Read_(book,name,headers,maxRows) {
  const sh=acad6Sheet_(book,name,headers);
  const n=sh.getLastRow()-1;
  if(n<1)return [];
  if(n>(maxRows||20000)) throw new Error('VOLUME_AUDIT_REQUIS');
  return sh.getRange(2,1,n,headers.length).getDisplayValues()
    .map((v,i)=>Object.assign(Object.fromEntries(headers.map((h,j)=>[h,String(v[j]||'')])),{_row:i+2}))
    .filter(x=>x[headers[0]]);
}
function acad6Hash_(payload) {
  const text=JSON.stringify(payload);
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8);
  return bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function acad6Int_(x,min,max) {
  const n=Number(x);
  if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error('VERSION_INVALIDE');
  return n;
}
function acad6Origin_(client) {
  const sh=acad6Sheet_(client,'INSCRIPTIONS',
    ['inscription_id','code_public','cree_le_utc','code_prestation']);
  const rows=sh.getLastRow()-1;
  if(rows>25000)throw new Error('VOLUME_CLIENT_A_AUDITER');
  const map=new Map();
  if(!rows)return map;
  const data=sh.getRange(2,1,rows,12).getDisplayValues();
  for(const r of data){
    if(!r[0])continue;
    if(map.has(r[0]))throw new Error('DOUBLON_INSCRIPTION_CLIENT');
    map.set(r[0],{code:r[1],type:String(r[3]).toUpperCase(),statut:r[11]});
  }
  return map;
}
function acad6Seances_(client) {
  const rows=academyReadTable_(client,'SEANCES_ACADEMIE',
   ['code_session','numero_seance','date_seance','heure_debut','heure_fin',
    'activite','lieu_seance','statut_seance','validation','actif'],3000);
  const bySession=new Map(),keys=new Set();
  for(const row of rows){
    if(row.actif!=='OUI'||row.validation!=='VALIDEE')continue;
    const code=String(row.code_session||'').toUpperCase(),num=acad6Int_(row.numero_seance,1,1000);
    const key=code+'|'+num;
    if(keys.has(key))throw new Error('DOUBLON_SEANCE');
    keys.add(key);
    if(!bySession.has(code))bySession.set(code,[]);
    bySession.get(code).push(num);
  }
  return bySession;
}
function acad6Latest_(decisions,presences,id) {
  const all=decisions.concat(presences).filter(e=>e.inscription_id===id);
  if(!all.length)throw new Error('JOURNAL_VIDE');
  all.sort((a,b)=>a.cree_utc.localeCompare(b.cree_utc)||a.evenement_id.localeCompare(b.evenement_id));
  return all[all.length-1];
}
function acad6Plan_(type,key,version,reference,updated,values) {
  const stableValues=values.map((v,i)=>type==='CAPACITE' && i===6?'':String(v));
  const hash=acad6Hash_({type,key,version,reference,values:stableValues});
  return {type,key,version,reference,updated,values,hash,
    id:'ACA6-'+type+'-'+key+'-'+String(version)};
}
function acad6BuildPlans_(book,client,settings) {
  const decisionEvents=academyLot3ReadEvents_(book);
  const presenceEvents=academyLot4ReadEvents_(book);
  const decisions=academyLot3Snapshot_(decisionEvents),
    presences=academyLot4Snapshot_(presenceEvents);
  const origins=acad6Origin_(client);
  const sessions=academyLot3Sessions_(client);
  const seances=acad6Seances_(client);
  const generation=acad6Int_(settings.ACADEMIE_SYNC_GENERATION||1,1,2000);
  const counts=new Map(),wait=new Map(),versions=new Map(),latestSession=new Map();
  for(const e of decisionEvents){
    const codes=new Set([e.code_session_source,e.code_session_cible].filter(Boolean));
    for(const code of codes){
      versions.set(code,(versions.get(code)||0)+1);
      if(!latestSession.has(code) || latestSession.get(code).cree_utc<=e.cree_utc)
        latestSession.set(code,e);
    }
  }
  for(const state of Object.values(decisions)){
    const origin=origins.get(state.id);
    if(!origin || origin.type!=='FORMATION' || origin.code!==state.code ||
       (origin.statut==='ANNULEE' && state.statut!=='ANNULEE'))
       throw new Error('INSCRIPTION_INCOHERENTE');
    const session=sessions[state.session];
    if(!session || session.formation!==state.formation)throw new Error('SESSION_INCOHERENTE');
    if(state.statut==='CONFIRMEE')counts.set(state.session,(counts.get(state.session)||0)+1);
    else if(state.statut==='LISTE_ATTENTE')wait.set(state.session,(wait.get(state.session)||0)+1);
  }
  for(const e of presenceEvents){
    const origin=origins.get(e.inscription_id),current=decisions[e.inscription_id];
    if(!origin || !current || origin.code!==e.code_public ||
       current.code!==e.code_public)throw new Error('PRESENCE_ORPHELINE');
  }
  const plans=[];
  for(const state of Object.values(decisions)){
    const sess=state.session;
    const nums=seances.get(sess)||[];
    let present=0,recorded=0;
    if(state.statut==='CONFIRMEE')for(const n of nums){
      const entry=presences[academyLot4Key_(state.id,sess,n)];
      if(!entry)continue;
      recorded++;
      if(['PRESENT','RETARD'].includes(entry.statut))present++;
    }
    const isConfirmed=state.statut==='CONFIRMEE';
    const total=isConfirmed?nums.length:0;
    const progress=!isConfirmed||!recorded?'NON_COMMENCEE':recorded===total?'TERMINEE':'EN_COURS';
    const count=decisionEvents.filter(e=>e.inscription_id===state.id).length +
      presenceEvents.filter(e=>e.inscription_id===state.id).length;
    const version=generation*1000000+acad6Int_(count,1,999999);
    const last=acad6Latest_(decisionEvents,presenceEvents,state.id);
    plans.push(acad6Plan_('PARTICIPANT',state.id,version,last.evenement_id,last.cree_utc,
      [state.id,isConfirmed?sess:'',state.statut,progress,total,present,
       last.cree_utc,String(version),last.evenement_id,'VALIDE']));
  }
  for(const [code,count] of versions){
    if(!sessions[code])throw new Error('SESSION_INCONNUE');
    const cap=Number(sessions[code].capacite),used=counts.get(code)||0,
      pending=wait.get(code)||0;
    if(used>cap || (pending>0 && (!sessions[code].attenteAutorisee ||
       pending>sessions[code].limiteAttente))) throw new Error('CAPACITE_INCOHERENTE');
    const event=latestSession.get(code),version=generation*1000000+acad6Int_(count,1,999999);
    plans.push(acad6Plan_('CAPACITE',code,version,event.evenement_id,event.cree_utc,
      [code,used,pending,'VALIDE',String(version),event.cree_utc,
       new Date().toISOString(),event.evenement_id]));
  }
  return plans.sort((a,b)=>a.type.localeCompare(b.type)||a.key.localeCompare(b.key));
}

function acad6Enqueue_(sheet,plans) {
  const existing=acad6Read_({getSheetByName:()=>sheet},'SYNC_ACADEMIE_CLIENT',ACA6_OUTBOX_,15000);
  const byId=new Map();
  for(const old of existing){
    if(byId.has(old.evenement_sync_id))throw new Error('DOUBLON_FILE');
    byId.set(old.evenement_sync_id,old);
  }
  for(const p of plans){
    const old=byId.get(p.id);
    if(old){
      if(old.empreinte_projection!==p.hash || old.reference_source!==p.reference)
        throw new Error('PROJECTION_MODIFIEE_SANS_GENERATION');
      continue;
    }
    sheet.appendRow([p.id,p.type,p.key,String(p.version),p.reference,'A_ENVOYER',
      new Date().toISOString(),'','',0,'',p.hash]);
  }
}
function acad6FindUnique_(sheet,head,key) {
  const n=sheet.getLastRow()-1;
  if(n<=0)return {row:0,data:[]};
  const rows=sheet.getRange(2,1,n,head.length).getDisplayValues();
  let found=null;
  rows.forEach((r,i)=>{if(r[0]===key){if(found)throw new Error('DOUBLON_PROJECTION');found={row:i+2,data:r};}});
  return found||{row:0,data:[]};
}
function acad6Apply_(client,plan) {
  const isParticipant=plan.type==='PARTICIPANT';
  if(!isParticipant&&plan.type!=='CAPACITE')throw new Error('TYPE_INVALIDE');
  const head=isParticipant?ACA6_PARTICIPANTS_:ACA6_SESSIONS_;
  const sh=acad6Sheet_(client,isParticipant?'SUIVI_PARTICIPANTS_ACADEMIE':'ETAT_SESSIONS_ACADEMIE',head);
  const existing=acad6FindUnique_(sh,head,plan.key);
  const prev=existing.data;
  const indexVersion=isParticipant?7:4,indexRef=isParticipant?8:7;
  const verdict=control7VersionDecision_(prev[indexVersion]||'',prev[indexRef]||'',
    {version:plan.version,evenement_id:plan.reference});
  if(verdict==='IGNORE_ANCIEN')throw new Error('RECEPTEUR_PLUS_RECENT');
  if(verdict==='DEJA_APPLIQUE'){
    const mismatch=plan.values.some((v,i)=>!(plan.type==='CAPACITE' && i===6) && String(v)!==String(prev[i]||''));
    if(mismatch)throw new Error('PROJECTION_DIVERGENTE');
  }
  if(verdict==='ECRIRE'){
    if(existing.row)sh.getRange(existing.row,1,1,head.length).setValues([plan.values]);
    else sh.appendRow(plan.values);
    SpreadsheetApp.flush();
  }
  return verdict;
}
function acad6Ack_(sh,msg,status,error){
  const now=new Date().toISOString();
  const attempts=acad6Int_(Number(msg.nb_essais||0)+1,1,100);
  sh.getRange(msg._row,1,1,ACA6_OUTBOX_.length).setValues([[
    msg.evenement_sync_id,msg.type_projection,msg.identifiant_cible,msg.version_source,
    msg.reference_source,status,msg.cree_utc,now,status==='ACQUITTE'?now:'',
    attempts,error||'',msg.empreinte_projection
  ]]);
  SpreadsheetApp.flush();
}
function acad6SafeError_(error){
  const raw=String(error&&error.message||'ERREUR_SYNC');
  return /^[A-Z0-9_]{3,60}$/.test(raw)?raw:'ERREUR_SYNC';
}
function acad6Incident_(book,msg,code){
  const sh=acad6Sheet_(book,'INCIDENTS_SYNC_ACADEMIE',ACA6_INCIDENTS_);
  const now=new Date().toISOString();
  sh.appendRow(['INC-ACA-'+Utilities.getUuid(),msg.evenement_sync_id,msg.type_projection,
    code,'ERREUR',Number(msg.nb_essais||0)+1,now,now,'OUVERT',
    'Aucune donnee personnelle ou secret dans le journal']);
}

/** Read-only, editor-only. Does not unlock nor send anything. */
function diagnosticIntegrationAcademieLot6_() {
  const book=controlWorkbook_(),s=readControlSettings_(book);
  const events=acad6Read_(book,'SYNC_ACADEMIE_CLIENT',ACA6_OUTBOX_,15000);
  return {release:ACA6_VERSION_,mode:s.APP_MODE,syncActive:s.ACADEMIE_SYNC_LOT6_AUTORISE==='OUI'&&
    s.SYNC_CLIENT_ACTIVE==='OUI',financeActive:s.PAIEMENTS_ACTIFS==='OUI',
    adminReady:false,all:events.length,pending:events.filter(e=>e.statut!=='ACQUITTE').length,
    businessDecisionPending:s.ACADEMIE_ACOMPTE_AVANT_CONFIRMATION_ARBITRE!=='OUI'};
}
/** No real ADMIN destination exists in the project yet. */
function synchroniserAcademieAdminLot6_(){throw new Error('BOXY_ADMIN_NON_CONNECTE');}
