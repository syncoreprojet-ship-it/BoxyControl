function BXCT_FORM_ADMIN_VALIDATION_body_(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||!['SEED','VISIBILITY','EDIT_FIELD'].includes(input.action))throw new Error('REQUETE_INVALIDE');
  const expected=input.action==='SEED'?'action':input.action==='VISIBILITY'?'action|code|expected|visible':'action|code|expected|field|value';
  if(Object.keys(input).sort().join('|')!==expected)throw new Error('REQUETE_INVALIDE');
  if(input.action==='VISIBILITY'&&(typeof input.code!=='string'||!/^[A-Z0-9_-]{2,70}$/.test(input.code)||!['OUI','NON'].includes(input.expected)||!['OUI','NON'].includes(input.visible)||input.code==='CREATION_CONTENU'))throw new Error('REQUETE_INVALIDE');
  if(input.action==='EDIT_FIELD'){
    if(typeof input.code!=='string'||!/^[A-Z0-9_-]{2,70}$/.test(input.code)||input.code==='CREATION_CONTENU'||!['TITLE','DESCRIPTION','ORDER'].includes(input.field)||typeof input.expected!=='string'||typeof input.value!=='string'||input.expected.length>700)throw new Error('REQUETE_INVALIDE');
    const v=input.value,limit=input.field==='TITLE'?120:700;
    if(input.field==='ORDER'){if(!/^[1-9][0-9]{0,2}$/.test(v))throw new Error('REQUETE_INVALIDE');}
    else if(v!==v.trim()||(!v&&input.field==='TITLE')||v.length>limit||/^[=+@-]/.test(v)||/[\x00-\x1f\x7f]/.test(v))throw new Error('REQUETE_INVALIDE');
  }
  return Object.assign({},input);
}
