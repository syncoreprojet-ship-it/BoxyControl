/** SERVICE — une seule entrée métier et aucun effet financier ou opérationnel. */
function BXCT_L3_SERVICE_lister_(token, entree) {
  if (!entree || typeof entree !== 'object' || Array.isArray(entree)) throw new Error('LOT3_FILTRE_INVALIDE');
  const univers=String(entree.univers||'TOUS').trim().toUpperCase();
  if(!['TOUS','PHOTO','ACADEMIE'].includes(univers)) throw new Error('LOT3_FILTRE_INVALIDE');
  const n=entree.limite===undefined?BXCT_L3_LIMIT_:Number(entree.limite);
  if(!Number.isInteger(n)||n<1||n>BXCT_L3_MAX_LIMIT_)throw new Error('LOT3_LIMITE_INVALIDE');
  const curs=entree.curseur;
  const cursor=(curs===null||curs===undefined||curs==='')?null:Number(curs);
  if(cursor!==null&&(!Number.isInteger(cursor)||cursor<2||cursor>25001))throw new Error('LOT3_CURSEUR_INVALIDE');
  const ctx=BXCT_L3_AUTH_contexte_(token,univers);
  BXCT_L3_SERVICE_limite_(ctx.agent);
  const resultat=BXCT_L3_DATA_inscriptions_(ctx,univers,cursor,n);
  // Indispensable avant de retourner la liste : échoue fermé si audit indisponible.
  BXCT_L3_AUDIT_consultation_(ctx.control,ctx.agent,univers,resultat.lignes.length?'OK':'VIDE',resultat.lignes.length);
  return {ok:true,code:'LOT3_LISTE_OK',version:BXCT_L3_VERSION_,
    source:resultat.source,lectureSeule:true,univers:univers,
    droits:ctx.droits,dossiers:resultat.lignes,curseurSuivant:resultat.suivant,
    aSuivre:resultat.suivant!==null};
}
function BXCT_L3_SERVICE_limite_(agent) {
  const verrou=LockService.getScriptLock();
  if(!verrou.tryLock(2000))throw new Error('LOT3_SERVICE_OCCUPE');
  try{
    const cache=CacheService.getScriptCache();
    const key='lot3_flux_'+String(agent.agentId||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,50);
    const current=Number(cache.get(key)||'0');
    if(current>=12)throw new Error('LOT3_TROP_DE_CONSULTATIONS');
    cache.put(key,String(current+1),60);
  } finally{verrou.releaseLock();}
}
