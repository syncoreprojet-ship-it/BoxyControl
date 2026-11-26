function BXCT_ENC_VALIDATION_filter_(input) {
  const r=input||{},prestation=r.prestation||'TOUTES',page=r.page===undefined?0:r.page;
  if(!['TOUTES','PHOTO','FORMATION'].includes(prestation)||!Number.isSafeInteger(page)||page<0||page>300)throw new Error('FILTRE_INVALIDE');
  return {prestation,page};
}
