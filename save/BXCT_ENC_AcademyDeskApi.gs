/** Desk read-only. Depends on ENC auth, permissions, validation, canonical service. */
function BXCT_ENC_ACADEMY_DESK_LIRE(token,input){
  try{
    const ctx=BXCT_ENC_AUTH_context_(token);
    BXCT_ENC_ACADEMY_DESK_permission_(ctx);
    const filter=BXCT_ENC_ACADEMY_DESK_filter_(input);
    return {ok:true,code:'OK',message:'Lecture seule',data:BXCT_ENC_SERVICE_read_(ctx,filter)};
  }catch(e){return {ok:false,code:'LECTURE_REFUSEE',message:'Acces refuse ou registre indisponible.',data:null};}
}
