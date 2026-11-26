/**
 * Diagnostic exact de la validation locale de BXCT_L8_Config.gs.
 * Ne retourne jamais la cle, l'URL ou leur longueur.
 * Appeler seulement apres verification du proprietaire CONTROL.
 */
function BXCT_SYNC_L3_AUDIT_hmacConfig_(){
  const props=PropertiesService.getScriptProperties();
  const enabled=props.getProperty('BXCT_L8_ENABLED')==='OUI';
  const secret=String(props.getProperty('BXCT_L8_SECRET')||'');
  const url=String(props.getProperty('BXCT_L8_CLIENT_URL')||'');
  const secretValide=/^[A-Za-z0-9_-]{48,256}$/.test(secret);
  const urlValide=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{25,}\/exec$/.test(url);
  const pret=typeof BXCT_L8_CONFIG_active_==='function' && BXCT_L8_CONFIG_active_();
  const aVerifier=[];
  if(!enabled)aVerifier.push('BXCT_L8_ENABLED');
  if(!secretValide)aVerifier.push('BXCT_L8_SECRET');
  if(!urlValide)aVerifier.push('BXCT_L8_CLIENT_URL');
  return {pret:!!pret,activationCorrecte:enabled,secretFormatValide:secretValide,
    urlFormatValide:urlValide,parametresAVerifier:aVerifier};
}
/**
 * Diagnostic de configuration HMAC sans HTTP et sans aucune ecriture.
 * Dans l'editeur Apps Script : BXCT_SYNC_L3_DIAGNOSTIC_HMAC_SANS_ECRITURE().
 * Le controle du proprietaire Google reste obligatoire, meme pour ce diagnostic.
 */
function BXCT_SYNC_L3_DIAGNOSTIC_HMAC_SANS_ECRITURE(){
  let result;
  try{
    BXCT_SYNC_L3_AUTH_proprietaire_();
    const hmac=BXCT_SYNC_L3_AUDIT_hmacConfig_();
    result={ok:hmac.pret,code:hmac.pret?'BXCT_SYNC_L3_HMAC_CONFIG_LOCALE_OK':
      'BXCT_SYNC_L3_HMAC_A_CONFIGURER',version:BXCT_SYNC_L3_VERSION_,
      activationCorrecte:hmac.activationCorrecte,
      secretFormatValide:hmac.secretFormatValide,
      urlFormatValide:hmac.urlFormatValide,
      parametresAVerifier:hmac.parametresAVerifier,
      communicationHttpVerifiee:false,appelHttpEffectue:false,ecritureEffectuee:false};
  }catch(e){
    const msg=String(e&&e.message||e);
    result={ok:false,code:/^BXCT_SYNC_L3_[A-Z0-9_]+$/.test(msg)?msg:
      'BXCT_SYNC_L3_DIAGNOSTIC_REFUSE',version:BXCT_SYNC_L3_VERSION_,
      appelHttpEffectue:false,ecritureEffectuee:false};
  }
  console.log(JSON.stringify(result));return result;
}

/**
 * AUDIT lecture seule, depuis l'editeur Apps Script et par le proprietaire.
 * Les sorties ne contiennent ni nom client ni code public ni secret HMAC.
 * Depend de : BXCT_SYNC_L3_Auth/Data, BXCT_L8_Transport.
 */
function BXCT_SYNC_L3_AUDIT_SANS_ECRITURE(){
  let result;
  try{
    const ctx=BXCT_SYNC_L3_AUTH_proprietaire_();
    const admin=BXCT_SYNC_L3_DATA_etatRegles_(ctx.book,'ADMIN_CONTROL');
    const agent=BXCT_SYNC_L3_DATA_etatRegles_(ctx.book,'AGENT');
    const missing=[
      'BXCT_L6_LIRE_FILE','BXCT_L6_SERVICE_lireFile_',
      'BXCT_L6_DATA_lireFile_','BXCT_L8_TRANSPORT_appeler_',
      'BXCT_L8_AUTH_portee_','BXCT_LOGIN_AUTH_verifierSession_'
    ].filter(function(name){return typeof globalThis[name]!=='function';});
    if(missing.length)throw new Error('BXCT_SYNC_L3_DEPENDANCE_MANQUANTE');
    const hmac=BXCT_SYNC_L3_AUDIT_hmacConfig_();
    result={ok:true,code:'BXCT_SYNC_L3_STRUCTURE_OK',version:BXCT_SYNC_L3_VERSION_,
      connexionHmacConfiguree:hmac.pret,liaisonHttpNonTestee:true,
      droitsAdmin:admin.regles.filter(function(r){return r.statut==='OUI';}).map(function(r){return r.permission;}),
      droitsAgent:agent.regles.filter(function(r){return r.statut==='OUI';}).map(function(r){return r.permission;}),
      lectureSeule:true,appelHttpEffectue:false,ecritureEffectuee:false};
  }catch(e){
    const msg=String(e&&e.message||e);
    result={ok:false,code:/^BXCT_SYNC_L3_[A-Z0-9_]+$/.test(msg)?msg:'BXCT_SYNC_L3_AUDIT_REFUSE',
      version:BXCT_SYNC_L3_VERSION_,appelHttpEffectue:false,ecritureEffectuee:false};
  }
  console.log(JSON.stringify(result));return result;
}
/**
 * UN SEUL TEST RC4: lecture directe de BOXY CLIENT officiel, sans HTTP et sans ecriture.
 * Executer depuis Apps Script CONTROL apres installation des 3 fichiers rc4.
 * Le compte doit etre proprietaire CONTROL et autorise en ADMIN_CONTROL.
 */
function BXCT_SYNC_L3_TESTER_LIAISON_LECTURE(){
  let result;
  try{
    const ctx=BXCT_SYNC_L3_AUTH_proprietaire_();
    const identity={authMode:'LOCAL_PASSWORD',agentId:BXCT_SYNC_L3_ADMIN_ID_,
      login:BXCT_SYNC_L3_ADMIN_LOGIN_};
    const admin=findEnabledAgent_(ctx.book,identity);
    if(admin.role!=='ADMIN_CONTROL')throw new Error('BXCT_SYNC_L3_ADMIN_INATTENDU');
    const droits=loadRolePermissions_(ctx.book,admin.role);
    const lecture=BXCT_L8_TRANSPORT_appeler_('FILE',
      {agentId:admin.agentId,role:admin.role,droits:droits},
      {statut:'TOUS',prestation:'TOUS',limite:1,curseur:0});
    if(!lecture||!lecture.ok||!lecture.sourceReady||!Array.isArray(lecture.dossiers)||
       !Number.isSafeInteger(lecture.totalEnAttente)||
       !Number.isSafeInteger(lecture.totalFiltres))
      throw new Error('BXCT_SYNC_L3_LECTURE_CLIENT_ECHOUE');
    result={ok:true,code:'BXCT_SYNC_L3_LECTURE_CLIENT_OK',version:BXCT_SYNC_L3_VERSION_,
      dossiersTrouves:lecture.totalFiltres,enAttente:lecture.totalEnAttente,
      appelHttpEffectue:false,ecritureEffectuee:false,donneesPersonnellesExposees:false};
  }catch(e){
    const raw=String(e&&e.message||e);
    result={ok:false,code:/^BXCT_(SYNC_L3|SYNC_L2|L8|L6)_[A-Z0-9_]+$/.test(raw)?raw:
      'BXCT_SYNC_L3_LECTURE_CLIENT_ECHOUE',version:BXCT_SYNC_L3_VERSION_,
      appelHttpEffectue:false,ecritureEffectuee:false,donneesPersonnellesExposees:false};
  }
  console.log(JSON.stringify(result));return result;
}

/**
 * Diagnostic manuel du DEPLOIEMENT HTTP CLIENT, sans HMAC ni donnees client.
 * A lancer depuis l'editeur CONTROL, uniquement par le proprietaire Google.
 * Envoie l'enveloppe volontairement invalide '{}' : le doPost officiel
 * doit repondre en JSON avec BXCL_L8_REQUETE_REFUSEE. C'est un REFUS attendu.
 * N'imprime JAMAIS l'URL, les entetes, le corps HTTP, la cle ni un dossier.
 * Dependances : BXCT_SYNC_L3_AUTH_proprietaire_, BXCT_L8_CONFIG_*,
 * BXCT_L8_TRANSPORT_classerReponse_. Aucun ecriture metier.
 */
function BXCT_SYNC_L3_DIAGNOSTIC_ENDPOINT_SANS_ECRITURE(){
  let result,appelHttpTente=false;
  try{
    BXCT_SYNC_L3_AUTH_proprietaire_();
    if(!BXCT_L8_CONFIG_active_())throw new Error('BXCT_SYNC_L3_HMAC_NON_CONFIGURE');
    if(typeof BXCT_L8_TRANSPORT_classerReponse_!=='function')
      throw new Error('BXCT_SYNC_L3_TRANSPORT_NON_MIS_A_JOUR');
    let response;
    try{
      appelHttpTente=true;
      response=UrlFetchApp.fetch(BXCT_L8_CONFIG_url_(),{
        method:'post',contentType:'application/json',payload:'{}',
        followRedirects:true,muteHttpExceptions:true,validateHttpsCertificates:true});
    }catch(e){throw new Error('BXCT_L8_TRANSPORT_INDISPONIBLE');}
    const info=BXCT_L8_TRANSPORT_classerReponse_(response);
    let code='BXCT_SYNC_L3_ENDPOINT_INATTENDU';
    let ok=false;
    if(info.httpStatus!==200)code='BXCT_SYNC_L3_ENDPOINT_HTTP_NON_200';
    else if(info.formatReponse==='HTML')code='BXCT_SYNC_L3_ENDPOINT_HTML';
    else if(info.formatReponse!=='JSON_BOXY')code='BXCT_SYNC_L3_ENDPOINT_PROTOCOLE_INVALIDE';
    else if(info.clientCode==='BXCL_L8_REQUETE_REFUSEE'||
            info.clientCode==='BXCL_L8_ENVELOPPE_INVALIDE'){
      code='BXCT_SYNC_L3_ENDPOINT_CLIENT_ATTEINT';ok=true;
    }else if(info.clientCode==='BXCL_L8_LIAISON_INACTIVE')
      code='BXCT_SYNC_L3_ENDPOINT_CLIENT_INACTIF';
    else if(info.clientCode)code='BXCT_SYNC_L3_ENDPOINT_REFUS_CLIENT_INATTENDU';
    else code='BXCT_SYNC_L3_ENDPOINT_JSON_INATTENDU';
    result={ok:ok,code:code,version:BXCT_SYNC_L3_VERSION_,
      httpStatus:info.httpStatus,formatReponse:info.formatReponse,
      codeClient:info.clientCode||null,appelHttpTente:true,
      ecritureEffectuee:false,donneesPersonnellesExposees:false};
  }catch(e){
    const raw=String(e&&e.message||e);
    result={ok:false,code:/^BXCT_(?:SYNC_L3|L8)_[A-Z0-9_]+$/.test(raw)?raw:
      'BXCT_SYNC_L3_ENDPOINT_DIAGNOSTIC_REFUSE',version:BXCT_SYNC_L3_VERSION_,
      appelHttpTente:appelHttpTente,ecritureEffectuee:false,
      donneesPersonnellesExposees:false};
  }
  console.log(JSON.stringify(result));return result;
}
