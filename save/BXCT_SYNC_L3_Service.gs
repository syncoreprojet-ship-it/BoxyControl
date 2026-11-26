/**
 * SERVICE : activation volontaire de droits de consultation pour un role precis.
 * Depend de : BXCT_SYNC_L3_Auth -> Data, LockService.
 * Accessible techniquement aux appels Apps Script publics, mais toute execution
 * exige le proprietaire Google verifie avant ecriture. Aucune operation automatique.
 */
function BXCT_SYNC_L3_SERVICE_habiliter_(role){
  if(!['ADMIN_CONTROL','AGENT'].includes(role))
    throw new Error('BXCT_SYNC_L3_ROLE_NON_AUTORISE');
  const ctx=BXCT_SYNC_L3_AUTH_proprietaire_();
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('BXCT_SYNC_L3_OCCUPE');
  try{
    const resultat=BXCT_SYNC_L3_DATA_activerRegles_(ctx.book,role,ctx.acteur);
    return {ok:true,code:resultat.code,version:BXCT_SYNC_L3_VERSION_,
      role:role,reglesActivees:resultat.modifiees,ecritureSurClient:false};
  }finally{lock.releaseLock();}
}
