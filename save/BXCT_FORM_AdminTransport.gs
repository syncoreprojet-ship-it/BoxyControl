/** Même format HMAC L8; chemin de recette distinct, sans élargir la passerelle historique. */
function BXCT_FORM_ADMIN_TRANSPORT_send_(ctx,source,body){
  if(!BXCT_FORM_ADMIN_AUTH_write_(ctx)||!/^BOXY_CLIENT_TEST(?:\b|_|\s)/.test(source.getName()))throw new Error('ECRITURES_FERMEES');
  const request={issuer:'BOXY_CONTROL',schema:1,requestId:Utilities.getUuid().toUpperCase(),ts:Date.now(),operation:'CATALOGUE_FORM_ADMIN',agentId:ctx.agent.agentId,prestations:['FORMATION'],body:Object.assign({},body,{target:source.getId()})};
  const r=BXCT_L8_TRANSPORT_envoyerSigne_(request);
  if(!r||typeof r.ok!=='boolean'||typeof r.code!=='string'||!/^BXCL_L8_[A-Z0-9_]+$/.test(r.code))throw new Error('CLIENT_REPONSE_INVALIDE');
  return {ok:r.ok,code:r.code,message:r.ok?'Catalogue TEST mis à jour.':'Opération refusée côté CLIENT.',data:r.ok?r.data:null};
}
