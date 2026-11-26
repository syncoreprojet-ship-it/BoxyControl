/** Verification de schema idempotente, sans creation de registre concurrent.
 * Lancer uniquement depuis editeur Apps Script; aucune mutation. */
function BXCT_ENC_SETUP_(){
  const book=controlWorkbook_();BXCT_ENC_DATA_schema_(book,true);
  const out={ok:true,version:BXCT_ENC_VERSION_,schemaVersion:BXCT_ENC_SCHEMA_VERSION_,ecritureActive:false};console.log(JSON.stringify(out));return out;
}

/** Point d entree public de diagnostic, sans mutation ni donnees client. */
function BXCT_ENC_SETUP(){return BXCT_ENC_SETUP_();}
