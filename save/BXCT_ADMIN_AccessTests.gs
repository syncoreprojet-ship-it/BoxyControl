/** Tests sans I/O et sans modification des classeurs. */
function BXCT_ADMIN_ACCESS_TESTS(){
 const results=[];const test=(name,f)=>{try{results.push({name,ok:f()===true});}catch(e){results.push({name,ok:false});}};
 const denied=f=>{try{f();return false;}catch(e){return true;}};
 const rows=[['role','autorisation','description','active'],['ADMIN_CONTROL','CONSULTER_FINANCES_ACADEMIE','','NON'],['CAISSIER','CONSULTER_PAIEMENTS','','OUI'],['CAISSIER','ENREGISTRER_PAIEMENT_ACADEMIE','','NON'],['SUPERVISEUR','CONSULTER_PAIEMENTS','','NON']];
 const book={getSheetByName:n=>n==='ROLES'?{getDataRange:()=>({getDisplayValues:()=>rows})}:null};
 const ctx={agent:{role:'ADMIN_CONTROL'},rights:loadRolePermissions_(book,'ADMIN_CONTROL'),settings:{ACADEMIE_FINANCES_LECTURE_ACTIVE:'NON',ACADEMIE_DEVIS_OFFICIELS_VALIDES:'NON',PAIEMENTS_ACTIFS:'NON'}};
 test('ADMIN_DROITS_DECLARÉS',()=>ctx.rights.length===3);
 test('CAISSIER_INCHANGE',()=>JSON.stringify(loadRolePermissions_(book,'CAISSIER'))==='["CONSULTER_PAIEMENTS"]');
 test('SUPERVISEUR_INCHANGE',()=>loadRolePermissions_(book,'SUPERVISEUR').length===0);
 test('ROLE_INCONNU',()=>loadRolePermissions_(book,'INCONNU').length===0);
 test('ADMIN_ACADEMIE',()=>{BXCT_ENC_ACADEMY_DESK_permission_(ctx);return true;});
 test('ADMIN_GENERAL',()=>{BXCT_ENC_PERMISSIONS_read_(ctx);return true;});
 test('ADMIN_DROIT_ABSENT',()=>denied(()=>BXCT_ENC_ACADEMY_DESK_permission_({...ctx,rights:[]})));
 test('CAISSIER_VERROU',()=>denied(()=>BXCT_ENC_ACADEMY_DESK_permission_({...ctx,agent:{role:'CAISSIER'}})));
 test('SUPERVISEUR_VERROU',()=>denied(()=>BXCT_ENC_PERMISSIONS_read_({...ctx,agent:{role:'SUPERVISEUR'}})));
 test('ROLE_ABSENT',()=>!BXCT_CORE_AUTH_financeRead_({settings:ctx.settings},false));
 test('AUCUNE_ACTIVATION',()=>BXCT_ENC_ACADEMY_WRITE_ACTIVE_===false&&ctx.settings.PAIEMENTS_ACTIFS==='NON'&&ctx.settings.ACADEMIE_DEVIS_OFFICIELS_VALIDES==='NON');
 const out={ok:results.every(x=>x.ok),version:'7.0.13-rc4',total:results.length,reussis:results.filter(x=>x.ok).length,echecs:results.filter(x=>!x.ok).map(x=>x.name)};console.log(JSON.stringify(out));return out;
}
