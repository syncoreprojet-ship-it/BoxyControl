/** Lecture des feuilles CLIENT existantes; aucune écriture directe inter-projets. */
function BXCT_FORM_ADMIN_DATA_read_(source){
  const categories=BXCT_CORE_DATA_readTable_(source,'CATEGORIES_ACADEMIE',['code_categorie','libelle','actif'],150);
  const sh=source.getSheetByName('FORMATIONS_ACADEMIE');
  if(!sh||![16,17].includes(sh.getLastColumn()))throw new Error('CATALOGUE_INCOHERENT');
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  const expected=['code_formation','code_categorie','titre','slug','niveau','objectif','public_cible','prerequis','materiel','duree_heures_indicative','modalite_indicative','prix_fcfa','ordre','validation_fiche','visible_public','version_fiche'];
  const hasVitrine=headers.length===17;
  if(hasVitrine)expected.push('visible_vitrine');
  if(JSON.stringify(headers)!==JSON.stringify(expected))throw new Error('CATALOGUE_INCOHERENT');
  const fields=['code_formation','code_categorie','titre','objectif','ordre','validation_fiche','visible_public'];
  if(hasVitrine)fields.push('visible_vitrine');
  const formations=BXCT_CORE_DATA_readTable_(source,'FORMATIONS_ACADEMIE',fields,350);
  const ids=new Set(),cat=new Map();
  categories.forEach(c=>{if(!/^[A-Z0-9_-]{2,70}$/.test(c.code_categorie)||cat.has(c.code_categorie))throw new Error('CATALOGUE_INCOHERENT');cat.set(c.code_categorie,c.libelle);});
  return formations.map(f=>{if(!/^[A-Z0-9_-]{2,70}$/.test(f.code_formation)||ids.has(f.code_formation)||!cat.has(f.code_categorie))throw new Error('CATALOGUE_INCOHERENT');ids.add(f.code_formation);
    if(hasVitrine&&!['','OUI','NON'].includes(f.visible_vitrine))throw new Error('CATALOGUE_INCOHERENT');
    return {code:f.code_formation,titre:f.titre,categorie:cat.get(f.code_categorie),description:f.objectif,ordre:f.ordre,validation:f.validation_fiche,visiblePublic:f.visible_public,visibleVitrine:hasVitrine?f.visible_vitrine:'',inscription:f.code_formation==='CREATION_CONTENU'?'PARCOURS_HISTORIQUE':'VERROUILLEE'};
  }).sort((a,b)=>{if(a.code==='CREATION_CONTENU')return -1;if(b.code==='CREATION_CONTENU')return 1;const x=v=>/^\d+$/.test(v)?Number(v):Number.MAX_SAFE_INTEGER;return x(a.ordre)-x(b.ordre)||a.code.localeCompare(b.code);});
}

/** Diagnostic du journal CLIENT, sans l'initialiser ni exposer les agents. */
function BXCT_FORM_ADMIN_DATA_audit_(source){
  const sh=source.getSheetByName('BXCL_FORM_ADMIN_AUDIT');
  if(!sh)return {present:false,evenements:0,anomalies:0};
  if(sh.getLastRow()<1||sh.getLastRow()>10001||sh.getLastColumn()!==7||sh.getRange(1,1,1,7).getDisplayValues()[0].join('|')!=='date_utc|request_id|agent_id|action|code_formation|phase|detail')return {present:true,evenements:0,anomalies:1};
  const n=sh.getLastRow()-1,events=new Map();let anomalies=0;
  const rows=n?sh.getRange(2,1,n,7).getDisplayValues():[];
  rows.forEach(r=>{
    if(!r.some(Boolean))return;
    let detail;try{detail=JSON.parse(r[6]);}catch(e){anomalies++;return;}
    const phase=r[5],old=events.get(r[1]);
    if(!/^[A-F0-9-]{36}$/.test(r[1])||!detail||!/^[a-f0-9]{64}$/.test(detail.fingerprint||'')){anomalies++;return;}
    if(phase==='INTENTION'||phase==='SANS_CHANGEMENT'){if(old)anomalies++;}
    else if(!['APPLIQUE','A_VERIFIER'].includes(phase)||!old||old.phase!=='INTENTION'||old.fingerprint!==detail.fingerprint)anomalies++;
    events.set(r[1],{phase,fingerprint:detail.fingerprint});
  });
  events.forEach(e=>{if(!['APPLIQUE','SANS_CHANGEMENT'].includes(e.phase))anomalies++;});
  return {present:true,evenements:events.size,anomalies};
}
