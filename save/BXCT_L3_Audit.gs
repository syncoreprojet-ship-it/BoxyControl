/** AUDIT — seule écriture du LOT 3, dans CONTROL.AUDIT.
 * Aucun code public, téléphone, nom ou détail client n'est journalisé. */
function BXCT_L3_AUDIT_consultation_(control, agent, univers, etat, nb) {
  const f=control.getSheetByName('AUDIT');
  if(!f) throw new Error('LOT3_AUDIT_INDISPONIBLE');
  const horodatage=new Date().toISOString();
  const correlation=Utilities.getUuid();
  try{
    f.appendRow(['AUD-'+Utilities.getUuid(),horodatage,agent.agentId,
      'CONSULTATION_LISTE_CLIENT','', '',etat,correlation,'',
      'Univers '+univers+' | '+Math.min(30,Math.max(0,Number(nb)||0))+' ligne(s) | lecture seule']);
  } catch(e){throw new Error('LOT3_AUDIT_INDISPONIBLE');}
}
