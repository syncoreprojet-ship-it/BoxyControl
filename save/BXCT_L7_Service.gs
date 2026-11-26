/** SERVICE: decisions relevent uniquement du writer officiel BOXY CLIENT. */
function BXCT_L7_SERVICE_lireDossier_(contexte,identite){
  const result=BXCT_L7_DATA_lireDossier_(contexte,identite);
  if(!result.ok)return result;
  if(!result.sourceReady)return {ok:true,code:'BXCT_L7_SOURCE_NON_CONNECTEE',
    sourceReady:false,lectureSeule:true,dossier:null,rappels:[]};
  return {ok:true,code:'BXCT_L7_DOSSIER_CONNECTE',sourceReady:true,
    lectureSeule:false,dossier:result.dossier,rappels:result.rappels||[]};
}
function BXCT_L7_SERVICE_traiter_(contexte,action){
  if(!BXCT_L8_CONFIG_active_())return {ok:false,code:'BXCT_L7_ACTION_DESACTIVEE',
    sourceReady:false,actionEnregistree:false};
  return BXCT_L7_DATA_traiter_(contexte,action);
}
