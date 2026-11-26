/** LOT2: seul SUPER_ADMIN peut administrer les comptes; aucun droit CONTROL implicitement active. */
function ADMIN_L2_PERMISSIONS_comptes_(user){
  if(!user||user.statut!=='ACTIF'||user.role_principal!=='SUPER_ADMIN'||user.doit_changer_mdp==='OUI')
    throw ADMIN_L2_CONFIG_erreur_('ACCES_REFUSE');
  return true;
}
