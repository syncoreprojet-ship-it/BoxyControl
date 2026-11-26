/** Fixed server-side scope; never accepts a requested prestation. */
function BXCT_ENC_ACADEMY_DESK_filter_(input){
  const r=input||{};
  if(typeof r!=='object'||Array.isArray(r)||Object.prototype.hasOwnProperty.call(r,'prestation'))throw new Error('FILTRE_INVALIDE');
  const f=BXCT_ENC_VALIDATION_filter_({prestation:'FORMATION',page:r.page});
  const view=r.view===undefined?'HISTORIQUE':r.view;
  if(!['HISTORIQUE','ATTENTE','SOLDES','RECUS'].includes(view))throw new Error('FILTRE_INVALIDE');
  const code=r.code===undefined?'':r.code;
  if(typeof code!=='string'||(code!==''&&!/^BX\.FOR\.[A-Z0-9]{2,20}$/.test(code)))throw new Error('CODE_INVALIDE');
  return {...f,desk:true,view,code};
}
