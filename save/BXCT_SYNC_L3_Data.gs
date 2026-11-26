/**
 * DATA : adaptation idempotente et BORNEE de CONTROL.ROLES pour le lecteur CLIENT.
 * Le seul changement autorise ici : active NON -> OUI sur 2 permissions existantes.
 * Depend de : BXCT_SYNC_L3_Config, BXCT_PARAMS_DATA_journaliser_ (writer audit commun).
 * Aucun ajout de role/colonne, aucun changement dans les modules de decisions.
 */
function BXCT_SYNC_L3_DATA_etatRegles_(book,role){
  const sh=book.getSheetByName('ROLES');
  if(!sh)throw new Error('BXCT_SYNC_L3_ROLES_ABSENTS');
  const last=sh.getLastRow();
  if(last<2||last>5000)throw new Error('BXCT_SYNC_L3_ROLES_INCOMPATIBLES');
  const header=sh.getRange(1,1,1,4).getDisplayValues()[0];
  if(header.join('|')!=='role|autorisation|description|active')
    throw new Error('BXCT_SYNC_L3_ROLES_INCOMPATIBLES');
  const rows=sh.getRange(2,1,last-1,4).getDisplayValues();
  const result={sheet:sh,regles:[]};
  BXCT_SYNC_L3_READ_ONLY_.forEach(function(permission){
    const matches=[];
    rows.forEach(function(r,i){
      if(String(r[0]||'').trim()===role&&String(r[1]||'').trim()===permission)
        matches.push({ligne:i+2,statut:String(r[3]||'').trim()});
    });
    if(matches.length!==1||!['NON','OUI'].includes(matches[0].statut))
      throw new Error('BXCT_SYNC_L3_REGLE_ABSENTE_OU_DOUBLE');
    result.regles.push({permission:permission,ligne:matches[0].ligne,statut:matches[0].statut});
  });
  return result;
}
function BXCT_SYNC_L3_DATA_activerRegles_(book,role,acteur){
  const donnees=BXCT_SYNC_L3_DATA_etatRegles_(book,role);
  const audit=book.getSheetByName('_BXCT_PARAMS_AUDIT');
  if(!audit||audit.getLastRow()<1||
     audit.getRange(1,1,1,5).getDisplayValues()[0].join('|')!==
       'date_utc|action|acteur|agent_id|detail')
    throw new Error('BXCT_SYNC_L3_AUDIT_INCOMPATIBLE');
  const aActiver=donnees.regles.filter(function(r){return r.statut==='NON';});
  if(!aActiver.length)return {role:role,code:'DEJA_ACTIF',modifiees:0};
  aActiver.forEach(function(r){donnees.sheet.getRange(r.ligne,4).setValue('OUI');});
  SpreadsheetApp.flush();
  BXCT_PARAMS_DATA_journaliser_(book,'SYNC_L3_LECTURE_AUTORISEE',acteur,'',
    'ROLE='+role+';PERMISSIONS='+aActiver.map(function(x){return x.permission;}).join(','));
  return {role:role,code:'LECTURE_ACTIVE',modifiees:aActiver.length};
}
