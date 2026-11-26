/** BOXY CONTROL | PARAMETRES | Validation uniquement serveur.
 * Depend de: aucune. Utilise par: BXCT_PARAMS_Service.gs.
 */
function BXCT_PARAMS_VALIDATION_saisie_(payload,roles){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('SAISIE_INVALIDE');
 var name=String(payload.nom||'').trim().replace(/\s+/g,' ');
 var login=String(payload.identifiant||'').trim().toLowerCase();
 var role=String(payload.role||'').trim().toUpperCase();
 if(name.length<2||name.length>80||/[\x00-\x1f]/.test(name))throw new Error('NOM_INVALIDE');
 if(!/^[a-z][a-z0-9._-]{2,31}$/.test(login))throw new Error('IDENTIFIANT_INVALIDE');
 if(roles.indexOf(role)<0)throw new Error('ROLE_INVALIDE');
 if(typeof payload.actif!=='boolean')throw new Error('ACTIF_INVALIDE');
 var note=String(payload.note||'').trim();
 if(note.length>200||/[\x00-\x1f]/.test(note))throw new Error('NOTE_INVALIDE');
 // Eviter les formules lors des ecritures de noms/notes libres dans Sheets.
 var neutralise=function(s){return /^[=+@-]/.test(s)?"'"+s:s;};
 return {nom:neutralise(name),identifiant:login,role:role,actif:payload.actif,note:neutralise(note)};
}
