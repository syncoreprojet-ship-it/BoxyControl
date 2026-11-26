/** Core commun : contexte d'identite, selection CLIENT et lecteur de tables.
 * Extractions sans changement de comportement. Utilise par: ENC, PHOTO, ACADEMIE, FORM_ADMIN.
 * Les anciens noms restent des wrappers stables. Aucun acces d'ecriture.
 */
function BXCT_CORE_AUTH_context_(token) {
  const identity=verifyGoogleIdToken_(token),book=controlWorkbook_();
  const agent=findEnabledAgent_(book,identity),settings=readControlSettings_(book);
  const rights=loadRolePermissions_(book,agent.role);
  const test=PropertiesService.getScriptProperties().getProperty('CONTROL_USE_TEST_SHEET')==='OUI';
  if(!['TEST','PRODUCTION'].includes(settings.APP_MODE)||(settings.APP_MODE==='TEST')!==test)throw new Error('ENVIRONNEMENT_INCOHERENT');
  return {book,agent,settings,rights};
}

function BXCT_CORE_DATA_clientSource_(settings) {
  const script = PropertiesService.getScriptProperties();
  let id;
  if (settings.APP_MODE === 'TEST') {
    id = String(script.getProperty('CLIENT_TEST_SHEET_ID') || '').trim();
    if (!id || id === String(settings.CLIENT_SPREADSHEET_ID || '').trim()) {
      throw new Error('COPIE_CLIENT_TEST_OBLIGATOIRE');
    }
  } else {
    id = String(settings.CLIENT_SPREADSHEET_ID || '').trim();
  }
  if (!/^[a-zA-Z0-9_-]{25,125}$/.test(id)) throw new Error('SOURCE_INDISPONIBLE');
  const source = SpreadsheetApp.openById(id);
  const name = String(source.getName() || '');
  if (settings.APP_MODE === 'TEST' && !/^BOXY_CLIENT_TEST(?:\b|\s|_)/.test(name)) {
    throw new Error('COPIE_CLIENT_TEST_OBLIGATOIRE');
  }
  if (settings.APP_MODE === 'PRODUCTION' && !/^BOXY_CLIENT\b/.test(name)) {
    throw new Error('SOURCE_INDISPONIBLE');
  }
  return source;
}

function BXCT_CORE_DATA_readTable_(book,title,required,max) {
  const tab=book.getSheetByName(title);
  if(!tab) throw new Error('CATALOGUE_INDISPONIBLE');
  const count=tab.getLastRow();
  if(count<1 || count>max+1) throw new Error('CATALOGUE_INDISPONIBLE');
  const data=tab.getRange(1,1,count,tab.getLastColumn()).getDisplayValues();
  const header=data[0].map(k=>String(k||'').trim());
  const pos={};
  required.forEach(k=>{pos[k]=header.indexOf(k);if(pos[k]<0)throw new Error('CATALOGUE_INDISPONIBLE')});
  return data.slice(1).filter(row=>String(row[0]||'').trim()).map(row=>{
    const entry={};required.forEach(k=>entry[k]=String(row[pos[k]]||'').trim());return entry;
  });
}

/** Controle proprietaire Google existant, partage avec le diagnostic. */
function BXCT_CORE_AUTH_proprietaire_(){
 var active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
 var effective=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
 if(!active||!effective||active!==effective)throw new Error('PROPRIETAIRE_NON_IDENTIFIE');
 var book=controlWorkbook_();
 var own=book.getOwner&&book.getOwner();
 var owner=own&&String(own.getEmail()||'').trim().toLowerCase();
 if(!owner||owner!==active)throw new Error('ACCES_PROPRIETAIRE_UNIQUEMENT');
 return {book:book,actor:active};
}

/** Role issu exclusivement du contexte authentifie serveur. */
function BXCT_CORE_AUTH_isAdmin_(role){return role==='ADMIN_CONTROL';}
/** Autorise la consultation administrative, jamais une mutation. */
function BXCT_CORE_AUTH_financeRead_(ctx,global){
 if(BXCT_CORE_AUTH_isAdmin_(ctx.agent && ctx.agent.role))return true;
 const s=ctx.settings;
 return s.ACADEMIE_FINANCES_LECTURE_ACTIVE==='OUI' && s.ACADEMIE_DEVIS_OFFICIELS_VALIDES==='OUI' && (!global || s.PAIEMENTS_ACTIFS==='OUI');
}
