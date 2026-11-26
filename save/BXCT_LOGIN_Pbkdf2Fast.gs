/**
 * BOXY CONTROL | AUTH | PBKDF2-HMAC-SHA256 in-process implementation.
 * This avoids 120,000 Apps Script Utilities.computeHmacSha256Signature calls
 * for a single password operation, which can exhaust Apps Script runtimes.
 * The byte-level PBKDF2 result is the same as the existing credential format.
 * Depends on: Utilities.base64Encode; called by BXCT_LOGIN_Crypto.gs.
 * Only public module contract: BXCT_LOGIN_FAST_pbkdf2_.
 */
var BXCT_LOGIN_FAST_K_ = Object.freeze([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
function BXCT_LOGIN_FAST_sha256_(source) {
  var n=source.length,total=(n+9+63)&~63,data=new Uint8Array(total);
  for(var i=0;i<n;i++)data[i]=source[i]&255;
  data[n]=128;
  var hi=Math.floor(n/536870912),lo=(n*8)>>>0;
  data[total-8]=(hi>>>24)&255;data[total-7]=(hi>>>16)&255;
  data[total-6]=(hi>>>8)&255;data[total-5]=hi&255;
  data[total-4]=(lo>>>24)&255;data[total-3]=(lo>>>16)&255;
  data[total-2]=(lo>>>8)&255;data[total-1]=lo&255;
  var state=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Int32Array(64);
  for(var off=0;off<total;off+=64){
    for(var j=0;j<16;j++){
      var p=off+j*4;
      w[j]=(data[p]<<24)|(data[p+1]<<16)|(data[p+2]<<8)|data[p+3];
    }
    for(var j=16;j<64;j++){
      var z=w[j-15],y=w[j-2],s0=((z>>>7)|(z<<25))^((z>>>18)|(z<<14))^(z>>>3),
        s1=((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10);
      w[j]=(w[j-16]+s0+w[j-7]+s1)|0;
    }
    var a=state[0],b=state[1],c=state[2],d=state[3],
      e=state[4],f=state[5],g=state[6],h=state[7];
    for(var t=0;t<64;t++){
      var t1=(h+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+
        ((e&f)^(~e&g))+BXCT_LOGIN_FAST_K_[t]+w[t])|0;
      var t2=((((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))+
        ((a&b)^(a&c)^(b&c)))|0;
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    state[0]=(state[0]+a)|0;state[1]=(state[1]+b)|0;
    state[2]=(state[2]+c)|0;state[3]=(state[3]+d)|0;
    state[4]=(state[4]+e)|0;state[5]=(state[5]+f)|0;
    state[6]=(state[6]+g)|0;state[7]=(state[7]+h)|0;
  }
  var out=new Uint8Array(32);
  for(var i=0;i<8;i++){
    out[i*4]=(state[i]>>>24)&255;out[i*4+1]=(state[i]>>>16)&255;
    out[i*4+2]=(state[i]>>>8)&255;out[i*4+3]=state[i]&255;
  }
  return out;
}
function BXCT_LOGIN_FAST_pbkdf2_(passwordBytes,saltBytes,iterations){
  if(!Number.isInteger(iterations)||iterations<100000||iterations>1000000)
    throw new Error('COUT_KDF_INVALIDE');
  var key=passwordBytes.length>64?BXCT_LOGIN_FAST_sha256_(passwordBytes):passwordBytes;
  var ipad=new Uint8Array(64),opad=new Uint8Array(64);
  ipad.fill(0x36);opad.fill(0x5c);
  for(var i=0;i<key.length;i++){ipad[i]^=key[i];opad[i]^=key[i];}
  function hmac(message){
    var input=new Uint8Array(64+message.length);input.set(ipad);input.set(message,64);
    var hash=BXCT_LOGIN_FAST_sha256_(input),outer=new Uint8Array(96);
    outer.set(opad);outer.set(hash,64);
    return BXCT_LOGIN_FAST_sha256_(outer);
  }
  var salt1=new Uint8Array(saltBytes.length+4);salt1.set(saltBytes);
  salt1[saltBytes.length+3]=1;
  var u=hmac(salt1),out=new Uint8Array(u);
  for(var j=1;j<iterations;j++){
    u=hmac(u);
    for(var k=0;k<32;k++)out[k]^=u[k];
  }
  return Utilities.base64Encode(Array.from(out));
}
