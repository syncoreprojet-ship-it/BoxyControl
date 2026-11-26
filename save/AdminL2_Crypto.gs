/**
 * BOXY ADMIN LOT 2 - KDF. PBKDF2-HMAC-SHA256, bloc 1 / 256 bits.
 * Dependant de : Utilities Apps Script. Aucune ecriture, aucune journalisation.
 * Parametres testables avec vecteurs RFC 6070 adaptes HMAC-SHA256.
 */
function ADMIN_L2_CRYPTO_octets_(s){return Utilities.newBlob(String(s),'text/plain').getBytes().map(function(v){return v&255;});}
function ADMIN_L2_CRYPTO_hmac_(value,key){return Utilities.computeHmacSha256Signature(value,key).map(function(v){return v&255;});}
function ADMIN_L2_CRYPTO_pbkdf2_(password,saltB64,iterations){
  var n=Number(iterations);
  if (!Number.isInteger(n)||n<1||n>1000000) throw ADMIN_L2_CONFIG_erreur_('KDF_PARAMETRES_INCORRECTS');
  var salt=Utilities.base64Decode(String(saltB64)).map(function(v){return v&255;});
  if(salt.length<16)throw ADMIN_L2_CONFIG_erreur_('SEL_INSUFFISANT');
  var key=ADMIN_L2_CRYPTO_octets_(password);
  var u=ADMIN_L2_CRYPTO_hmac_(salt.concat([0,0,0,1]),key);
  var t=u.slice();
  for(var i=1;i<n;i++){
    u=ADMIN_L2_CRYPTO_hmac_(u,key);
    for(var j=0;j<32;j++)t[j]^=u[j];
  }
  return Utilities.base64Encode(t);
}
function ADMIN_L2_CRYPTO_salt_(){
  // Deux UUID v4 independants : au moins 244 bits aleatoires si l'implementation
  // de Google fournit des UUID v4. Contrat a verifier en production.
  var hex=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
  if(!/^[0-9a-f]{64}$/i.test(hex)) throw ADMIN_L2_CONFIG_erreur_('ENTROPIE_INDISPONIBLE');
  var bytes=[];for(var i=0;i<hex.length;i+=2)bytes.push(parseInt(hex.slice(i,i+2),16));
  return Utilities.base64Encode(bytes);
}
function ADMIN_L2_CRYPTO_jeton_(){
  var parts=[];for(var i=0;i<4;i++)parts.push(Utilities.getUuid().replace(/-/g,''));
  var token=parts.join('');
  if(!/^[a-f0-9]{128}$/i.test(token))throw ADMIN_L2_CONFIG_erreur_('ENTROPIE_INDISPONIBLE');
  return token;
}
function ADMIN_L2_CRYPTO_empreinte_(s){
  var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,ADMIN_L2_CRYPTO_octets_(s));
  return bytes.map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
}
function ADMIN_L2_CRYPTO_equals_(a,b){
  var x=String(a||''),y=String(b||''),diff=x.length^y.length;
  for(var i=0;i<Math.max(x.length,y.length);i++)diff|=(x.charCodeAt(i)||0)^(y.charCodeAt(i)||0);
  return diff===0;
}
function ADMIN_L2_CRYPTO_identifiant_(s){
  var v=String(s||'').normalize('NFKC').trim().toLowerCase();
  if(!/^[a-z][a-z0-9._-]{3,31}$/.test(v))throw ADMIN_L2_CONFIG_erreur_('IDENTIFIANT_INVALIDE');
  return v;
}
function ADMIN_L2_CRYPTO_passwordValide_(pass){
  var p=String(pass||'');
  if(p.length<ADMIN_L2_CONFIG_.MIN_PASSWORD||p.length>256||!/[A-Z]/.test(p)||
    !/[a-z]/.test(p)||!/[0-9]/.test(p)||!/[^A-Za-z0-9]/.test(p))
    throw ADMIN_L2_CONFIG_erreur_('MOT_DE_PASSE_TROP_FAIBLE');
  return p;
}
function ADMIN_L2_CRYPTO_secretProvisoire_(){
  // Usage unique; jamais conserve en clair dans les fichiers, Sheets ou journaux.
  return 'Bx!'+ADMIN_L2_CRYPTO_jeton_().slice(0,40)+'aZ9!';
}
function ADMIN_L2_CRYPTO_hash_(password){
  var salt=ADMIN_L2_CRYPTO_salt_();var iterations=ADMIN_L2_CONFIG_.ITERATIONS;
  return {algorithme:ADMIN_L2_CONFIG_.KDF,sel_b64:salt,
    hachage_b64:ADMIN_L2_CRYPTO_pbkdf2_(password,salt,iterations),
    parametres_kdf_json:JSON.stringify({iterations:iterations,dkLen:32,version:1})};
}
function ADMIN_L2_CRYPTO_verifier_(password,creds){
  if(creds.algorithme!==ADMIN_L2_CONFIG_.KDF)return false;
  var p;try{p=JSON.parse(creds.parametres_kdf_json||'{}');}catch(e){return false;}
  if(!Number.isInteger(p.iterations)||p.iterations<ADMIN_L2_CONFIG_.MIN_ITERATIONS||p.iterations>1000000||p.dkLen!==32)return false;
  var actual=ADMIN_L2_CRYPTO_pbkdf2_(password,creds.sel_b64,p.iterations);
  return ADMIN_L2_CRYPTO_equals_(actual,creds.hachage_b64);
}
