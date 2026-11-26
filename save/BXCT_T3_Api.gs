/** Authentification et permissions recontrolees cote serveur a chaque lecture. */
function BXCT_T3_TARIFS(idToken,univers){
  try{return BXCT_T3_SERVICE_catalogue_(idToken,univers);}
  catch(e){
    const raw=String(e&&e.message||'');
    const code=/^TARIFS_[A-Z0-9_]+$/.test(raw)?raw:'TARIFS_INDISPONIBLES';
    Logger.log('BXCT_T3 '+code);
    return {ok:false,code:code,message:'Consultation indisponible ou non autorisee.'};
  }
}
/** Diagnostic sans contact CLIENT, sans donnees personnelles ni prix. */
function BXCT_T3_DIAGNOSTIC(){
  try{
    const ss=controlWorkbook_(),p=readControlSettings_(ss),r={ok:true,
      code:'BXCT_T3_CONFIG',version:BXCT_T3_VERSION_,mode:p.APP_MODE,
      clientOfficiel:p.CLIENT_SPREADSHEET_ID===BXCT_T3_CLIENT_ID_,
      accesAgentsConfigure:p.AUTH_GOOGLE_CONFIGURE==='OUI',
      photoAccessible:p.RECHERCHE_CLIENT_ACTIVE==='OUI',
      academieAccessible:p.ACADEMIE_LECTURE_ACTIVE==='OUI',paiementsActifs:p.PAIEMENTS_ACTIFS==='OUI'};
    Logger.log(JSON.stringify(r));return r;
  }catch(e){const r={ok:false,code:'BXCT_T3_CONFIG_INDISPONIBLE'};Logger.log(JSON.stringify(r));return r;}
}
