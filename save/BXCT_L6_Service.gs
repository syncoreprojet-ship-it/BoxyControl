/** Service unique FILE : session BOXY -> ROLES -> validation -> HMAC -> retour lecture seule. */
function BXCT_L6_SERVICE_lireFile_(googleIdToken,options){
  const contexte=BXCT_L6_AUTH_contexte_(googleIdToken);
  const filtre=BXCT_L6_VALIDATION_options_(options);
  const portee=BXCT_L8_AUTH_portee_(contexte);
  if(filtre.prestation!=='TOUS'&&!portee.includes(filtre.prestation))
    throw new Error('BXCT_L8_AUTORISATION_REFUSEE');
  const lecture=BXCT_L6_DATA_lireFile_(contexte,filtre);
  if(!lecture.ok)return lecture;
  if(!lecture.sourceReady)return {ok:true,code:'BXCT_L6_SOURCE_NON_CONNECTEE',
    version:BXCT_L6_VERSION_,sourceReady:false,lectureSeule:true,
    totalEnAttente:null,dossiers:[],curseurSuivant:null,majUtc:null};
  if(!Array.isArray(lecture.dossiers) || !Number.isSafeInteger(lecture.totalEnAttente) ||
      lecture.totalEnAttente<0 || !Number.isSafeInteger(lecture.totalFiltres) ||
      lecture.totalFiltres<0 || ![null,undefined].includes(lecture.curseurSuivant) &&
      (!Number.isSafeInteger(lecture.curseurSuivant) || lecture.curseurSuivant<0))
    throw new Error('BXCT_L6_REPONSE_CLIENT_INVALIDE');
  if(lecture.dossiers.length>filtre.limite)
    throw new Error('BXCT_L6_REPONSE_CLIENT_INVALIDE');
  return {ok:true,code:'BXCT_L6_FILE_CONNECTEE',version:BXCT_L6_VERSION_,
    sourceReady:true,lectureSeule:true,totalEnAttente:lecture.totalEnAttente,
    dossiers:lecture.dossiers,curseurSuivant:lecture.curseurSuivant,
    totalFiltres:lecture.totalFiltres,majUtc:lecture.majUtc};
}
