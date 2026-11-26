/**
 * BOXY CONTROL | SYNC CLIENT | Lot 1/7 - v7.0.9-rc1
 * Contrat: controle structurel des deux COPIES TEST uniquement.
 * Depend de: Apps Script SpreadsheetApp et Session; aucun module metier.
 * Utilise par: BXCT_SYNC_L1_Audit.gs.
 * Aucun transport HMAC, changement de droits ni ecriture.
 */
const BXCT_SYNC_L1_CONFIG_ = Object.freeze({
  VERSION: '7.0.9-rc1',
  CONTROL_TEST_ID: '11okNL6OMeAvTn68GW6ktBzoV79vfNEY1Yl29tCdPmQM',
  CLIENT_TEST_ID: '1luxbfMP8RXmc4kGn5a6QVnjUNdiLmYXuNk4qC2wxyJU',
  CONTROL_TEST_NAME: 'BOXY_CONTROL_TEST_L1',
  CLIENT_TEST_NAME: 'BOXY_CLIENT_TEST_L1',
  PRESTATIONS: Object.freeze(['SHOOTING','FORMATION','MARIAGE','CASTING','VIDEO','CONTENU','STUDIO','EVENT']),
  CONTROL_SCHEMAS: Object.freeze({
    '_BXCT_PARAMS_AUDIT': ['date_utc','action','acteur','agent_id','detail'],
    '_BXCT_LOGIN_AUDIT': ['date_utc','evenement','agent_id','resultat','code'],
    'AGENTS': ['agent_id','nom_affiche','email_ou_identifiant','role','actif'],
    'ROLES': ['role','autorisation','description','active']
  }),
  CLIENT_SCHEMAS: Object.freeze({
    'INSCRIPTIONS': ['inscription_id','code_public','cree_le_utc','code_prestation','origine','nom_client','telephone','email','code_session','details_json','consentement','statut','synchro_statut','reference_control','reference_admin','cle_idempotence','version_schema','maj_le_utc'],
    'SUIVI_PUBLIC': ['inscription_id','statut_dossier','statut_reservation','statut_paiement','date_confirmee','heure_confirmee','maj_le_utc','reference_control','version_projection','dernier_evenement_control'],
    'BXCL_L8_RAPPELS': ['rappel_id','inscription_id','code_public','code_prestation','resultat','note','agent_id','horodatage_utc','empreinte'],
    'BXCL_SYNC5_CONFIG': ['cle','valeur','maj_le_utc','version_schema'],
    'BXCL_SYNC5_JOURNAL': ['evenement_id','inscription_id','code_public','code_prestation','type_evenement','version_source','horodatage_source_utc','etat_traitement','details_techniques_json','maj_le_utc'],
    'CODES_BOXY': ['code_public','code_prestation','numero','inscription_id_actuel','etat_code','cree_le_utc','maj_le_utc','version_schema'],
    'CODES_BOXY_HISTORIQUE': ['evenement_id','code_public','code_prestation','numero','inscription_id','action','horodatage_utc','acteur','details_json'],
    'CODES_BOXY_CONFIG': ['cle','valeur','maj_le_utc','version_schema']
  })
});
