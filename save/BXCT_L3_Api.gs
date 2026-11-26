/** Contrat public : UI -> API -> AUTH -> SERVICE -> DATA -> AUDIT.
 * Toujours token Google vérifié sur le serveur. */
function BXCT_L3_LISTER_DOSSIERS(googleIdToken,options) {
  return BXCT_L3_SERVICE_lister_(googleIdToken,options);
}
/** Diagnostic privé, intentionnellement absent des appels google.script.run. */
function BXCT_L3_DIAGNOSTIC_() {
  const c=controlWorkbook_(),p=readControlSettings_(c);
  const source=ouvrirSourceClientPhoto_(p),f=source.getSheetByName('INSCRIPTIONS');
  const result={version:BXCT_L3_VERSION_,mode:p.APP_MODE,
    sourceClientLiee:source.getName()==='BOXY_CLIENT',
    schemaInscriptions:!!f&&f.getLastColumn()>=18?'PRESENT':'INCOMPLET',
    dossiersSource:f?Math.max(0,f.getLastRow()-1):null,
    lecturePhotoActive:p.RECHERCHE_CLIENT_ACTIVE==='OUI',
    lectureAcademieActive:p.ACADEMIE_RECHERCHE_ACTIVE==='OUI',
    paiementsActifs:p.PAIEMENTS_ACTIFS==='OUI'};
  console.log(JSON.stringify(result));
  return result;
}
