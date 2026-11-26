function BXCT_ACA_OPERATIONAL_TESTS(){
 const tests=[],test=(name,f)=>{try{tests.push({name,ok:f()===true});}catch(e){tests.push({name,ok:false});}},reject=f=>{try{f();return false;}catch(e){return true;}};
 const session={code:'SES-TEST',formation:'CREATION_CONTENU',capacite:1,attenteAutorisee:false,limiteAttente:0,valid:true,statut:'OUVERTE',validation:'VALIDEE'},sessions={'SES-TEST':session};
 const dossier={inscriptionId:'I-1',code:'BX.FOR.01',formationCode:'CREATION_CONTENU',codeSession:'',sansSessionSource:true,affectationEnAttente:true,formationDansCatalogue:true};
 const req={action:'CONFIRMER',sessionCible:'SES-TEST'};
 test('AFFECTATION_INITIALE',()=>academyLot3Plan_(req,dossier,null,{},sessions).session==='SES-TEST');
 test('SESSION_COMPLETE',()=>reject(()=>academyLot3Plan_(req,dossier,null,{'I-2':{session:'SES-TEST',statut:'CONFIRMEE'}},sessions)));
 test('FORMATION_DIFFERENTE',()=>reject(()=>academyLot3Plan_(req,{...dossier,formationCode:'AUTRE'},null,{},sessions)));
 test('SESSION_NON_VALIDEE',()=>reject(()=>academyLot3Plan_(req,dossier,null,{}, {'SES-TEST':{...session,valid:false}})));
 test('ANCIENNE_AFFECTATION_PROTEGEE',()=>reject(()=>academyLot3Plan_(req,{...dossier,sansSessionSource:false},null,{},sessions)));
 test('TRANSFERT_EXISTANT_PROTEGE',()=>reject(()=>academyLot3Plan_(req,{...dossier,codeSession:'SES-OTHER'},null,{},sessions)));
 test('ANNULATION_NON_AFFECTEE_PROTEGEE',()=>reject(()=>academyLot3Plan_({action:'ANNULER'},dossier,null,{},sessions)));
 test('LISTE_ATTENTE_NON_AUTORISEE',()=>reject(()=>academyLot3Plan_({action:'LISTE_ATTENTE',sessionCible:'SES-TEST'},dossier,null,{},sessions)));
 test('STATUT_ACTIF',()=>BXCT_ACA_SESSION_group_('EN_COURS')==='actives');
 test('STATUT_ARCHIVE',()=>['TERMINEE','ANNULEE','ARCHIVEE'].every(x=>BXCT_ACA_SESSION_group_(x)==='archives'));
 test('STATUT_PLANIFIE',()=>['BROUILLON','ANNONCEE','OUVERTE'].every(x=>BXCT_ACA_SESSION_group_(x)==='avenir'));
 const out={ok:tests.every(x=>x.ok),version:'7.0.14-rc2',total:tests.length,reussis:tests.filter(x=>x.ok).length,echecs:tests.filter(x=>!x.ok).map(x=>x.name)};console.log(JSON.stringify(out));return out;
}
