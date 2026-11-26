/**
 * BOXY CONTROL - Liaison officielle CLIENT / lot 2 sur 7 - v7.0.10-rc2.
 * Un seul circuit de production, sans duplication de la passerelle L8.
 * Aucune ouverture de permission ni action metier pendant cette brique.
 * Depends: Code.gs, BXCT_L8_Auth.gs.
 */
const BXCT_SYNC_L2_LIVE_VERSION_ = '7.0.10-rc2';
const BXCT_SYNC_L2_LIVE_CLIENT_ID_ = '11fPRIUaBQNKmo-xVf3mDj7Z-gZytcNUsFQNo9it9l0Q';
const BXCT_SYNC_L2_LIVE_OPS_ = Object.freeze(['FILE', 'DOSSIER']);

/** Refuse les mutations et la moindre lecture par un chemin de test mal dirige. */
function BXCT_SYNC_L2_LIVE_autoriserTransport_(operation, contexte) {
  if (BXCT_SYNC_L2_LIVE_OPS_.indexOf(String(operation || '')) < 0)
    throw new Error('BXCT_SYNC_L2_ECRITURES_FERMEES');
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('CONTROL_USE_TEST_SHEET') === 'OUI')
    throw new Error('BXCT_SYNC_L2_CLASSEUR_TEST_REFUSE');
  const ss = controlWorkbook_();
  if (!ss || ss.getId() !== BOXY_CONTROL_SHEET_ID_)
    throw new Error('BXCT_SYNC_L2_SOURCE_CONTROL_INVALIDE');
  const settings = readControlSettings_(ss);
  if (settings.CLIENT_SPREADSHEET_ID !== BXCT_SYNC_L2_LIVE_CLIENT_ID_)
    throw new Error('BXCT_SYNC_L2_SOURCE_CLIENT_INVALIDE');
  if (settings.AUTH_MODE !== 'LOCAL_PASSWORD' ||
      settings.AGENTS_AUTHENTIFIES !== 'OUI')
    throw new Error('BXCT_SYNC_L2_LOGIN_REQUIS');
  if (!contexte || typeof contexte !== 'object' ||
      !/^[A-Za-z0-9_:-]{2,80}$/.test(String(contexte.agentId || '')) ||
      !Array.isArray(contexte.droits))
    throw new Error('BXCT_SYNC_L2_CONTEXTE_NON_AUTHENTIFIE');
  // L'authentification de session et les droits viennent de L6/L7 AUTH,
  // puis la portee par prestation reste verifiee par BXCT_L8_AUTH_portee_.
  return true;
}
