/** v7.0.14-rc3. Attestation de présence : aperçu nominatif NON OFFICIEL, aucune émission.
 * Sources CLIENT (dossier/séances) et journaux CONTROL (décisions/présences).
 * No certificate is issued automatically or marked as a diploma. */
function BXCT_ACA_ATTESTATION_eligible_(session,progress,today){
 return Boolean(session&&['TERMINEE','TERMINE','ARCHIVEE'].includes(session.statut_session)&&session.validation_session==='VALIDEE'&&/^\d{4}-\d{2}-\d{2}$/.test(session.date_fin)&&session.date_fin<today&&progress.prevues>0&&progress.renseignees===progress.prevues);
}
function BXCT_ACA_ATTESTATION_preview_(ctx,rawCode){
 const code=academyLot2NormaliserCode_(rawCode);if(!code)throw new Error('CODE_INVALIDE');
 const source=BXCT_CORE_DATA_clientSource_(ctx.settings),dossier=academyLot3DossierClient_(source,code);
 const state=academyLot3Snapshot_(academyLot3ReadEvents_(ctx.book))[dossier.inscriptionId];
 if(!state||state.statut!=='CONFIRMEE'||state.code!==dossier.code||state.formation!==dossier.formationCode||dossier.statutDemande==='ANNULEE')throw new Error('DOSSIER_NON_CONFIRME');
 const list=BXCT_CORE_DATA_readTable_(source,'SESSIONS_ACADEMIE',['code_session','code_formation','titre_session','date_debut','date_fin','statut_session','validation_session'],500);
 const matching=list.filter(s=>s.code_session===state.session&&s.code_formation===state.formation);if(matching.length!==1)throw new Error('SESSION_INCOHERENTE');
 const s=matching[0],seances=academyLot4Seances_(source,state.session),snapshot=academyLot4Snapshot_(academyLot4ReadEvents_(ctx.book));
 for(const seance of seances.filter(x=>x.validee)){const entry=snapshot[academyLot4Key_(dossier.inscriptionId,state.session,seance.numero)];if(entry&&(entry.code!==dossier.code||entry.date!==seance.date))throw new Error('PRESENCE_INCOHERENTE');}
 const progress=academyLot4Progress_(dossier,state.session,seances,snapshot),today=Utilities.formatDate(new Date(),'Africa/Bamako','yyyy-MM-dd');
 if(!BXCT_ACA_ATTESTATION_eligible_(s,progress,today))throw new Error('BILAN_NON_FINALISE');
 if(!dossier.nomClient||!s.titre_session||!/^\d{4}-\d{2}-\d{2}$/.test(s.date_debut)||s.date_debut>s.date_fin)throw new Error('DOSSIER_INCOHERENT');
 // The attestation reflects actual attendance, never asserts passing or payment.
 academyLookupAudit_(ctx.book,ctx.agent.agentId,dossier.inscriptionId,'APERCU_ATTESTATION',code);
 return {nom:dossier.nomClient,code:dossier.code,formation:s.titre_session,session:s.code_session,debut:s.date_debut,fin:s.date_fin,progression:progress,statut:'BROUILLON_NON_OFFICIEL',date:new Date().toISOString()};
}
function BXCT_ACA_ATTESTATION_APERCU(token,input){
 try{const ctx=BXCT_ACA_PILOTAGE_context_(token);academyLookupLimit_(ctx.agent,ctx.settings);
  const data=BXCT_ACA_ATTESTATION_preview_(ctx,input?.code);return {ok:true,code:'APERCU_OK',message:'Brouillon non officiel. Aucun certificat émis.',data:{...data,hash:photo6Hash_(BXCT_ACA_ATTESTATION_snapshot_(data)),canWrite:BXCT_ACA_ATTESTATION_canWrite_(ctx)}};
 }catch(e){return {ok:false,code:'APERCU_REFUSE',message:'Dossier non confirmé, session non terminée, bilan incomplet ou accès indisponible.',data:null};}
}
function BXCT_ACA_ATTESTATION_canWrite_(ctx){return ctx.settings.APP_MODE==='TEST'&&/^BOXY_CONTROL_TEST(?:\b|_|\s)/.test(ctx.book.getName())&&PropertiesService.getScriptProperties().getProperty('BXCT_ACA_ATTESTATION_TEST_ENABLED')==='OUI';}
function BXCT_ACA_ATTESTATION_snapshot_(preview){const {date,...snapshot}=preview;return snapshot;}
function BXCT_ACA_ATTESTATION_ENREGISTRER(token,input){
 try{const ctx=BXCT_ACA_PILOTAGE_context_(token);if(!BXCT_ACA_ATTESTATION_canWrite_(ctx)||!/^([a-f0-9]{64})$/.test(String(input?.hash||'')))throw new Error('ECRITURE_FERMEE');
  academyLookupLimit_(ctx.agent,ctx.settings);const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw new Error('SERVICE_OCCUPE');
  try{const data=BXCT_ACA_ATTESTATION_snapshot_(BXCT_ACA_ATTESTATION_preview_(ctx,input.code)),hash=photo6Hash_(data);
   if(hash!==input.hash)throw new Error('APERCU_PERIME');const table=BXCT_ACA_ATTESTATION_table_(ctx.book,false);if(!table)throw new Error('SETUP_REQUIS');
   const saved=BXCT_ACA_ATTESTATION_append_(table,ctx.agent.agentId,data,hash);return {ok:true,code:'BROUILLON_ENREGISTRE',message:'Brouillon TEST conservé, aucun certificat officiel émis.',data:saved};
  }finally{lock.releaseLock();}
 }catch(e){return {ok:false,code:'BROUILLON_NON_CONFIRME',message:'Brouillon non confirmé : actualisez le bilan ou réessayez la même demande. Vérifiez le setup TEST.',data:null};}
}
function BXCT_ACA_ATTESTATION_HISTORIQUE(token,input){
 try{const ctx=BXCT_ACA_PILOTAGE_context_(token);if(!BXCT_ACA_ATTESTATION_canWrite_(ctx))throw new Error('LECTURE_FERMEE');const code=academyLot2NormaliserCode_(input?.code);if(!code)throw new Error('CODE_INVALIDE');
  academyLookupLimit_(ctx.agent,ctx.settings);const table=BXCT_ACA_ATTESTATION_table_(ctx.book,false),rows=table?[...table.map.values()].filter(r=>r.data.code===code).reverse():[];
  const p=Number(input?.page||1);if(!Number.isInteger(p)||p<1||p>500)throw new Error('PAGE_INVALIDE');
  academyLookupAudit_(ctx.book,ctx.agent.agentId,'ATTESTATIONS_TEST','HISTORIQUE_ATTESTATIONS',code);
  return {ok:true,code:'HISTORIQUE_OK',message:'Versions TEST non officielles.',data:{items:rows.slice((p-1)*10,p*10).map(r=>({id:r.id,date:r.date,session:r.data.session,formation:r.data.formation,snapshot:r.data})),total:rows.length,page:p}};
 }catch(e){return {ok:false,code:'HISTORIQUE_INDISPONIBLE',message:'Historique TEST indisponible.',data:null};}
}
function BXCT_ACA_ATTESTATION_SETUP(){
 try{const ctx=BXCT_CORE_AUTH_proprietaire_();ctx.settings=readControlSettings_(ctx.book);if(!BXCT_ACA_ATTESTATION_canWrite_(ctx))throw new Error('TEST_REQUIS');
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw new Error('SERVICE_OCCUPE');try{const t=BXCT_ACA_ATTESTATION_table_(ctx.book,true);const out={ok:true,version:'7.0.14-rc3',schemaVersion:1,mode:'TEST',brouillons:t.map.size};console.log(JSON.stringify(out));return out;}finally{lock.releaseLock();}
 }catch(e){return {ok:false,code:'SETUP_TEST_REFUSE'};}
}
function BXCT_ACA_ATTESTATION_AUDIT(){
 try{const ctx=BXCT_CORE_AUTH_proprietaire_(),t=BXCT_ACA_ATTESTATION_table_(ctx.book,false);const out={ok:true,version:'7.0.14-rc3',schemaVersion:1,registrePresent:!!t,brouillons:t?t.map.size:0,emissionOfficielle:false};console.log(JSON.stringify(out));return out;}catch(e){return {ok:false,code:'REGISTRE_INCOHERENT'};}
}
