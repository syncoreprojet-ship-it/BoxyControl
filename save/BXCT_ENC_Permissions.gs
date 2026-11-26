/** Vue globale reservee aux roles de supervision avec les deux droits historiques. */
function BXCT_ENC_PERMISSIONS_read_(ctx) {
  if(!['ADMIN_CONTROL','SUPERVISEUR'].includes(ctx.agent.role)||!['CONSULTER_PAIEMENTS','CONSULTER_FINANCES_ACADEMIE'].every(p=>ctx.rights.includes(p))||!BXCT_CORE_AUTH_financeRead_(ctx,true))throw new Error('AUTORISATION_REFUSEE');
}
