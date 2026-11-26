/** Deterministic no-I/O test suite. All records below are synthetic. */
function BXCT_ENC_TESTS_(){
  const results=[];
  function test(name,fn){try{if(fn()!==true)throw Error('ASSERT');results.push({test:name,ok:true});}catch(_){results.push({test:name,ok:false});}}
  function throws(fn){try{fn();return false;}catch(_){return true;}}
  let seq=0;
  function create(domain,id,amount,method,type,origin){
    const aca=domain==='FORMATION',tx=(aca?'ACA-TXN-':'TXN-')+String(++seq).padStart(8,'0');
    return {evenement_id:'FNE-TEST-'+seq,transaction_id:tx,inscription_id:id,code_public:'TEST-'+id,
      action:'ENREGISTRER',type_mouvement:type||'ENCAISSEMENT',methode:method,fournisseur:method==='MOBILE_MONEY'?'ORANGE_MONEY':'',reference_externe:method==='MOBILE_MONEY'?'REFTEST'+seq:'',
      montant_fcfa:amount,statut_avant:'',statut_apres:'EN_ATTENTE',transaction_origine_id:origin||'',agent_auteur_id:'AGENT-A',agent_verificateur_id:'',cle_idempotence:'TEST-KEY-'+seq,version:1,cree_utc:'2026-01-01T00:00:00Z',devis_client_fcfa:20000,code_prestation:aca?'FORMATION':'',code_formation:aca?'FOR-TEST':'',code_session:aca?'SES-TEST':'',reference_devis:aca?'DEV-TEST':'',numero_recu:''};
  }
  function decide(e,status){return {...e,evenement_id:e.evenement_id+'-D',action:status==='VALIDE'?'VALIDER':'REJETER',statut_avant:'EN_ATTENTE',statut_apres:status,agent_verificateur_id:'AGENT-B',cle_idempotence:e.cle_idempotence+'-D',version:2,jour_caisse:'2026-01-01',numero_recu:status==='VALIDE'?'REC-'+e.transaction_id:''};}
  const a=create('FORMATION','A',6000,'ESPECES'),b=create('FORMATION','A',4000,'MOBILE_MONEY'),r=create('FORMATION','A',1000,'ESPECES','REMBOURSEMENT',a.transaction_id),pr=create('FORMATION','A',500,'ESPECES','REMBOURSEMENT',a.transaction_id),p=create('FORMATION','A',2000,'ESPECES'),reject=create('FORMATION','A',3000,'ESPECES'),ph=create('PHOTO','P',5000,'ESPECES');
  const events=[a,decide(a,'VALIDE'),b,decide(b,'VALIDE'),r,decide(r,'VALIDE'),pr,p,reject,decide(reject,'REJETE'),ph,decide(ph,'VALIDE')];
  const quote=id=>({inscriptionId:id,code:'TEST-'+id,formation:'FOR-TEST',session:'SES-TEST',ref:'DEV-TEST',total:20000});
  const quotes=[quote('A'),quote('B')],sum=(ev,qs,domain,page)=>BXCT_ENC_SERVICE_summary_(ev,{prestation:domain||'TOUTES',page:page||0},qs);
  const state=()=>photo6States_(events),ledger=()=>({states:state(),byId:new Map(events.filter(e=>e.action==='ENREGISTRER'&&e.code_prestation==='FORMATION').map(e=>[e.transaction_id,{ref:e.reference_devis,formation:e.code_formation,session:e.code_session}]))});
  test('ACOMPTE_ET_MULTIPLES',()=>sum(events,quotes,'FORMATION').totaux.netFcfa===9000);
  test('SOLDE_GLOBAL',()=>sum(events,quotes).totaux.soldeFcfa===46000);
  test('DEVIS_SANS_MOUVEMENT',()=>sum(events,quotes,'FORMATION').totaux.dossiers===2&&BXCT_ENC_ACADEMY_balance_(ledger(),quote('B')).soldeFcfa===20000);
  test('ATTENTES_SEPAREES',()=>{const t=sum(events,quotes,'FORMATION').totaux;return t.versementsAttenteFcfa===2000&&t.remboursementsAttenteFcfa===500&&t.attenteFcfa===1500;});
  test('CONCORDANCE_DOSSIER',()=>{const t=sum(events,[quote('A')],'FORMATION').totaux,d=BXCT_ENC_ACADEMY_balance_(ledger(),quote('A'));return t.netFcfa===d.netEncaisseFcfa&&t.soldeFcfa===d.soldeFcfa&&t.versementsAttenteFcfa===d.totalEnAttenteFcfa&&t.remboursementsAttenteFcfa===d.remboursementsEnAttenteFcfa;});
  test('REJET_NON_COMPTABILISE',()=>sum(events,quotes).totaux.encaisseFcfa===15000);
  test('ESPECES_MOBILE',()=>{const t=sum(events,quotes).totaux;return t.especesNetFcfa===10000&&t.mobileNetFcfa===4000&&t.netFcfa===14000;});
  test('PHOTO_ISOLE',()=>photo6Desk_(state(),'2026-01-01','AGENT-A').especesTheoriquesFcfa===5000&&sum(events,quotes,'PHOTO').totaux.dossiers===1);
  test('PHOTO_DOSSIER_ISOLE',()=>photo6Summary_(state(),{inscriptionId:'A',devisFcfa:20000}).transactions.length===0);
  test('DOUBLON_EVENEMENT',()=>throws(()=>sum(events.concat(a),quotes)));
  test('DOUBLON_CLE',()=>BXCT_ENC_AUDIT_checks_(events.concat({...create('PHOTO','Q',100,'ESPECES'),cle_idempotence:a.cle_idempotence}),quotes).includes('IDENTIFIANT_OU_IDEMPOTENCE_INCOHERENT'));
  test('DOUBLE_CONTROLE',()=>BXCT_ENC_AUDIT_checks_(events.map(e=>e.evenement_id===a.evenement_id+'-D'?{...e,agent_verificateur_id:'AGENT-A'}:e),quotes).includes('DOUBLE_CONTROLE_ABSENT'));
  test('REMBOURSEMENT_EXCESSIF',()=>BXCT_ENC_AUDIT_checks_(events.concat(create('FORMATION','A',6000,'ESPECES','REMBOURSEMENT',a.transaction_id)),quotes).includes('REMBOURSEMENT_EXCESSIF'));
  test('DEVIS_INCOMPATIBLE',()=>throws(()=>sum(events,[{...quote('A'),total:9999}])));
  test('DEVIS_DUPLIQUE',()=>throws(()=>sum(events,[quote('A'),quote('A')])));
  test('AUDIT_COHERENT',()=>BXCT_ENC_AUDIT_checks_(events,quotes).length===0);
  test('PAGINATION',()=>{const more=Array.from({length:55},(_,i)=>create('PHOTO','P'+i,100,'ESPECES'));return sum(more,[],'PHOTO',0).historique.length===50&&sum(more,[],'PHOTO',1).historique.length===5;});
  test('FILTRE_INVALIDE',()=>throws(()=>BXCT_ENC_VALIDATION_filter_({prestation:'ADMIN',page:0}))&&throws(()=>BXCT_ENC_VALIDATION_filter_({page:-1})));
  test('PERMISSION_REFUSEE',()=>throws(()=>BXCT_ENC_PERMISSIONS_read_({agent:{role:'AGENT'},rights:[],settings:{}})));
  test('PERMISSION_SUPERVISION',()=>{BXCT_ENC_PERMISSIONS_read_({agent:{role:'SUPERVISEUR'},rights:['CONSULTER_PAIEMENTS','CONSULTER_FINANCES_ACADEMIE'],settings:{PAIEMENTS_ACTIFS:'OUI',ACADEMIE_FINANCES_LECTURE_ACTIVE:'OUI',ACADEMIE_DEVIS_OFFICIELS_VALIDES:'OUI'}});return true;});
  test('VERROU_ACADEMIE',()=>BXCT_ENC_ACADEMY_WRITE_ACTIVE_===false);
  test('VERROU_SERVICE_ACADEMIE',()=>throws(()=>BXCT_ENC_SERVICE_append_(null,a,true)));
  test('SERVICE_REFUSE_MAUVAIS_DOMAINE',()=>throws(()=>BXCT_ENC_SERVICE_append_(null,a,false)));
  test('PAIEMENT_INTEGRAL',()=>{const full=create('FORMATION','C',20000,'ESPECES');const d=sum([full,decide(full,'VALIDE')],[quote('C')],'FORMATION').totaux;return d.netFcfa===20000&&d.soldeFcfa===0;});
  test('REFERENCE_MM_DUPLIQUEE',()=>BXCT_ENC_AUDIT_checks_(events.concat({...create('PHOTO','Q',100,'MOBILE_MONEY'),reference_externe:b.reference_externe}),quotes).includes('REFERENCE_MM_INCOHERENTE'));
  test('SOLDE_HORS_LIMITES',()=>{const extra=create('FORMATION','A',20000,'ESPECES');return BXCT_ENC_AUDIT_checks_(events.concat(extra,decide(extra,'VALIDE')),quotes).includes('SOLDE_HORS_LIMITES');});
  const failed=results.filter(r=>!r.ok).map(r=>r.test);
  return {ok:failed.length===0,version:BXCT_ENC_VERSION_,total:results.length,reussis:results.length-failed.length,echecs:failed,ecritureActive:false};
}
function BXCT_ENC_TESTS(){const r=BXCT_ENC_TESTS_();console.log(JSON.stringify(r));return r;}
