/** Permissions fines selon la prestation, au serveur CONTROL uniquement. */
function BXCT_L8_AUTH_portee_(contexte){
  const d=contexte.droits||[],role=String(contexte.role||'');
  const supervisor=['SUPERVISEUR','ADMIN_CONTROL'].includes(role);
  const allowed=[];
  if(d.includes('CONSULTER_DEMANDE'))allowed.push('SHOOTING');
  if(d.includes('CONSULTER_INSCRIPTION_ACADEMIE'))allowed.push('FORMATION');
  if(d.includes('CONSULTER_DEMANDE')&&supervisor)
    allowed.push('MARIAGE','CASTING','VIDEO','CONTENU','STUDIO','EVENT');
  if(!allowed.length)throw new Error('BXCT_L8_AUTORISATION_REFUSEE');
  return allowed;
}
function BXCT_L8_AUTH_decision_(contexte,prestation,action){
  const portee=BXCT_L8_AUTH_portee_(contexte);
  if(!portee.includes(prestation))throw new Error('BXCT_L8_AUTORISATION_REFUSEE');
  if(action==='RAPPEL')return;
  const droits=contexte.droits||[],role=String(contexte.role||'');
  const admin=['SUPERVISEUR','ADMIN_CONTROL'].includes(role);
  if(prestation==='FORMATION'&&!(admin&&droits.includes('DECIDER_INSCRIPTION_ACADEMIE')))
    throw new Error('BXCT_L8_AUTORISATION_REFUSEE');
  if(prestation!=='FORMATION'&&(!droits.includes('CONFIRMER_RESERVATION')||
      (prestation!=='SHOOTING'&&!admin)))
    throw new Error('BXCT_L8_AUTORISATION_REFUSEE');
}
