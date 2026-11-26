/**
 * BOXY CONTROL | LOGIN | cryptographie locale.
 * Depend de: BXCT_LOGIN_Config.gs, Utilities Google Apps Script.
 * Utilise par: BXCT_LOGIN_Auth, BXCT_LOGIN_Service et BXCT_LOGIN_Setup.
 * Aucun mot de passe ou jeton en clair n'est conserve dans Sheets ou Properties.
 */
function BXCT_LOGIN_CRYPTO_octets_(s) {
  return Utilities.newBlob(String(s), 'text/plain').getBytes().map(function(b){return b & 255;});
}
function BXCT_LOGIN_CRYPTO_hmac_(bytes, key) {
  return Utilities.computeHmacSha256Signature(bytes, key).map(function(b){return b & 255;});
}
function BXCT_LOGIN_CRYPTO_pbkdf2_(password, salt64, iterations) {
  var n = Number(iterations);
  if (!Number.isInteger(n) || n < BXCT_LOGIN_CONFIG_.ITERATIONS || n > 1000000)
    throw new Error('COUT_KDF_INVALIDE');
  var salt = Utilities.base64Decode(String(salt64)).map(function(b){return b & 255;});
  if (salt.length < 16) throw new Error('SEL_INVALIDE');
  // Same standard PBKDF2-HMAC-SHA256 output, computed entirely in V8.
  // No per-iteration Apps Script service calls (previous bootstrap timeout).
  return BXCT_LOGIN_FAST_pbkdf2_(BXCT_LOGIN_CRYPTO_octets_(password), salt, n);
}
function BXCT_LOGIN_CRYPTO_aleatoire_() {
  // UUID v4 fournis par l'environnement Apps Script ; 4 valeurs independantes.
  var v = '';
  for (var i=0; i<4; i++) v += Utilities.getUuid().replace(/-/g,'');
  if (!/^[a-f0-9]{128}$/i.test(v)) throw new Error('ALEA_INDISPONIBLE');
  return v.toLowerCase();
}
function BXCT_LOGIN_CRYPTO_salt_() {
  var h = BXCT_LOGIN_CRYPTO_aleatoire_().slice(0,64);
  var arr=[]; for (var i=0; i<h.length; i+=2) arr.push(parseInt(h.slice(i,i+2),16));
  return Utilities.base64Encode(arr);
}
function BXCT_LOGIN_CRYPTO_hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, BXCT_LOGIN_CRYPTO_octets_(s))
    .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
}
function BXCT_LOGIN_CRYPTO_egal_(a,b) {
  var x=String(a||''),y=String(b||''),n=Math.max(x.length,y.length),diff=x.length^y.length;
  for(var i=0;i<n;i++) diff|=(x.charCodeAt(i)||0)^(y.charCodeAt(i)||0);
  return diff===0;
}
function BXCT_LOGIN_CRYPTO_passwordValide_(s) {
  if(typeof s!=='string'||s.length<BXCT_LOGIN_CONFIG_.PASSWORD_MIN||s.length>256||
     !/[a-z]/.test(s)||!/[A-Z]/.test(s)||!/[0-9]/.test(s)||!/[^a-zA-Z0-9]/.test(s))
    throw new Error('MOT_DE_PASSE_TROP_FAIBLE');
  return s;
}
function BXCT_LOGIN_CRYPTO_credential_(password, changeRequired) {
  BXCT_LOGIN_CRYPTO_passwordValide_(password);
  var salt=BXCT_LOGIN_CRYPTO_salt_();
  return {algorithm:BXCT_LOGIN_CONFIG_.KDF,iterations:BXCT_LOGIN_CONFIG_.ITERATIONS,
    salt:salt,hash:BXCT_LOGIN_CRYPTO_pbkdf2_(password,salt,BXCT_LOGIN_CONFIG_.ITERATIONS),
    revision:BXCT_LOGIN_CRYPTO_aleatoire_().slice(0,32),mustChange:!!changeRequired};
}
function BXCT_LOGIN_CRYPTO_verifier_(password, c) {
  if(!c||c.algorithm!==BXCT_LOGIN_CONFIG_.KDF||
     c.iterations!==BXCT_LOGIN_CONFIG_.ITERATIONS||!c.salt||!c.hash) return false;
  return BXCT_LOGIN_CRYPTO_egal_(BXCT_LOGIN_CRYPTO_pbkdf2_(password,c.salt,c.iterations),c.hash);
}
function BXCT_LOGIN_CRYPTO_motDePasseTemporaire_() {
  return 'Bx!'+BXCT_LOGIN_CRYPTO_aleatoire_().slice(0,36)+'aZ9!';
}
