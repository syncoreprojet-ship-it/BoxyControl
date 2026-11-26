/** No I/O: synthetic events, existing projection, no financial writes. */
function BXCT_ENC_ACADEMY_DESK_TESTS(){
 const tests=[];function test(name,fn){try{tests.push({name,ok:fn()===true});}catch(e){tests.push({name,ok:false});}}function rejects(fn){try{fn();return false;}catch(e){return true;}}
 const ctx={rights:['CONSULTER_FINANCES_ACADEMIE'],settings:{ACADEMIE_FINANCES_LECTURE_ACTIVE:'OUI',ACADEMIE_DEVIS_OFFICIELS_VALIDES:'OUI'}};
 const event=(id,domain,code,amount)=>({evenement_id:id,transaction_id:(domain==='FORMATION'?'ACA-TXN-':'TXN-')+id.padStart(8,'0'),inscription_id:id,code_public:code,action:'ENREGISTRER',type_mouvement:'ENCAISSEMENT',methode:'ESPECES',montant_fcfa:amount,statut_apres:'EN_ATTENTE',version:1,cree_utc:'2026-01-01',devis_client_fcfa:20000,code_prestation:domain,reference_devis:'DEV',code_formation:'FOR',code_session:'SES'});
 const a=event('1','FORMATION','BX.FOR.01',6000),p=event('2','PHOTO','BX.PHO.01',5000),b=event('3','FORMATION','BX.FOR.03',2000),valid={...a,evenement_id:'4',action:'VALIDER',statut_apres:'VALIDE',version:2};
 const q=[{inscriptionId:'5',code:'BX.FOR.05',total:20000,ref:'DEV',formation:'FOR',session:'SES'}];
 const sum=input=>BXCT_ENC_SERVICE_summary_([a,valid,p,b],BXCT_ENC_ACADEMY_DESK_filter_(input),q);
 test('DROIT_ACADEMIE_SEUL',()=>{BXCT_ENC_ACADEMY_DESK_permission_(ctx);return true;});
 test('DROIT_ABSENT',()=>rejects(()=>BXCT_ENC_ACADEMY_DESK_permission_({...ctx,rights:['CONSULTER_PAIEMENTS']})));
 test('VERROU_LECTURE',()=>rejects(()=>BXCT_ENC_ACADEMY_DESK_permission_({...ctx,settings:{...ctx.settings,ACADEMIE_FINANCES_LECTURE_ACTIVE:'NON'}})));
 test('VERROU_DEVIS',()=>rejects(()=>BXCT_ENC_ACADEMY_DESK_permission_({...ctx,settings:{...ctx.settings,ACADEMIE_DEVIS_OFFICIELS_VALIDES:'NON'}})));
 test('PHOTO_REFUSE',()=>rejects(()=>BXCT_ENC_ACADEMY_DESK_filter_({prestation:'PHOTO'})));
 test('CODE_PHOTO_REFUSE',()=>rejects(()=>BXCT_ENC_ACADEMY_DESK_filter_({code:'BX.PHO.01'})));
 test('PAGE_INVALIDE',()=>rejects(()=>BXCT_ENC_ACADEMY_DESK_filter_({page:-1})));
 test('HISTORIQUE_ISOLE',()=>sum({}).lignes.length===2&&sum({}).lignes.every(t=>t.prestation==='FORMATION'));
 test('ATTENTE',()=>sum({view:'ATTENTE'}).lignes.length===1&&sum({view:'ATTENTE'}).lignes[0].code==='BX.FOR.03');
 test('VALIDES',()=>sum({view:'RECUS'}).lignes.length===1&&sum({view:'RECUS'}).lignes[0].code==='BX.FOR.01');
 test('SOLDES_SANS_VERSEMENT',()=>sum({view:'SOLDES'}).lignes.length===3&&sum({view:'SOLDES'}).lignes.find(t=>t.code==='BX.FOR.05').soldeFcfa===20000);
 test('FILTRE_CODE',()=>sum({code:'BX.FOR.01'}).lignes.length===1&&sum({code:'BX.FOR.01'}).totaux.netFcfa===6000);
 test('TOTAL_IDENTIQUE',()=>JSON.stringify(sum({}).totaux)===JSON.stringify(BXCT_ENC_SERVICE_summary_([a,valid,p,b],{prestation:'FORMATION',page:0},q).totaux));
 test('PAGINATION',()=>sum({page:1}).lignes.length===0);
 test('ECRITURE_DESACTIVEE',()=>sum({}).ecritureActive===false&&BXCT_ENC_ACADEMY_WRITE_ACTIVE_===false);
 const result={ok:tests.every(t=>t.ok),version:'7.0.13-rc3',total:tests.length,reussis:tests.filter(t=>t.ok).length,echecs:tests.filter(t=>!t.ok).map(t=>t.name)};console.log(JSON.stringify(result));return result;
}
