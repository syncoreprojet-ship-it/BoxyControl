/** BOXY CONTROL — LOT 3/4 · Flux des inscriptions CLIENT (lecture seule).
 * Dépendances explicites : Code.gs et Recherche_Photo.gs déjà installés.
 * Une seule source métier : BOXY_CLIENT.INSCRIPTIONS.
 */
const BXCT_L3_VERSION_ = '1.2.0-rc1';
const BXCT_L3_REQUIRED_ = Object.freeze([
  'inscription_id','code_public','cree_le_utc','code_prestation',
  'nom_client','code_session','details_json','statut','maj_le_utc'
]);
const BXCT_L3_LIMIT_ = 20;
const BXCT_L3_MAX_LIMIT_ = 30;
const BXCT_L3_MAX_SCAN_ = 240;
