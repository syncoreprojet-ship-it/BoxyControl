/** No I/O, synthetic tests of new policies and projections. */
function BXCT_ACA_FINAL_TESTS(){
 const tests=[],test=(n,f)=>{try{tests.push({n,ok:f()===true});}catch(e){tests.push({n,ok:false});}},reject=f=>{try{f();return false;}catch(e){return true;}};
 const code='SES-TEST',d={id:'I1',code:'BX.FOR.01',session:code,statut:'CONFIRMEE'},rows=[['I1','BX.FOR.01','RECU']],decisions={I1:d},seances=[{numero:1,date:'2027-01-05',validee:true}],presence={'I1|SES-TEST|1':{code:d.code,date:'2027-01-05',statut:'PRESENT'}};
 const check=(action,req=rows,ds=decisions,ss=seances,pr=presence)=>{BXCT_ACA_LIFECYCLE_check_(req,ds,code,action,ss,pr);return true;};
 test('FERMETURE_DEMANDES_TRAITEES',()=>check('FERMER'));
 test('FERMETURE_DEMANDE_PENDING',()=>reject(()=>check('FERMER',[...rows,['I2','BX.FOR.02','RECU']])));
 test('FERMETURE_ATTENTE_NON_VIDEE',()=>reject(()=>check('FERMER',[],{I1:{...d,statut:'LISTE_ATTENTE'}})));
 test('ANNULATION_SOURCE_INCOHERENTE',()=>reject(()=>check('FERMER',[['I1','BX.FOR.01','ANNULEE']])));
 test('DEMANDE_AUTRE_SESSION_IGNORE',()=>check('FERMER',[...rows,['I2','BX.FOR.02','RECU','AUTRE']]));
 test('CONFIRME_SOURCE_ABSENTE',()=>reject(()=>check('FERMER',[],decisions)));
 test('DEMARRAGE_CONFIRME_ET_SEANCE',()=>check('DEMARRER'));
 test('DEMARRAGE_SANS_SEANCE',()=>reject(()=>check('DEMARRER',rows,decisions,[])));
 test('DEMARRAGE_SANS_APPRENANT',()=>reject(()=>check('DEMARRER',[],{})));
 test('FIN_BILAN_COMPLET',()=>check('TERMINER'));
 test('FIN_POINTAGE_ABSENT',()=>reject(()=>check('TERMINER',rows,decisions,seances,{})));
 test('FIN_POINTAGE_DATE_INCOHERENTE',()=>reject(()=>check('TERMINER',rows,decisions,seances,{'I1|SES-TEST|1':{...presence['I1|SES-TEST|1'],date:'2027-01-06'}})));
 const s={statut_session:'TERMINEE',validation_session:'VALIDEE',date_fin:'2027-01-06'},p={prevues:2,renseignees:2,presences:1,retards:0,absences:1};
 test('ATTESTATION_BILAN_FACTUEL',()=>BXCT_ACA_ATTESTATION_eligible_(s,p,'2027-01-07'));
 test('ATTESTATION_SESSION_ACTIVE',()=>!BXCT_ACA_ATTESTATION_eligible_({...s,statut_session:'EN_COURS'},p,'2027-01-07'));
 test('ATTESTATION_BILAN_INCOMPLET',()=>!BXCT_ACA_ATTESTATION_eligible_(s,{...p,renseignees:1},'2027-01-07'));
 test('ATTESTATION_DATE_NON_PASSEE',()=>!BXCT_ACA_ATTESTATION_eligible_(s,p,'2027-01-06'));
 test('ATTESTATION_SANS_SEANCE',()=>!BXCT_ACA_ATTESTATION_eligible_(s,{prevues:0,renseignees:0},'2027-01-07'));
 test('ATTESTATION_SNAPSHOT_STABLE',()=>JSON.stringify(BXCT_ACA_ATTESTATION_snapshot_({code:'BX.FOR.01',date:'A'}))===JSON.stringify(BXCT_ACA_ATTESTATION_snapshot_({code:'BX.FOR.01',date:'B'})));
 const row=['A','SES-TEST','AGENT-1','FORMATEUR','OUI','VALIDEE'];
 test('FORMATEUR_EXISTANT',()=>BXCT_ACA_FORMATEUR_current_([row],code)[2]==='AGENT-1');
 test('FORMATEUR_DOUBLON',()=>reject(()=>BXCT_ACA_FORMATEUR_current_([row,row],code)));
 test('FORMATEUR_INACTIF_IGNORE',()=>BXCT_ACA_FORMATEUR_current_([row.map((x,i)=>i===4?'NON':x)],code)===null);
 test('FORMATEUR_NON_VALIDE_REFUSE',()=>reject(()=>BXCT_ACA_FORMATEUR_current_([row.map((x,i)=>i===5?'A_VALIDER':x)],code)));
 const a={code,formation:'F',statut:'EN_COURS',confirmesControl:2,aTraiter:1,attenteControl:0},b={...a,code:'SES-TEST2',statut:'TERMINEE',confirmesControl:4};
 test('PILOTAGE_GROUPES',()=>{const q=BXCT_ACA_PILOTAGE_metrics_({[code]:a,[b.code]:b},{sessions:[a,b],totaux:{confirmees:6}});return q.sessions.actives===1&&q.sessions.archives===1&&q.formations[0].confirmes===6&&q.dossiers.confirmees===6;});
 test('PILOTAGE_SOURCE_INCOHERENTE',()=>reject(()=>BXCT_ACA_PILOTAGE_metrics_({}, {sessions:[a],totaux:{}})));
 test('ARCHIVE_DECISION_PROTEGEE',()=>reject(()=>academyLot3Plan_({action:'ANNULER'},{codeSession:code},d,decisions,{[code]:{statut:'TERMINEE'}})));
 test('VERROU_FINANCIER_PRESERVE',()=>BXCT_ENC_ACADEMY_WRITE_ACTIVE_===false);
 const o={ok:tests.every(t=>t.ok),version:'7.0.14-rc3',total:tests.length,reussis:tests.filter(t=>t.ok).length,echecs:tests.filter(t=>!t.ok).map(t=>t.n)};console.log(JSON.stringify(o));return o;
}
