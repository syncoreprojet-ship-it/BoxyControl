/** Lecture authentifiee; erreurs internes non divulguees. */
function BXCT_ENC_LIRE(token,input){
  try{
    const ctx=BXCT_ENC_AUTH_context_(token);BXCT_ENC_PERMISSIONS_read_(ctx);
    const filter=BXCT_ENC_VALIDATION_filter_(input);
    return {ok:true,code:'OK',message:'Lecture seule',data:BXCT_ENC_SERVICE_read_(ctx,filter)};
  }catch(e){return {ok:false,code:'LECTURE_REFUSEE',message:'Acces refuse ou registre indisponible.',data:null};}
}
