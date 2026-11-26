/** Adapte les donnees du dossier depuis CLIENT sans acces Sheets direct. */
function BXCT_L7_DATA_lireDossier_(contexte,identite){
  BXCT_L8_AUTH_decision_(contexte,identite.codePrestation,'RAPPEL');
  return BXCT_L8_TRANSPORT_appeler_('DOSSIER',contexte,identite);
}
function BXCT_L7_DATA_traiter_(contexte,action){
  BXCT_L8_AUTH_decision_(contexte,action.dossier.codePrestation,action.action);
  const body={inscriptionId:action.dossier.inscriptionId,
    codePublic:action.dossier.codePublic,codePrestation:action.dossier.codePrestation,
    action:action.action,cleIdempotence:action.cleIdempotence,
    versionDossier:action.versionDossier,motif:action.motif,
    resultat:action.resultat,note:action.note,
    confirmerAnnulation:action.action==='ANNULER',
    dateRendezVous:action.dateRendezVous||'',
    heureRendezVous:action.heureRendezVous||'',codeSession:action.codeSession||''};
  return BXCT_L8_TRANSPORT_appeler_(action.action==='RAPPEL'?'RAPPEL':'DECISION',contexte,body);
}
