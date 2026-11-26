/** Lecteur de la file : exclusivement via la passerelle signee CONTROL->CLIENT. */
function BXCT_L6_DATA_lireFile_(contexte,filtre){
  return BXCT_L8_TRANSPORT_appeler_('FILE',contexte,filtre);
}
