/** BOXY CONTROL | PARAMETRES | v7.0.7-rc1 | Config du module.
 * Depend de: aucune. Utilise par: BXCT_PARAMS_*.
 * Compte et permissions dans AGENTS, ROLES, PARAMETRES.
 */
var BXCT_PARAMS_CONFIG_=Object.freeze({
 VERSION:'7.0.8-rc3',ADMIN_ID:'ADMIN-001',ADMIN_LOGIN:'admin',ADMIN_ROLE:'ADMIN_CONTROL',
 AUDIT_TAB:'_BXCT_PARAMS_AUDIT',AUTH_MODE:'PREPARATION_INTERNE',LIMIT_AGENTS:400
});
function BXCT_PARAMS_CONFIG_retour_(ok,code,data){
 return {ok:!!ok,code:String(code||''),message:ok?'OK':'Operation refusee ou indisponible',data:data||null};
}
