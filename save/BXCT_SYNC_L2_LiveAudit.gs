/**
 * BOXY CONTROL - Audit de la liaison HMAC officielle, SANS ECRITURE / SANS HTTP.
 * A executer manuellement dans l'editeur : BXCT_SYNC_L2_AUDIT_SANS_ECRITURE().
 * Fichier : BXCT_SYNC_L2_LiveAudit.gs.
 * Aucun dossier, identifiant client, secret HMAC ou URL ne figure dans le retour.
 */
function BXCT_SYNC_L2_AUDIT_SANS_ECRITURE() {
  let code = 'BXCT_SYNC_L2_NON_PRET';
  try {
    const p=PropertiesService.getScriptProperties();
    if (p.getProperty('CONTROL_USE_TEST_SHEET') === 'OUI')
      throw new Error('BXCT_SYNC_L2_CLASSEUR_TEST_REFUSE');
    const ss=controlWorkbook_();
    if (ss.getId() !== BOXY_CONTROL_SHEET_ID_)
      throw new Error('BXCT_SYNC_L2_SOURCE_CONTROL_INVALIDE');
    const active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
    const owner=ss.getOwner&&ss.getOwner();
    const ownerMail=owner&&String(owner.getEmail()||'').trim().toLowerCase();
    if (!active || active!==ownerMail)throw new Error('BXCT_SYNC_L2_PROPRIETAIRE_REQUIS');
    const flags=readControlSettings_(ss);
    if(flags.CLIENT_SPREADSHEET_ID !== BXCT_SYNC_L2_LIVE_CLIENT_ID_)
      throw new Error('BXCT_SYNC_L2_SOURCE_CLIENT_INVALIDE');
    if(flags.AUTH_MODE !== 'LOCAL_PASSWORD' || flags.AGENTS_AUTHENTIFIES !== 'OUI')
      throw new Error('BXCT_SYNC_L2_LOGIN_REQUIS');
    if(typeof BXCT_L8_TRANSPORT_appeler_!=='function' ||
       typeof BXCT_SYNC_L2_LIVE_autoriserTransport_!=='function')
      throw new Error('BXCT_SYNC_L2_DEPENDANCE_MANQUANTE');
    if(!BXCT_L8_CONFIG_active_())throw new Error('BXCT_SYNC_L2_HMAC_NON_CONFIGURE');
    const result={ok:true,code:'BXCT_SYNC_L2_PRODUCTION_PRETE',version:BXCT_SYNC_L2_LIVE_VERSION_,
      mode:'CLASSEURS_OFFICIELS',lectureSeule:true,ecritureEffectuee:false,appelHttpEffectue:false};
    console.log(JSON.stringify(result));return result;
  } catch(e) {
    const raw=String(e&&e.message||e);
    code=/^BXCT_SYNC_L2_[A-Z0-9_]+$/.test(raw)?raw:'BXCT_SYNC_L2_AUDIT_REFUSE';
    const result={ok:false,code:code,version:BXCT_SYNC_L2_LIVE_VERSION_,
      lectureSeule:true,ecritureEffectuee:false,appelHttpEffectue:false};
    console.log(JSON.stringify(result));return result;
  }
}
