/**
 * AUTH du setup et des diagnostics manuels (editeur Apps Script uniquement).
 * Ne fournit aucune route navigateur. Revalide le proprietaire du classeur OFFICIEL.
 * Depend de : Code.gs et BXCT_SYNC_L2_LiveConfig.
 * La configuration du transport HMAC est controlee UNIQUEMENT au moment du ping
 * ou de la lecture. Le setup ROLES est local a CONTROL et ne depend pas du HMAC.
 */
function BXCT_SYNC_L3_AUTH_proprietaire_(){
  const book=controlWorkbook_();
  if(!book || book.getId()!==BOXY_CONTROL_SHEET_ID_)
    throw new Error('BXCT_SYNC_L3_CLASSEUR_NON_OFFICIEL');
  const email=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  const effective=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
  const owner=book.getOwner&&book.getOwner();
  const ownerEmail=owner&&String(owner.getEmail()||'').trim().toLowerCase();
  if(!email||!ownerEmail||email!==ownerEmail||effective!==ownerEmail)
    throw new Error('BXCT_SYNC_L3_PROPRIETAIRE_REQUIS');
  const flags=readControlSettings_(book);
  if(flags.APP_MODE!=='PRODUCTION'||flags.AUTH_MODE!=='LOCAL_PASSWORD'||
     flags.AGENTS_AUTHENTIFIES!=='OUI'||
     flags.CLIENT_SPREADSHEET_ID!==BXCT_SYNC_L2_LIVE_CLIENT_ID_)
    throw new Error('BXCT_SYNC_L3_CONFIG_INCOMPATIBLE');
  return {book:book,acteur:email};
}
