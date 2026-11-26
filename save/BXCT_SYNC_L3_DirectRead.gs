/**
 * BOXY CONTROL / Sync L3 rc4 - lecture officielle DIRECTE et STRICTEMENT lecture seule.
 * Un seul lecteur Sheets serveur, aucune connexion HTTP ou URL CLIENT requise.
 * Entree privee appelee APRES la session et les permissions CONTROL (L6/L8).
 * Source de verite conservee: BOXY CLIENT, onglets INSCRIPTIONS et SUIVI_PUBLIC.
 * Ne cree, ne modifie et ne supprime aucune cellule.
 */
const BXCT_SYNC_L3_DIRECT_HEADERS_INSCRIPTIONS_ = Object.freeze([
  'inscription_id','code_public','cree_le_utc','code_prestation','origine',
  'nom_client','telephone','email','code_session','details_json','consentement',
  'statut','synchro_statut','reference_control','reference_admin',
  'cle_idempotence','version_schema','maj_le_utc'
]);
const BXCT_SYNC_L3_DIRECT_HEADERS_PUBLIC_ = Object.freeze([
  'inscription_id','statut_dossier','statut_reservation','statut_paiement',
  'date_confirmee','heure_confirmee','maj_le_utc','reference_control',
  'version_projection','dernier_evenement_control'
]);
const BXCT_SYNC_L3_DIRECT_PRESTATIONS_ = Object.freeze([
  'SHOOTING','FORMATION','MARIAGE','CASTING','VIDEO','CONTENU','STUDIO','EVENT'
]);
const BXCT_SYNC_L3_DIRECT_STATUTS_ = Object.freeze(['EN_ATTENTE','CONFIRMEE','ANNULEE']);

function BXCT_SYNC_L3_DIRECT_feuille_(book,name,headers){
  const sh = book.getSheetByName(name);
  if (!sh || sh.getLastColumn() < headers.length)
    throw new Error('BXCT_SYNC_L3_SCHEMA_CLIENT_INCOMPATIBLE');
  const actual = sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
  if (headers.some(function(h,i){return String(actual[i]||'')!==h;}))
    throw new Error('BXCT_SYNC_L3_SCHEMA_CLIENT_INCOMPATIBLE');
  // A single request must never scan an unbounded data set.
  if (sh.getLastRow()>25001)
    throw new Error('BXCT_SYNC_L3_VOLUME_CLIENT_A_PAGINER');
  return sh;
}

function BXCT_SYNC_L3_DIRECT_dates_(inscription,projection){
  let date=String(projection[4]||''),heure=String(projection[5]||'');
  if (!date){
    try{
      const raw=String(inscription[9]||'');
      if (raw.length<=25000){
        const v=JSON.parse(raw||'{}');
        const planning=v&&v.planning&&typeof v.planning==='object'?v.planning:{};
        date=String(planning.date||v.date_souhaitee||v.dateSouhaitee||'');
        heure=String(planning.heure||v.heure_souhaitee||v.heureSouhaitee||'');
      }
    }catch(e){/* Dates facultatives, jamais exposer le JSON brut. */}
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))date='';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(heure))heure='';
  return {date:date,heure:heure};
}

function BXCT_SYNC_L3_DIRECT_source_(){
  // Le routage n'est PAS controle par la page et ne doit jamais utiliser TEST.
  if (PropertiesService.getScriptProperties().getProperty('CONTROL_USE_TEST_SHEET')==='OUI')
    throw new Error('BXCT_SYNC_L3_MODE_TEST_REFUSE');
  const control=controlWorkbook_();
  if (control.getId()!==BOXY_CONTROL_SHEET_ID_)
    throw new Error('BXCT_SYNC_L3_SOURCE_CONTROL_INVALIDE');
  const settings=readControlSettings_(control);
  const expected=BXCT_SYNC_L2_LIVE_CLIENT_ID_;
  if (settings.CLIENT_SPREADSHEET_ID!==expected)
    throw new Error('BXCT_SYNC_L3_SOURCE_CLIENT_INVALIDE');
  let book;
  try{book=SpreadsheetApp.openById(expected);}
  catch(e){throw new Error('BXCT_SYNC_L3_ACCES_CLASSEUR_CLIENT_REFUSE');}
  if (book.getId()!==expected || book.getName()!=='BOXY_CLIENT')
    throw new Error('BXCT_SYNC_L3_SOURCE_CLIENT_INVALIDE');
  return book;
}

function BXCT_SYNC_L3_DIRECT_lireFile_(portee,filtre){
  // La session, les droits et la validation ont deja ete controles en amont.
  // Un portee vide ou un filtre non normalise est refuse sans lire CLIENT.
  if (!Array.isArray(portee) || !portee.length || portee.some(function(p){
    return BXCT_SYNC_L3_DIRECT_PRESTATIONS_.indexOf(p)<0;
  }))throw new Error('BXCT_SYNC_L3_PORTEE_INVALIDE');
  const f=filtre;
  if(!f || typeof f!=='object' || Array.isArray(f) ||
     ['TOUS','EN_ATTENTE','CONFIRMEE','ANNULEE'].indexOf(f.statut)<0 ||
     !(f.prestation==='TOUS'||BXCT_SYNC_L3_DIRECT_PRESTATIONS_.indexOf(f.prestation)>=0) ||
     !Number.isSafeInteger(f.limite) || f.limite<1 || f.limite>200 ||
     !Number.isSafeInteger(f.curseur) || f.curseur<0 || f.curseur>1000000)
    throw new Error('BXCT_SYNC_L3_FILTRE_NON_NORMALISE');
  if (f.prestation!=='TOUS' && portee.indexOf(f.prestation)<0)
    throw new Error('BXCT_L8_AUTORISATION_REFUSEE');

  const book=BXCT_SYNC_L3_DIRECT_source_();
  const ins=BXCT_SYNC_L3_DIRECT_feuille_(book,'INSCRIPTIONS',
    BXCT_SYNC_L3_DIRECT_HEADERS_INSCRIPTIONS_);
  const pub=BXCT_SYNC_L3_DIRECT_feuille_(book,'SUIVI_PUBLIC',
    BXCT_SYNC_L3_DIRECT_HEADERS_PUBLIC_);
  const projections=new Map();
  if (pub.getLastRow()>1){
    pub.getRange(2,1,pub.getLastRow()-1,10).getDisplayValues().forEach(function(row){
      const id=String(row[0]||'').trim();
      if (!id)return;
      if (projections.has(id))throw new Error('BXCT_SYNC_L3_PROJECTION_DUPLIQUEE');
      projections.set(id,row);
    });
  }
  const seen=new Set(),dossiers=[];
  let totalEnAttente=0;
  if (ins.getLastRow()>1){
    ins.getRange(2,1,ins.getLastRow()-1,18).getDisplayValues().forEach(function(row){
      const id=String(row[0]||'').trim(),code=String(row[1]||'').trim();
      const prestation=String(row[3]||'').trim().toUpperCase();
      if (!id || !code || portee.indexOf(prestation)<0)return;
      if (seen.has(id))throw new Error('BXCT_SYNC_L3_INSCRIPTION_DUPLIQUEE');
      seen.add(id);
      const projection=projections.get(id)||[id,'RECU','EN_ATTENTE','NON_RENSEIGNE','','','','',0,''];
      const rawStatus=String(projection[2]||'EN_ATTENTE').toUpperCase();
      const statut=String(row[11]||'').toUpperCase()==='ANNULEE'?'ANNULEE':
        BXCT_SYNC_L3_DIRECT_STATUTS_.indexOf(rawStatus)>=0?rawStatus:'EN_ATTENTE';
      if (statut==='EN_ATTENTE')totalEnAttente++;
      if (f.statut!=='TOUS'&&f.statut!==statut)return;
      if (f.prestation!=='TOUS'&&f.prestation!==prestation)return;
      const dates=BXCT_SYNC_L3_DIRECT_dates_(row,projection);
      // Noms, numeros, emails et JSON DETAILS restent strictement sur le serveur.
      dossiers.push({inscriptionId:id,codePublic:code,codePrestation:prestation,
        statut:statut,datePrevue:dates.date,heurePrevue:dates.heure});
    });
  }
  dossiers.sort(function(a,b){
    return BXCT_SYNC_L3_DIRECT_PRESTATIONS_.indexOf(a.codePrestation)-
      BXCT_SYNC_L3_DIRECT_PRESTATIONS_.indexOf(b.codePrestation)||
      (a.datePrevue||'9999').localeCompare(b.datePrevue||'9999')||
      (a.heurePrevue||'99:99').localeCompare(b.heurePrevue||'99:99')||
      a.codePublic.localeCompare(b.codePublic)||a.inscriptionId.localeCompare(b.inscriptionId);
  });
  const page=dossiers.slice(f.curseur,f.curseur+f.limite);
  const next=f.curseur+page.length;
  return {ok:true,sourceReady:true,code:'BXCT_SYNC_L3_LECTURE_CLIENT_OK',
    dossiers:page,totalEnAttente:totalEnAttente,totalFiltres:dossiers.length,
    curseurSuivant:next<dossiers.length?next:null,majUtc:new Date().toISOString(),
    lectureSeule:true,actionEnregistree:false};
}
