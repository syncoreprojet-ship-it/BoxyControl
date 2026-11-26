/** BOXY CONTROL - catalogue des prix officiels venant de BOXY CLIENT. */
const BXCT_T3_VERSION_='1.2.0-rc1';
const BXCT_T3_CLIENT_ID_='11fPRIUaBQNKmo-xVf3mDj7Z-gZytcNUsFQNo9it9l0Q';
const BXCT_T3_SPECS_=Object.freeze([
  {name:'FORFAITS_PHOTO',u:'PHOTO',kind:'forfait',head:['code_forfait','code_type','libelle','photos_incluses','duree_minutes','prix_fcfa','description','ordre','actif','tarif_valide'],code:0,title:2,amount:5,active:8,validation:9,scope:1},
  {name:'TARIFS_PHOTO',u:'PHOTO',kind:'unite',head:['code_tarif','code_type','mode_tarif','prix_unitaire_fcfa','minimum_photos','ordre','actif','tarif_valide'],code:0,title:2,amount:3,active:6,validation:7,scope:1},
  {name:'OPTIONS_PHOTO',u:'PHOTO',kind:'option',head:['code_option','code_type','libelle','mode_applicable','unite','prix_unitaire_fcfa','quantite_min','quantite_max','ordre','actif','tarif_valide'],code:0,title:2,amount:5,active:9,validation:10,scope:1},
  {name:'TARIFS_ACADEMIE',u:'ACADEMIE',kind:'formation',head:['code_tarif','code_formation','code_session','prix_fcfa','devise','version_tarif','validation','actif','ordre','note_interne'],code:0,title:1,amount:3,active:7,validation:6,scope:2,version:5},
  {name:'MODALITES_ACADEMIE',u:'ACADEMIE',kind:'modalite',head:['code_modalite','libelle','type_modalite','code_formation','code_session','ordre','validation','actif','note_interne'],code:0,title:1,active:7,validation:6,scope:3},
  {name:'ECHEANCES_ACADEMIE',u:'ACADEMIE',kind:'echeance',head:['code_modalite','ordre_echeance','pourcentage','declencheur','decalage_jours','libelle_public','validation','actif'],code:0,title:5,amount:2,active:7,validation:6,scope:0},
  {name:'REMISES_ACADEMIE',u:'ACADEMIE',kind:'remise',head:['code_remise','code_formation','code_session','libelle','type_remise','valeur','plafond_fcfa','date_debut','date_fin','validation','actif','note_interne'],code:0,title:3,amount:5,active:10,validation:9,scope:1}
]);
