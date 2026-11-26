/**
 * BOXY CONTROL | File CLIENT | v7.0.11-rc1 (synchronisation lot 3/7).
 * Contrat conserve : BXCT_L6_LIRE_FILE(token, options).
 * Lecture directe INTERDITE : seul BXCT_L8_Transport signe appelle BOXY CLIENT.
 * SOURCE_CONNECTEE signifie "service raccorde", pas "liaison HTTP active".
 */
const BXCT_L6_VERSION_ = '7.0.11-rc1';
const BXCT_L6_SOURCE_CONNECTEE_ = true;
const BXCT_L6_MAX_AFFICHAGE_ = 200;
const BXCT_L6_PRESTATIONS_ = Object.freeze([
  'SHOOTING','FORMATION','MARIAGE','CASTING','VIDEO','CONTENU','STUDIO','EVENT'
]);
