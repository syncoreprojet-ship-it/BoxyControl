/** Contrat UI stable; toutes les mutations exigent session, rôle, mode et opt-in. */
function BXCT_FORM_ADMIN_LIST(token){
  try{return {ok:true,code:'CATALOGUE_OK',message:'Catalogue officiel CLIENT.',data:BXCT_FORM_ADMIN_SERVICE_list_(BXCT_FORM_ADMIN_AUTH_context_(token))};}
  catch(e){return {ok:false,code:'CATALOGUE_INDISPONIBLE',message:'Accès refusé ou catalogue indisponible.',data:null};}
}
function BXCT_FORM_ADMIN_CHANGE(token,input){
  try{return BXCT_FORM_ADMIN_SERVICE_change_(BXCT_FORM_ADMIN_AUTH_context_(token),input);}
  catch(e){return {ok:false,code:'MODIFICATION_REFUSEE',message:'Modification refusée ou liaison TEST indisponible.',data:null};}
}
