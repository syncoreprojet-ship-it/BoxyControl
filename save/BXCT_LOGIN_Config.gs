/**
 * BOXY CONTROL | LOGIN INITIAL v7.0.5-rc2 | configuration autonome.
 * Depend de: aucun. Utilise par: BXCT_LOGIN_*.
 * Authentification locale = identifiant/mot de passe, SANS Google OIDC.
 * Les autorisations existantes dans ROLES restent la seule source de droits.
 */
var BXCT_LOGIN_CONFIG_ = Object.freeze({
  VERSION: '7.0.8-rc2',
  KDF: 'PBKDF2-HMAC-SHA256', ITERATIONS: 120000,
  SESSION_MS: 20 * 60 * 1000,
  RATE_WINDOW_MS: 15 * 60 * 1000, RATE_MAX: 5, GLOBAL_RATE_MAX: 60,
  PASSWORD_MIN: 12,
  ADMIN_ID: 'ADMIN-001', ADMIN_LOGIN: 'admin', ADMIN_ROLE: 'ADMIN_CONTROL',
  PROP_PREFIX: 'BXCT_LOGIN_V1_',
  AUDIT_TAB: '_BXCT_LOGIN_AUDIT'
});
function BXCT_LOGIN_CONFIG_normaliserLogin_(value) {
  var v = String(value || '').normalize('NFKC').trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(v)) throw new Error('IDENTIFIANT_INVALIDE');
  return v;
}
function BXCT_LOGIN_CONFIG_authOuverte_(settings) {
  return settings.AUTH_MODE === 'LOCAL_PASSWORD' &&
    settings.AGENTS_AUTHENTIFIES === 'OUI' && settings.AGENTS_PROVISIONNES === 'OUI';
}
function BXCT_LOGIN_CONFIG_reponse_(ok, code, data) {
  return {ok: !!ok, code: String(code), data: data || null};
}
