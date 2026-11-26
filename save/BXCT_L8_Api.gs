/** Diagnostic structurel SANS ecriture et SANS appel au classeur CLIENT. */
function BXCT_L8_AUDIT_SANS_ECRITURE(){
  const r={ok:typeof BXCT_L8_TRANSPORT_appeler_==='function'&&
      typeof BXCT_L8_AUTH_portee_==='function'&&
      typeof verifyGoogleIdToken_==='function',
    version:BXCT_L8_VERSION_,liaisonActive:BXCT_L8_CONFIG_active_(),
    connexionGoogleConfiguree:!!PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID'),
    ecritureEffectuee:false,clientConsulte:false};
  console.log(JSON.stringify(r));return r;
}
