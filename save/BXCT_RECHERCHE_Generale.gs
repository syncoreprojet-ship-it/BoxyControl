/**
 * BOXY CONTROL — Recherche générale multi-prestations, LOT 2/5.
 * Un seul point d'entrée de consultation ; droits vérifiés par prestation.
 * Aucune écriture CLIENT, aucun paiement, aucune confirmation.
 */
const BXCT_RG_VERSION_ = '7.0.11-rc8';
const BXCT_RG_HEADERS_ = [
  'inscription_id','code_public','code_prestation','nom_client','telephone',
  'code_session','details_json','statut','maj_le_utc'
];
const BXCT_RG_PRESTATIONS_ = Object.freeze({
  SHOOTING:'PHOTO', FORMATION:'ACADEMIE', MARIAGE:'MARIAGE',
  CASTING:'CASTING', VIDEO:'VIDEO', CONTENU:'CONTENU',
  STUDIO:'STUDIO', EVENT:'EVENEMENT'
});

/** Code officiel BX.XXX.XX ou historique BXR-…, ou URL QR connue. */
function BXCT_RG_normaliser_(saisie) {
  let raw=String(saisie==null?'':saisie).trim();
  if(raw.length>500)return '';
  if(/^https:\/\//i.test(raw)){
    try{
      const parsed=/^https:\/\/([^/?#]+)([^#]*)/i.exec(raw);
      if(!parsed || !['boxyclient.syncore.site','boxycontrol.syncore.site'].includes(parsed[1].toLowerCase()))return '';
      const param=/(?:\?|&)code=([^&#]+)/i.exec(parsed[2]);
      if(!param)return '';
      raw=decodeURIComponent(param[1].replace(/\+/g,'%20'));
    }catch(e){return '';}
  }
  raw=raw.trim().toUpperCase();
  return /^(?:BX\.[A-Z]{3}\.[A-Z0-9]{2,20}|BXR-[A-Z0-9]{6,24})$/.test(raw)?raw:'';
}

/** Audit fail-closed avant retour d'une fiche, avec empreinte et sans PII. */
function BXCT_RG_auditer_(control,agentId,action,inscriptionId,resultat,code){
  const sheet=control.getSheetByName('AUDIT');
  if(!sheet)throw new Error('AUDIT_INDISPONIBLE');
  const secret=String(PropertiesService.getScriptProperties().getProperty('AUDIT_HASH_SECRET')||'');
  const bytes=secret.length>=32
    ? Utilities.computeHmacSha256Signature(code,secret)
    : Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,code,Utilities.Charset.UTF_8);
  const fingerprint=bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('').slice(0,24);
  const event=['AUD-'+Utilities.getUuid(),new Date().toISOString(),agentId,
    action,inscriptionId||'','',resultat,'RG-'+Utilities.getUuid(),fingerprint,
    'Consultation strictement en lecture seule depuis BOXY CLIENT'];
  try{sheet.appendRow(event);}catch(e){throw new Error('AUDIT_INDISPONIBLE');}
}

function controlRechercheGenerale(idToken,saisie){
  const identity=verifyGoogleIdToken_(idToken);
  const book=controlWorkbook_();
  const agent=findEnabledAgent_(book,identity);
  const settings=readControlSettings_(book);
  const permissions=loadRolePermissions_(book,agent.role);
  if(!['TEST','PRODUCTION'].includes(settings.APP_MODE) ||
     settings.RECHERCHE_CLIENT_ACTIVE!=='OUI')throw new Error('RECHERCHE_GENERALE_FERMEE');
  const peutPhoto=permissions.includes('CONSULTER_DEMANDE');
  const peutAcademie=permissions.includes('CONSULTER_INSCRIPTION_ACADEMIE') &&
    settings.ACADEMIE_RECHERCHE_ACTIVE==='OUI' &&
    settings.ACADEMIE_RECHERCHE_SOURCE==='CLIENT_SEUL' &&
    settings.ACADEMIE_AUDIT_RECHERCHE_OBLIGATOIRE==='OUI';
  if(!peutPhoto && !peutAcademie)throw new Error('AUTORISATION_REFUSEE');
  const code=BXCT_RG_normaliser_(saisie);
  if(!code)throw new Error('CODE_INVALIDE');
  limiterConsultationsPhoto_(agent,settings);
  // La recherche s'appuie toujours sur CLIENT, jamais sur une projection locale.
  const client=ouvrirSourceClientPhoto_(settings);
  const tab=client.getSheetByName('INSCRIPTIONS');
  if(!tab || tab.getLastRow()<1 || tab.getLastRow()>25001 || tab.getLastColumn()<18)
    throw new Error('SOURCE_INDISPONIBLE');
  const header=tab.getRange(1,1,1,18).getDisplayValues()[0].map(x=>String(x||'').trim());
  const col={};
  BXCT_RG_HEADERS_.forEach(k=>{col[k]=header.indexOf(k);if(col[k]<0)throw new Error('SCHEMA_CLIENT_INCOMPATIBLE');});
  const matches=tab.getLastRow()>1
    ? tab.getRange(2,col.code_public+1,tab.getLastRow()-1,1)
      .createTextFinder(code).matchEntireCell(true).matchCase(true).findAll() : [];
  if(matches.length>1)throw new Error('SOURCE_CLIENT_AMBIGUE');
  let dossier=null,genre='',outcome='ABSENT';
  if(matches.length===1){
    const row=tab.getRange(matches[0].getRow(),1,1,18).getDisplayValues()[0];
    const service=String(row[col.code_prestation]||'').trim().toUpperCase();
    const permitted=service==='FORMATION'?peutAcademie:
      service==='SHOOTING'?peutPhoto:
      peutPhoto && ['SUPERVISEUR','ADMIN_CONTROL'].includes(agent.role);
    if(permitted && Object.prototype.hasOwnProperty.call(BXCT_RG_PRESTATIONS_,service)){
      genre=BXCT_RG_PRESTATIONS_[service];
      if(service==='FORMATION'){
        dossier=academyLookupMap_(client,row,col);
        academyLot2AjouterHistorique_(book,dossier);
      } else if(service==='SHOOTING') {
        dossier=mapperDossierPhoto_(row,col);
      } else {
        dossier={inscriptionId:String(row[col.inscription_id]||'').slice(0,90),
          code:String(row[col.code_public]||'').slice(0,50),
          prestation:genre,
          nomClient:String(row[col.nom_client]||'').slice(0,110),
          telephoneMasque:masquerTelephonePhoto_(row[col.telephone]),
          statutDemande:String(row[col.statut]||'RECU').slice(0,45),
          codeSession:String(row[col.code_session]||'').slice(0,80),
          majClientUtc:String(row[col.maj_le_utc]||'').slice(0,50),
          statutPaiement:'NON_VERIFIE'};
      }
      outcome='TROUVE';
    } else {outcome='NON_AUTORISE';}
  }
  BXCT_RG_auditer_(book,agent.agentId,'CONSULTATION_DOSSIER_GENERAL',
    dossier?dossier.inscriptionId:'',outcome,code);
  if(!dossier)return {ok:true,found:false};
  return {ok:true,found:true,genre,dossier,readOnly:true,release:BXCT_RG_VERSION_};
}
