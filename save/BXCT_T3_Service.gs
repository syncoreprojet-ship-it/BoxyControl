/** Lire et auditer uniquement apres authentification Google OIDC. */
function BXCT_T3_SERVICE_context_(token,univers){
  if(!['PHOTO','ACADEMIE'].includes(univers))throw new Error('TARIFS_UNIVERS_INVALIDE');
  const identity=verifyGoogleIdToken_(token);
  const book=controlWorkbook_();
  const settings=readControlSettings_(book);
  const agent=findEnabledAgent_(book,identity);
  const rights=loadRolePermissions_(book,agent.role);
  if(settings.APP_MODE!=='PRODUCTION'||PropertiesService.getScriptProperties().getProperty('CONTROL_USE_TEST_SHEET')==='OUI')
    throw new Error('TARIFS_PRODUCTION_REQUISE');
  if(settings.CLIENT_SPREADSHEET_ID!==BXCT_T3_CLIENT_ID_)
    throw new Error('TARIFS_CLIENT_OFFICIEL_REQUIS');
  if(univers==='PHOTO' && !(settings.RECHERCHE_CLIENT_ACTIVE==='OUI' && rights.includes('CONSULTER_DEMANDE')))
    throw new Error('TARIFS_DROIT_PHOTO_REQUIS');
  if(univers==='ACADEMIE' && !(settings.ACADEMIE_LECTURE_ACTIVE==='OUI' && rights.includes('CONSULTER_ACADEMIE')))
    throw new Error('TARIFS_DROIT_ACADEMIE_REQUIS');
  return {book:book,settings:settings,agent:agent};
}
function BXCT_T3_SERVICE_table_(source,spec){
  const sh=source.getSheetByName(spec.name);
  if(!sh||sh.getLastRow()<1||sh.getLastRow()>501)throw new Error('TARIFS_SOURCE_INDISPONIBLE');
  const head=sh.getRange(1,1,1,spec.head.length).getDisplayValues()[0];
  if(JSON.stringify(head)!==JSON.stringify(spec.head))throw new Error('TARIFS_SCHEMA_INCOMPATIBLE');
  return sh.getLastRow()===1?[]:sh.getRange(2,1,sh.getLastRow()-1,spec.head.length).getValues();
}
function BXCT_T3_SERVICE_fingerprint_(spec,row){
  const canonical=JSON.stringify([spec.name,row[spec.code],row[spec.scope],spec.amount===undefined?null:row[spec.amount],
    spec.name==='FORFAITS_PHOTO'?row[3]+'|'+row[4]:null]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,canonical,Utilities.Charset.UTF_8)
    .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('').slice(0,18);
}
function BXCT_T3_SERVICE_lire_(ctx,univers){
  const source=ouvrirSourceClientPhoto_(ctx.settings);
  if(source.getId()!==BXCT_T3_CLIENT_ID_)throw new Error('TARIFS_SOURCE_INATTENDUE');
  const params=source.getSheetByName('PARAMETRES');
  if(!params)throw new Error('TARIFS_PARAMETRES_CLIENT');
  const conf=params.getRange(2,1,Math.max(1,params.getLastRow()-1),2).getDisplayValues();
  const flags=Object.fromEntries(conf.map(r=>[String(r[0]),String(r[1])]));
  const all=[],seen=new Set();
  BXCT_T3_SPECS_.filter(s=>s.u===univers).forEach(spec=>{
    BXCT_T3_SERVICE_table_(source,spec).forEach(row=>{
      const code=String(row[spec.code]||'').trim();
      if(!code||row[spec.active]!=='OUI'||row[spec.validation]!=='VALIDE')return;
      if(!/^[A-Z0-9_-]{1,85}$/.test(code))throw new Error('TARIFS_CODE_INVALIDE');
      const dedup=spec.name+'|'+code+'|'+String(row[spec.scope]||'');
      if(spec.name!=='ECHEANCES_ACADEMIE'&&seen.has(dedup))throw new Error('TARIFS_DOUBLON_ACTIF');
      seen.add(dedup);
      const raw=spec.amount===undefined?null:Number(row[spec.amount]);
      if(spec.amount!==undefined&&(!Number.isSafeInteger(raw)||raw<0||raw>100000000))
        throw new Error('TARIFS_MONTANT_INVALIDE');
      if(spec.name==='REMISES_ACADEMIE'){
        const kind=String(row[4]);
        if(!['FIXE','POURCENT'].includes(kind) || !(raw>0) || (kind==='POURCENT'&&raw>100))
          throw new Error('TARIFS_REMISE_INVALIDE');
        if(/fictif|exemple|non officiel|a valider|à valider/i.test(String(row[3]||'')+' '+String(row[11]||'')))
          throw new Error('TARIFS_REMISE_FICTIVE');
        const start=String(row[7]||''),end=String(row[8]||'');
        const iso=/^\d{4}-\d{2}-\d{2}$/;
        if((start&&!iso.test(start))||(end&&!iso.test(end))||(start&&end&&start>end))
          throw new Error('TARIFS_PERIODE_REMISE_INVALIDE');
        const today=Utilities.formatDate(new Date(),'Africa/Bamako','yyyy-MM-dd');
        // Remise approuvee mais pas encore applicable / deja expiree.
        if((start&&today<start)||(end&&today>end))return;
      }
      if(spec.name==='TARIFS_ACADEMIE'){
        if(String(row[4])!=='XOF'||!Number.isSafeInteger(Number(row[5]))||Number(row[5])<1)
          throw new Error('TARIFS_VERSION_INVALIDE');
        if(/fictif|exemple|non officiel/i.test(String(row[9]||'')))throw new Error('TARIFS_NOTE_PROVISOIRE');
      }
      const line={univers:univers,categorie:spec.kind,code:code,
        titre:String(row[spec.title]||code).slice(0,130),
        portee:String(row[spec.scope]||'').slice(0,65),
        montant:raw,unite:spec.kind==='echeance'||(spec.kind==='remise'&&row[4]==='POURCENT')?'POURCENT':spec.kind==='modalite'?'AUCUNE':'FCFA',
        referenceVersion:spec.version!==undefined?'v'+String(row[spec.version]):BXCT_T3_SERVICE_fingerprint_(spec,row),
        source:spec.name};
      if(spec.name==='TARIFS_ACADEMIE')line.formation=String(row[1]);
      if(spec.name==='MODALITES_ACADEMIE')line.formation=String(row[3]);
      if(spec.name==='REMISES_ACADEMIE'){
        line.formation=String(row[1]);line.session=String(row[2]);line.typeRemise=String(row[4]);
        line.plafondFcfa=Number(row[6]||0);
      }
      if(spec.name==='FORFAITS_PHOTO'){line.photos=Number(row[3]);line.dureeMinutes=Number(row[4]);}
      all.push(line);
    });
  });
  return {tarifs:all,ouverturePublicClient:flags.PUBLIC_LANCEMENT_AUTORISE==='OUI',
    inscriptionsClient:flags.INSCRIPTIONS_ACTIVES==='OUI'};
}
function BXCT_T3_SERVICE_audit_(ctx,univers,count){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('TARIFS_AUDIT_OCCUPE');
  try{
  const sh=ctx.book.getSheetByName('AUDIT');
  const head=['audit_id','horodatage_utc','agent_id','action','inscription_id','transaction_id','resultat','correlation_id','empreinte_donnees','note_securisee'];
  if(!sh||JSON.stringify(sh.getRange(1,1,1,10).getDisplayValues()[0])!==JSON.stringify(head))
    throw new Error('TARIFS_AUDIT_INDISPONIBLE');
  const eid='AUD-'+Utilities.getUuid();
  const n=sh.getLastRow()+1;
  sh.getRange(n,1,1,10).setValues([[eid,new Date().toISOString(),ctx.agent.agentId,
    'CONSULTATION_TARIFS_OFFICIELS','','','OK',Utilities.getUuid(),'',
    'Univers '+univers+' / '+count+' references / lecture seule']]);
  SpreadsheetApp.flush();
  if(sh.getRange(n,1).getValue()!==eid)throw new Error('TARIFS_AUDIT_NON_PERSISTE');
  }finally{lock.releaseLock();}
}
function BXCT_T3_SERVICE_catalogue_(token,univers){
  const choice=String(univers||'PHOTO').trim().toUpperCase();
  const ctx=BXCT_T3_SERVICE_context_(token,choice);
  BXCT_L3_SERVICE_limite_(ctx.agent);
  const data=BXCT_T3_SERVICE_lire_(ctx,choice);
  BXCT_T3_SERVICE_audit_(ctx,choice,data.tarifs.length);
  return {ok:true,code:'TARIFS_CONTROL_OK',version:BXCT_T3_VERSION_,univers:choice,
    tarifs:data.tarifs,lectureSeule:true,autoritePrix:'BOXY_CLIENT',
    ouverturePublicClient:data.ouverturePublicClient,inscriptionsClient:data.inscriptionsClient,
    message:data.tarifs.length?'Tarifs approuves et actifs de BOXY CLIENT':'Aucun tarif approuve et actif'};
}
