/**
 * BOXY CONTROL - Transport HMAC officiel (Lot 8, Lot 2/7).
 * Correctif Lot 3 rc4 : FILE passe par le lecteur Sheets serveur.
 * Les autres operations et le protocole HMAC restent inchanges.
 * Aucun corps de reponse, nom, numero, URL ou secret n'est journalise.
 * Dependances preservees : BXCT_L8_CONFIG_*, BXCT_SYNC_L2_LIVE_autoriserTransport_,
 * BXCT_L8_AUTH_portee_. Contrat public BXCT_L8_TRANSPORT_appeler_ inchange.
 */
function BXCT_L8_TRANSPORT_classerReponse_(response){
  const httpStatus=Number(response.getResponseCode());
  const raw=String(response.getContentText()||'');
  let headers={};
  try{headers=response.getHeaders()||{};}catch(e){headers={};}
  const ct=String(headers['Content-Type']||headers['content-type']||'').toLowerCase();
  let value,parseOk=false;
  try{value=JSON.parse(raw);parseOk=true;}catch(e){/* ne pas logger le corps */}
  const schemaOk=parseOk&&value!==null&&typeof value==='object'&&
    !Array.isArray(value)&&typeof value.ok==='boolean';
  let formatReponse;
  if(schemaOk)formatReponse='JSON_BOXY';
  else if(parseOk)formatReponse='JSON_INCOMPATIBLE';
  else if(!raw.trim())formatReponse='VIDE';
  else if(/^text\/html(?:;|$)/.test(ct)||
      /^\s*(?:<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(raw.slice(0,250)))
    formatReponse='HTML';
  else if(httpStatus>=300&&httpStatus<400)formatReponse='REDIRECTION';
  else formatReponse='TEXTE_NON_JSON';
  const clientCode=schemaOk&&typeof value.code==='string'&&
    /^BXCL_L8_[A-Z0-9_]{1,90}$/.test(value.code)?value.code:null;
  return {httpStatus:httpStatus,formatReponse:formatReponse,clientCode:clientCode};
}

/** Un seul point de transport pour FILE et DOSSIER, toujours en lecture seule. */
function BXCT_L8_TRANSPORT_appeler_(operation,contexte,body){
  // FILE: lecture Sheets sous permissions Google du proprietaire du script.
  // Aucun appel HTTP /exec, aucune nouvelle cle, aucune ecriture sur CLIENT.
  if(operation==='FILE'){
    BXCT_SYNC_L2_LIVE_autoriserTransport_(operation,contexte);
    const porteeDirecte=BXCT_L8_AUTH_portee_(contexte);
    return BXCT_SYNC_L3_DIRECT_lireFile_(porteeDirecte,BXCT_L6_VALIDATION_options_(body));
  }
  if(!BXCT_L8_CONFIG_active_())return {ok:true,sourceReady:false,
    code:'BXCT_L8_LIAISON_INACTIVE',dossiers:[],totalEnAttente:null,
    actionEnregistree:false};
  // Ne jamais signer ni envoyer une decision a CLIENT avant le lot metier.
  BXCT_SYNC_L2_LIVE_autoriserTransport_(operation,contexte);
  const portee=BXCT_L8_AUTH_portee_(contexte);
  const message={issuer:'BOXY_CONTROL',schema:1,
    requestId:Utilities.getUuid().toUpperCase(),ts:Date.now(),operation:operation,
    agentId:String(contexte.agentId||''),prestations:portee,body:body||{}};
  return BXCT_L8_TRANSPORT_envoyerSigne_(message);
}

/** Primitif interne commun; les appelants autorisent le contexte avant de signer. */
function BXCT_L8_TRANSPORT_envoyerSigne_(message){
  const bytes=Utilities.newBlob(JSON.stringify(message),'application/json').getBytes();
  const data=Utilities.base64EncodeWebSafe(bytes).replace(/=/g,'');
  const sig=Utilities.computeHmacSha256Signature(data,BXCT_L8_CONFIG_secret_(),Utilities.Charset.UTF_8)
    .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
  let response;
  try{
    response=UrlFetchApp.fetch(BXCT_L8_CONFIG_url_(),{method:'post',
      contentType:'application/json',payload:JSON.stringify({data:data,sig:sig}),
      followRedirects:true,muteHttpExceptions:true,validateHttpsCertificates:true});
  }catch(e){throw new Error('BXCT_L8_TRANSPORT_INDISPONIBLE');}
  if(response.getResponseCode()!==200)throw new Error('BXCT_L8_SERVICE_INDISPONIBLE');
  const diagnostic=BXCT_L8_TRANSPORT_classerReponse_(response);
  if(diagnostic.formatReponse==='HTML')throw new Error('BXCT_L8_REPONSE_HTML');
  if(diagnostic.formatReponse==='VIDE')throw new Error('BXCT_L8_REPONSE_VIDE');
  if(diagnostic.formatReponse==='JSON_INCOMPATIBLE')throw new Error('BXCT_L8_REPONSE_JSON_INCOMPATIBLE');
  if(diagnostic.formatReponse!=='JSON_BOXY')throw new Error('BXCT_L8_REPONSE_NON_JSON');
  return JSON.parse(response.getContentText());
}
