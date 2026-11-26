/**
 * Adaptateur DATA unique du LOT 2. Aucune regle de role ni de mot de passe ici.
 * Depend de : ADMIN_L2_CONFIG_, schemas LOT1, SpreadsheetApp.
 * Utilise par : ADMIN_L2_SERVICE_ et ADMIN_L2_AUTH_ (stockage sessions).
 * Les fonctions de mutation sont internes uniquement.
 */
function ADMIN_L2_DATA_table_(ss,name){
  var expected=BOXY_ADMIN_SCHEMAS_LOT1_[name];
  if(!expected)throw ADMIN_L2_CONFIG_erreur_('TABLE_INCONNUE');
  var sh=ss.getSheetByName(name);
  if(!sh)throw ADMIN_L2_CONFIG_erreur_('TABLE_ABSENTE');
  var header=sh.getRange(1,1,1,expected.length).getDisplayValues()[0];
  if(header.join('|')!==expected.join('|'))throw ADMIN_L2_CONFIG_erreur_('EN_TETES_INCOMPATIBLES');
  return {sheet:sh,header:expected};
}
function ADMIN_L2_DATA_cellule_(v){
  var s=String(v===undefined||v===null?'':v);
  // Empêche l'interpretation d'une valeur textuelle comme formule Sheets.
  return /^[=+\-@]/.test(s)?"'"+s:s;
}
function ADMIN_L2_DATA_lireCellule_(v){
  var s=String(v||'');return /^'[=+\-@]/.test(s)?s.slice(1):s;
}
function ADMIN_L2_DATA_lignes_(ss,name){
  var t=ADMIN_L2_DATA_table_(ss,name);var last=t.sheet.getLastRow();
  if(last<=1)return [];
  var rows=t.sheet.getRange(2,1,last-1,t.header.length).getDisplayValues();
  return rows.map(function(v,i){
    var obj={_ligne:i+2};t.header.forEach(function(k,j){obj[k]=ADMIN_L2_DATA_lireCellule_(v[j]);});return obj;
  });
}
function ADMIN_L2_DATA_un_(ss,name,col,val){
  var a=ADMIN_L2_DATA_lignes_(ss,name);
  for(var i=0;i<a.length;i++)if(a[i][col]===String(val))return a[i];
  return null;
}
function ADMIN_L2_DATA_ajouter_(ss,name,data){
  var t=ADMIN_L2_DATA_table_(ss,name);
  var cells=t.header.map(function(k){return ADMIN_L2_DATA_cellule_(data[k]);});
  var n=t.sheet.getLastRow()+1;
  t.sheet.getRange(n,1,1,cells.length).setValues([cells]);
  return n;
}
function ADMIN_L2_DATA_modifier_(ss,name,row,patch){
  var t=ADMIN_L2_DATA_table_(ss,name);
  if(!Number.isInteger(row)||row<2||row>t.sheet.getLastRow())throw ADMIN_L2_CONFIG_erreur_('LIGNE_INCORRECTE');
  var r=t.sheet.getRange(row,1,1,t.header.length),v=r.getDisplayValues()[0];
  Object.keys(patch).forEach(function(k){var col=t.header.indexOf(k);if(col<0)throw ADMIN_L2_CONFIG_erreur_('COLONNE_INCONNUE');v[col]=ADMIN_L2_DATA_cellule_(patch[k]);});
  r.setValues([v]);
}
function ADMIN_L2_DATA_paramMaj_(ss,key,value){
  var sheet=ss.getSheetByName('PARAMETRES');
  if(!sheet)throw ADMIN_L2_CONFIG_erreur_('PARAMETRES_ABSENTS');
  var data=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),2).getDisplayValues();
  var found=[];for(var i=0;i<data.length;i++)if(data[i][0]===key)found.push(i+2);
  if(found.length!==1)throw ADMIN_L2_CONFIG_erreur_('PARAMETRE_ABSENT_OU_DUPLIQUE');
  sheet.getRange(found[0],2).setValue(String(value));
}
function ADMIN_L2_DATA_audit_(ss,action,objet,id,auteur,version,cle,detail){
  return ADMIN_L2_DATA_ajouter_(ss,'AUDIT_ADMIN',{
    evenement_id:'AUD-'+Utilities.getUuid(),type_objet:objet,id_objet:id,
    action:action,utilisateur_auteur_id:auteur||'',horodatage_utc:ADMIN_L2_CONFIG_utc_(),
    version_objet:version||'1',details_sans_secrets:JSON.stringify(detail||{}),cle_idempotence:cle||''
  });
}
function ADMIN_L2_DATA_authJournal_(ss,user,action,resultat,login){
  ADMIN_L2_DATA_ajouter_(ss,'JOURNAL_AUTH',{
    evenement_id:'AUTH-'+Utilities.getUuid(),utilisateur_id:user||'',action:action,
    resultat:resultat,identifiant_masque:login?login.slice(0,2)+'***':'',
    cree_utc:ADMIN_L2_CONFIG_utc_(),empreinte_session:'',origine_masquee:''
  });
}
function ADMIN_L2_DATA_revoquerSessions_(ss,userId){
  var rows=ADMIN_L2_DATA_lignes_(ss,'SESSIONS_AUTH'),now=ADMIN_L2_CONFIG_utc_(),count=0;
  rows.forEach(function(r){if(r.utilisateur_id===userId&&r.statut==='ACTIVE'){
    ADMIN_L2_DATA_modifier_(ss,'SESSIONS_AUTH',r._ligne,{statut:'REVOQUEE',revoque_utc:now});count++;
  }});
  return count;
}
