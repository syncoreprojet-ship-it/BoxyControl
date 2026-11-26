/**
 * BOXY CONTROL | Lot 7 | Validation stricte des identifiants et des demandes.
 * Depend de: BXCT_L6_Config, BXCT_L7_Config.
 * Utilise par: BXCT_L7_Api.
 */
function BXCT_L7_VALIDATION_dossier_(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source))
    throw new Error('BXCT_L7_DOSSIER_INVALIDE');
  const id = String(source.inscriptionId || '').trim();
  const code = String(source.codePublic || '').trim().toUpperCase();
  const prestation = String(source.codePrestation || '').trim().toUpperCase();
  // L'identifiant technique permanent est obligatoire, jamais le code recycle seul.
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(id) ||
      !/^[A-Z0-9][A-Z0-9.:-]{3,99}$/.test(code) ||
      !BXCT_L6_PRESTATIONS_.includes(prestation))
    throw new Error('BXCT_L7_DOSSIER_INVALIDE');
  return {inscriptionId:id,codePublic:code,codePrestation:prestation};
}
function BXCT_L7_VALIDATION_action_(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source))
    throw new Error('BXCT_L7_ACTION_INVALIDE');
  const dossier = BXCT_L7_VALIDATION_dossier_(source);
  const action = String(source.action || '').trim().toUpperCase();
  const motif = String(source.motif || '').trim();
  const resultat = String(source.resultat || '').trim().toUpperCase();
  const note = String(source.note || '').trim();
  const revision = String(source.versionDossier || '').trim();
  const cle = String(source.cleIdempotence || '').trim();
  if (!['CONFIRMER','ANNULER','RAPPEL'].includes(action) || note.length > 300 ||
      !/^[A-Za-z0-9-]{12,80}$/.test(cle) ||
      (revision && !/^[A-Za-z0-9_.:-]{1,80}$/.test(revision)))
    throw new Error('BXCT_L7_ACTION_INVALIDE');
  if (action === 'CONFIRMER' && !BXCT_L7_MOTIFS_CONFIRMATION_.includes(motif))
    throw new Error('BXCT_L7_MOTIF_CONFIRMATION_INVALIDE');
  if (action === 'ANNULER' && (motif.length < 8 || motif.length > 300))
    throw new Error('BXCT_L7_MOTIF_ANNULATION_INVALIDE');
  if (action === 'RAPPEL' && (!BXCT_L7_RESULTATS_RAPPEL_.includes(resultat) || note.length > 300))
    throw new Error('BXCT_L7_RAPPEL_INVALIDE');
  if (action === 'ANNULER' && source.confirmerAnnulation !== true)
    throw new Error('BXCT_L7_CONFIRMATION_EXPLICITE_REQUISE');
  const dateRendezVous=String(source.dateRendezVous||'').trim();
  const heureRendezVous=String(source.heureRendezVous||'').trim();
  const codeSession=String(source.codeSession||'').trim().toUpperCase();
  if(dateRendezVous&&!/^\d{4}-\d{2}-\d{2}$/.test(dateRendezVous))
    throw new Error('BXCT_L7_DATE_INVALIDE');
  if(heureRendezVous&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(heureRendezVous))
    throw new Error('BXCT_L7_HEURE_INVALIDE');
  if(codeSession&&!/^[A-Z0-9_-]{3,60}$/.test(codeSession))
    throw new Error('BXCT_L7_SESSION_INVALIDE');
  return {dossier:dossier, action:action, motif:motif, resultat:resultat,
    note:note, versionDossier:revision, cleIdempotence:cle,
    dateRendezVous:dateRendezVous,heureRendezVous:heureRendezVous,codeSession:codeSession};
}
