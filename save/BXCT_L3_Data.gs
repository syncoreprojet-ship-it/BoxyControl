/** DATA — lecture par lot, pagination arrière, zéro écriture CLIENT. */
function BXCT_L3_DATA_inscriptions_(contexte, choix, cursor, limite) {
  const source = ouvrirSourceClientPhoto_(contexte.params);
  // Le helper source vérifie le nom du classeur et l'ID configuré dans CONTROL.
  const feuille = source.getSheetByName('INSCRIPTIONS');
  if (!feuille) throw new Error('LOT3_SOURCE_INDISPONIBLE');
  const derniereLigne = feuille.getLastRow();
  if (derniereLigne < 1 || derniereLigne > 25001 || feuille.getLastColumn() < 18) {
    throw new Error('LOT3_SOURCE_INDISPONIBLE');
  }
  const titres = feuille.getRange(1,1,1,18).getDisplayValues()[0].map(String);
  const ix = {};
  BXCT_L3_REQUIRED_.forEach(k=>{
    ix[k] = titres.indexOf(k);
    if (ix[k] < 0) throw new Error('LOT3_SCHEMA_CLIENT_INCOMPATIBLE');
  });
  if (derniereLigne === 1) {
    return {lignes:[],suivant:null,parcourues:0,source:'BOXY_CLIENT'};
  }
  const fin = cursor === null ? derniereLigne : Math.min(cursor, derniereLigne);
  if (fin < 2) return {lignes:[],suivant:null,parcourues:0,source:'BOXY_CLIENT'};
  const debut = Math.max(2, fin - BXCT_L3_MAX_SCAN_ + 1);
  const donnees = feuille.getRange(debut,1,fin-debut+1,18).getDisplayValues();
  const sorties = [], codes = new Set(), ids = new Set();
  let prochain = null, lues = 0;
  for(let i=donnees.length-1; i>=0; i--) {
    lues++;
    const ligne=donnees[i], n=debut+i;
    const univers = ligne[ix.code_prestation] === 'SHOOTING' ? 'PHOTO' :
      ligne[ix.code_prestation] === 'FORMATION' ? 'ACADEMIE' : null;
    if (!univers || (choix !== 'TOUS' && univers !== choix) || !contexte.droits[univers]) continue;
    const id=String(ligne[ix.inscription_id]||'').trim();
    const code=String(ligne[ix.code_public]||'').trim();
    if (!id || !/^BXR-[A-Z0-9]{6,24}$/.test(code)) throw new Error('LOT3_DONNEE_CLIENT_INCOHERENTE');
    if(ids.has(id) || codes.has(code)) throw new Error('LOT3_DOUBLON_SOURCE_CLIENT');
    ids.add(id);codes.add(code);
    sorties.push(BXCT_L3_DATA_resumer_(ligne,ix,univers));
    if (sorties.length >= limite) {prochain=n-1>=2?n-1:null;break;}
  }
  if (sorties.length<limite) prochain=debut>2?debut-1:null;
  return {lignes:sorties,suivant:prochain,parcourues:lues,source:'BOXY_CLIENT'};
}

function BXCT_L3_DATA_resumer_(ligne,ix,univers) {
  let details={};
  const raw=String(ligne[ix.details_json]||'');
  if(raw && raw.length<=15000) {
    try{const obj=JSON.parse(raw);if(obj&&typeof obj==='object'&&!Array.isArray(obj))details=obj;}catch(e){}
  }
  const data=details.details && typeof details.details==='object' && !Array.isArray(details.details) ? details.details : details;
  const codeType=String(data.code_type||'').trim().toUpperCase();
  const formation=String(data.code_formation||'').trim().toUpperCase();
  const statut=String(ligne[ix.statut]||'RECU').trim().toUpperCase();
  return {
    inscriptionId:String(ligne[ix.inscription_id]||'').slice(0,90),
    code:String(ligne[ix.code_public]||'').slice(0,40),
    univers:univers,
    nomClient:String(ligne[ix.nom_client]||'').slice(0,110),
    prestation:univers==='PHOTO'?(codeType||'SHOOTING'):(formation||'FORMATION'),
    codeSession:univers==='ACADEMIE'?String(ligne[ix.code_session]||'').slice(0,80):'',
    statutDemande:['RECU','EN_EXAMEN','ANNULEE'].includes(statut)?statut:'EN_EXAMEN',
    creeUtc:String(ligne[ix.cree_le_utc]||'').slice(0,45),
    majUtc:String(ligne[ix.maj_le_utc]||'').slice(0,45)
  };
}
