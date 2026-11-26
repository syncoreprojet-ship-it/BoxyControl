/**
 * BOXY CONTROL / Sync Lot 2/7.
 * Editor-only diagnostics against the separate CLIENT TEST deployment.
 * No login, agent or business permission is modified.
 * Depends on: BXCT_SYNC_L2_Config.gs and shared BXCT_L8_Transport.gs.
 */
function BXCT_SYNC_L2_AUDIT_SANS_ECRITURE(){
  try{
    const cfg=BXCT_SYNC_L2_CONFIG_verifier_();
    const report={ok:true,code:'BXCT_SYNC_L2_PRET_POUR_PING',
      version:BXCT_SYNC_L2_CONFIG_.VERSION,
      environnement:'COPIES_TEST',secretConfigure:!!cfg.secret,
      urlTestConfiguree:!!cfg.url,lectureSeule:true,
      testHttpEffectue:false,ecritureEffectuee:false};
    console.log(JSON.stringify(report));return report;
  }catch(e){return BXCT_SYNC_L2_AUDIT_echec_(e);}
}
/** Signed HTTP read of an empty TEST queue. Never calls CLIENT production. */
function BXCT_SYNC_L2_TESTER_LIAISON(){
  try{
    const cfg=BXCT_SYNC_L2_CONFIG_verifier_();
    const result=BXCT_L8_TRANSPORT_envoyer_('FILE',
      BXCT_SYNC_L2_CONFIG_contexte_(),BXCT_SYNC_L2_CONFIG_filtre_(),cfg);
    if(result.ok!==true||result.sourceReady!==true||result.lectureSeule!==true||
       result.testBridge!=='BXCL_SYNC_L2_TEST_ONLY'||
       !Array.isArray(result.dossiers)||result.dossiers.length!==0||
       result.totalEnAttente!==0)
      throw new Error('BXCT_SYNC_L2_REPONSE_TEST_INCOMPATIBLE');
    const report={ok:true,code:'BXCT_SYNC_L2_HMAC_TEST_OK',
      version:BXCT_SYNC_L2_CONFIG_.VERSION,
      signature:'HMAC_SHA256',client:'COPIE_TEST',operation:'FILE',
      dossiersTest:0,ecritureEffectuee:false};
    console.log(JSON.stringify(report));return report;
  }catch(e){return BXCT_SYNC_L2_AUDIT_echec_(e);}
}
/** Tests: tampered signature, replay and forbidden signed write. */
function BXCT_SYNC_L2_TESTER_REFUS(){
  try{
    const cfg=BXCT_SYNC_L2_CONFIG_verifier_();
    const ctx=BXCT_SYNC_L2_CONFIG_contexte_();
    const body=BXCT_SYNC_L2_CONFIG_filtre_();
    const signed=BXCT_L8_TRANSPORT_enveloppe_('FILE',ctx,body,cfg.secret);
    const bad=Object.assign({},signed,{sig:(signed.sig[0]==='0'?'1':'0')+signed.sig.slice(1)});
    const corrupted=BXCT_L8_TRANSPORT_http_(cfg.url,bad);
    if(corrupted.ok!==false||corrupted.code!=='BXCL_L8_SIGNATURE_REFUSEE')
      throw new Error('BXCT_SYNC_L2_SIGNATURE_NON_REFUSEE');
    const first=BXCT_L8_TRANSPORT_http_(cfg.url,signed);
    if(first.ok!==true||first.testBridge!=='BXCL_SYNC_L2_TEST_ONLY')
      throw new Error('BXCT_SYNC_L2_PREMIERE_LECTURE_REFUSEE');
    const replay=BXCT_L8_TRANSPORT_http_(cfg.url,signed);
    if(replay.ok!==false||replay.code!=='BXCL_L8_REJEU_TRANSPORT')
      throw new Error('BXCT_SYNC_L2_REJEU_NON_REFUSE');
    const forbidden=BXCT_L8_TRANSPORT_envoyer_('DECISION',ctx,
      {action:'CONFIRMER'},cfg);
    if(forbidden.ok!==false||forbidden.code!=='BXCL_SYNC_L2_LECTURE_SEULE')
      throw new Error('BXCT_SYNC_L2_ECRITURE_NON_REFUSEE');
    const old=BXCT_L8_TRANSPORT_enveloppe_('FILE',ctx,body,cfg.secret,
      Date.now()-600000);
    const expired=BXCT_L8_TRANSPORT_http_(cfg.url,old);
    if(expired.ok!==false||expired.code!=='BXCL_L8_REQUETE_INVALIDE')
      throw new Error('BXCT_SYNC_L2_HORODATAGE_NON_REFUSE');
    const report={ok:true,code:'BXCT_SYNC_L2_REFUS_OK',
      signatureAlteree:true,rejeu:true,decisionRefusee:true,
      horodatageExpire:true,ecritureMetierEffectuee:false};
    console.log(JSON.stringify(report));return report;
  }catch(e){return BXCT_SYNC_L2_AUDIT_echec_(e);}
}
function BXCT_SYNC_L2_AUDIT_echec_(e){
  const raw=String(e&&e.message||e);
  const code=/^BXCT_[A-Z0-9_]+$/.test(raw)?raw:'BXCT_SYNC_L2_ECHEC';
  const r={ok:false,code:code,ecritureEffectuee:false};
  console.warn(code);return r;
}
