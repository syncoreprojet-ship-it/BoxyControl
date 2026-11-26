/** Same read gates as academyFinanceActive; no PHOTO rights required. */
function BXCT_ENC_ACADEMY_DESK_permission_(ctx){
  if(!ctx.rights.includes('CONSULTER_FINANCES_ACADEMIE')||!BXCT_CORE_AUTH_financeRead_(ctx,false))throw new Error('AUTORISATION_REFUSEE');
}
