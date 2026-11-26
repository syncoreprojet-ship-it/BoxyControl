/** BOXY CONTROL | PARAMETRES | SEUL adaptateur DATA d'ecriture.
 * Depend de: Config, Code.gs/controlWorkbook_. Utilise par: Service.
 * Sources de verite: AGENTS A:I, ROLES A:D, PARAMETRES A:D, _BXCT_PARAMS_AUDIT A:E.
 */
function BXCT_PARAMS_DATA_agentsSheet_(book){
 var sh=book.getSheetByName('AGENTS');if(!sh)throw new Error('AGENTS_ABSENTS');
 var h=sh.getRange(1,1,1,9).getDisplayValues()[0];
 var want=['agent_id','nom_affiche','email_ou_identifiant','role','actif','date_creation_utc','derniere_connexion_utc','note_interne','google_sub'];
 if(want.some(function(k,i){return h[i]!==k;}))throw new Error('SCHEMA_AGENTS_INCOMPATIBLE');
 return sh;
}
function BXCT_PARAMS_DATA_agents_(book){
 var sh=BXCT_PARAMS_DATA_agentsSheet_(book),last=sh.getLastRow();
 if(last-1>BXCT_PARAMS_CONFIG_.LIMIT_AGENTS)throw new Error('LIMITE_AGENTS');
 var rows=last>=2?sh.getRange(2,1,last-1,9).getDisplayValues():[];
 return rows.map(function(r,i){return {row:i+2,id:String(r[0]||'').trim(),nom:String(r[1]||'').trim(),
  identifiant:String(r[2]||'').trim().toLowerCase(),role:String(r[3]||'').trim(),
  actif:String(r[4]||'').trim()==='OUI',date:String(r[5]||'').trim(),
  derniereConnexion:String(r[6]||'').trim(),note:String(r[7]||'').trim(),
  googleSub:String(r[8]||'').trim()};});
}
function BXCT_PARAMS_DATA_roles_(book){
 var sh=book.getSheetByName('ROLES');if(!sh)throw new Error('ROLES_ABSENTS');
 var last=sh.getLastRow();var head=sh.getRange(1,1,1,4).getDisplayValues()[0];
 if(head[0]!=='role'||head[1]!=='autorisation'||head[3]!=='active')throw new Error('ROLES_SCHEMA_INVALIDE');
 var rows=last>1?sh.getRange(2,1,last-1,4).getDisplayValues():[];
 var m={};rows.forEach(function(r){var role=String(r[0]||'').trim();
  if(!role)return;if(!m[role])m[role]={code:role,regles:0,actives:0};
  m[role].regles++;if(String(r[3]||'').trim()==='OUI')m[role].actives++;
 });return Object.keys(m).sort().map(function(k){return m[k];});
}
function BXCT_PARAMS_DATA_audit_(book){
 var sh=book.getSheetByName(BXCT_PARAMS_CONFIG_.AUDIT_TAB);
 var head=['date_utc','action','acteur','agent_id','detail'];
 if(!sh){sh=book.insertSheet(BXCT_PARAMS_CONFIG_.AUDIT_TAB);
   sh.getRange(1,1,1,5).setValues([head]);sh.setFrozenRows(1);sh.hideSheet();}
 var h=sh.getRange(1,1,1,5).getDisplayValues()[0];
 if(head.some(function(k,i){return k!==h[i];}))throw new Error('AUDIT_SCHEMA_INVALIDE');
 return sh;
}
function BXCT_PARAMS_DATA_journaliser_(book,action,actor,agentId,detail){
 BXCT_PARAMS_DATA_audit_(book).appendRow([new Date().toISOString(),action,actor,agentId,detail||'']);
}
function BXCT_PARAMS_DATA_initialiserAdmin_(book,actor){
 var agents=BXCT_PARAMS_DATA_agents_(book),sameId=agents.filter(function(a){return a.id==='ADMIN-001';}),
 sameLogin=agents.filter(function(a){return a.identifiant==='admin';});
 if(sameId.length||sameLogin.length){
  if(sameId.length!==1||sameLogin.length!==1||sameId[0].row!==sameLogin[0].row||
    sameId[0].role!=='ADMIN_CONTROL')throw new Error('ADMIN_CONFLIT_VERIFIER');
  return 'DEJA_PRESENT';
 }
 var sh=BXCT_PARAMS_DATA_agentsSheet_(book);
 if(sh.getLastRow()>=sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),10);
 sh.appendRow(['ADMIN-001','Administrateur BOXY','admin','ADMIN_CONTROL','OUI',
  new Date().toISOString(),'','Compte initial de preparation - login non active','']);
 BXCT_PARAMS_DATA_journaliser_(book,'INSTALLATION_ADMIN',actor,'ADMIN-001','MODE_PREPARATION');
 return 'CREE';
}
/** Parametrage idempotent : jamais de rollback du login a la reouverture de Parametres. */
function BXCT_PARAMS_DATA_parametresPreparation_(book){
 var sh=book.getSheetByName('PARAMETRES');if(!sh)throw new Error('PARAMETRES_ABSENTS');
 var h=sh.getRange(1,1,1,4).getDisplayValues()[0];
 if(h.join('|')!=='cle|valeur|description|modifiable')throw new Error('PARAMETRES_SCHEMA_INVALIDE');
 var last=sh.getLastRow(),rows=last>1?sh.getRange(2,1,last-1,2).getDisplayValues():[];
 var indices={};['AUTH_MODE','AGENTS_AUTHENTIFIES','AGENTS_PROVISIONNES'].forEach(function(k){
  var hits=[];rows.forEach(function(r,i){if(r[0]===k)hits.push(i+2);});
  if(hits.length!==1)throw new Error('PARAMETRES_CLE_ABSENTE_OU_DOUBLE');indices[k]=hits[0];
 });
 var mode=String(rows[indices.AUTH_MODE-2][1]||'');
 var auth=String(rows[indices.AGENTS_AUTHENTIFIES-2][1]||'');
 if(mode==='LOCAL_PASSWORD'&&auth==='OUI'){
  if(String(rows[indices.AGENTS_PROVISIONNES-2][1]||'')!=='OUI')
   throw new Error('MODE_LOGIN_INCOHERENT');
  return 'LOGIN_DEJA_ACTIF';
 }
 if(mode==='LOCAL_PASSWORD'||auth==='OUI')throw new Error('MODE_LOGIN_INCOHERENT');
 var need={AUTH_MODE:'PREPARATION_INTERNE',AGENTS_AUTHENTIFIES:'NON',AGENTS_PROVISIONNES:'OUI'};
 Object.keys(need).forEach(function(k){
  if(rows[indices[k]-2][1]!==need[k])sh.getRange(indices[k],2).setValue(need[k]);
 });
 return 'PREPARATION_INTERNE';
}
/** Activation unique de l'auth locale ; service metier Parametres seul appelant. */
function BXCT_PARAMS_DATA_activerLogin_(book,actor){
 var sh=book.getSheetByName('PARAMETRES');if(!sh)throw new Error('PARAMETRES_ABSENTS');
 var h=sh.getRange(1,1,1,4).getDisplayValues()[0];
 if(h.join('|')!=='cle|valeur|description|modifiable')throw new Error('PARAMETRES_SCHEMA_INVALIDE');
 var last=sh.getLastRow(),data=sh.getRange(2,1,last-1,2).getDisplayValues(),idx={};
 ['AUTH_MODE','AGENTS_AUTHENTIFIES','AGENTS_PROVISIONNES'].forEach(function(k){
  var matches=[];data.forEach(function(r,i){if(r[0]===k)matches.push(i+2);});
  if(matches.length!==1)throw new Error('PARAMETRES_CLE_ABSENTE_OU_DOUBLE');
  idx[k]=matches[0];
 });
 var old={};Object.keys(idx).forEach(function(k){old[k]=String(data[idx[k]-2][1]||'');});
 if(old.AUTH_MODE==='LOCAL_PASSWORD'&&old.AGENTS_AUTHENTIFIES==='OUI'&&old.AGENTS_PROVISIONNES==='OUI')return 'DEJA_ACTIF';
 if(old.AUTH_MODE!=='PREPARATION_INTERNE'||old.AGENTS_AUTHENTIFIES!=='NON'||old.AGENTS_PROVISIONNES!=='OUI')
  throw new Error('MODE_LOGIN_INCOHERENT');
 var agent=BXCT_LOGIN_DATA_agentParId_(book,BXCT_PARAMS_CONFIG_.ADMIN_ID);
 if(!agent||!agent.active||agent.login!==BXCT_PARAMS_CONFIG_.ADMIN_LOGIN||agent.role!==BXCT_PARAMS_CONFIG_.ADMIN_ROLE)
  throw new Error('ADMIN_INITIAL_INATTENDU');
 var cred=BXCT_LOGIN_DATA_credential_(book.getId(),agent.id);
 if(!cred||cred.algorithm!==BXCT_LOGIN_CONFIG_.KDF||!cred.salt||!cred.hash||cred.mustChange)
  throw new Error('DEFINIR_MOT_DE_PASSE_ADMIN');
 // Le journal LOGIN est cree AVANT activation afin de permettre l'ouverture de session.
 BXCT_LOGIN_DATA_auditTab_(book,true);
 BXCT_PARAMS_DATA_audit_(book);
 try{
  sh.getRange(idx.AUTH_MODE,2).setValue('LOCAL_PASSWORD');
  sh.getRange(idx.AGENTS_AUTHENTIFIES,2).setValue('OUI');
  BXCT_PARAMS_DATA_journaliser_(book,'ACTIVER_LOGIN',actor,agent.id,'LOCAL_PASSWORD');
 }catch(e){
  try{sh.getRange(idx.AUTH_MODE,2).setValue(old.AUTH_MODE);
      sh.getRange(idx.AGENTS_AUTHENTIFIES,2).setValue(old.AGENTS_AUTHENTIFIES);}catch(ignore){}
  throw new Error('ACTIVATION_LOGIN_NON_CONFIRMEE');
 }
 return 'ACTIVE';
}

function BXCT_PARAMS_DATA_creerAgent_(book,agent,actor){
 var sh=BXCT_PARAMS_DATA_agentsSheet_(book),all=BXCT_PARAMS_DATA_agents_(book);
 if(all.length>=BXCT_PARAMS_CONFIG_.LIMIT_AGENTS)throw new Error('LIMITE_AGENTS');
 if(all.some(function(a){return a.identifiant===agent.identifiant;}))throw new Error('IDENTIFIANT_EXISTANT');
 var id='AGT-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
 if(all.some(function(a){return a.id===id;}))throw new Error('AGENT_ID_EXISTANT');
 if(sh.getLastRow()>=sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),10);
 sh.appendRow([id,agent.nom,agent.identifiant,agent.role,agent.actif?'OUI':'NON',
  new Date().toISOString(),'','Compte prepare - connexion non active'+(agent.note?' - '+agent.note:''),'']);
 BXCT_PARAMS_DATA_journaliser_(book,'CREER_AGENT',actor,id,'ROLE_'+agent.role);
 return id;
}
function BXCT_PARAMS_DATA_modifierAgent_(book,id,agent,actor){
 if(id===BXCT_PARAMS_CONFIG_.ADMIN_ID)throw new Error('ADMIN_INITIAL_PROTEGE');
 var all=BXCT_PARAMS_DATA_agents_(book),found=all.filter(function(a){return a.id===id;});
 if(found.length!==1)throw new Error('AGENT_INTROUVABLE');
 if(all.some(function(a){return a.id!==id&&a.identifiant===agent.identifiant;}))throw new Error('IDENTIFIANT_EXISTANT');
 var current=found[0],sh=BXCT_PARAMS_DATA_agentsSheet_(book);
 sh.getRange(current.row,2,1,4).setValues([[agent.nom,agent.identifiant,agent.role,agent.actif?'OUI':'NON']]);
 sh.getRange(current.row,8).setValue(agent.note);
 // Aucun login local active; si un compte pre-existant a un secret, son statut sert de garde serveur.
 BXCT_PARAMS_DATA_journaliser_(book,'MODIFIER_AGENT',actor,id,'ROLE_'+agent.role+'_'+(agent.actif?'OUI':'NON'));
}

/** Credential admin: source de verite Script Properties, jamais AGENTS ni navigateur.
 * Seule cette methode DATA effectue le changement demande par le service metier.
 * L'audit est assure par le module PARAMETRES et les sessions sont invalidees.
 */
/** Une seule voie de remplacement de credentials (admin et agents). */
function BXCT_PARAMS_DATA_motDePasseAgent_(book,actor,agentId,fresh){
 var agent=BXCT_LOGIN_DATA_agentParId_(book,agentId);
 if(!agent||agent.id!==agentId)throw new Error('AGENT_INTROUVABLE');
 if(agentId===BXCT_PARAMS_CONFIG_.ADMIN_ID &&
    (agent.login!==BXCT_PARAMS_CONFIG_.ADMIN_LOGIN||agent.role!==BXCT_PARAMS_CONFIG_.ADMIN_ROLE||!agent.active))
  throw new Error('ADMIN_INITIAL_INATTENDU');
 if(!fresh||fresh.algorithm!==BXCT_LOGIN_CONFIG_.KDF||!fresh.salt||!fresh.hash||
    fresh.mustChange!==(agentId!==BXCT_PARAMS_CONFIG_.ADMIN_ID))throw new Error('CREDENTIAL_INVALIDE');
 var bookId=book.getId(),props=PropertiesService.getScriptProperties();
 var key=BXCT_LOGIN_DATA_credsCle_(bookId,agentId),old=props.getProperty(key);
 BXCT_PARAMS_DATA_audit_(book);
 try{
  BXCT_LOGIN_DATA_enregistrerCredential_(bookId,agentId,fresh);
  BXCT_PARAMS_DATA_journaliser_(book,'CHANGER_MDP',actor,agentId,
    old?'REINITIALISATION':'PREMIERE_DEFINITION');
  BXCT_LOGIN_DATA_revoquerAgent_(bookId,agentId);
 }catch(e){
  if(old===null)props.deleteProperty(key);else props.setProperty(key,old);
  throw new Error('MOT_DE_PASSE_NON_CONFIRME');
 }
 return {initial:old===null,agentId:agentId,changementObligatoire:fresh.mustChange};
}
function BXCT_PARAMS_DATA_motDePasseAdmin_(book,actor,fresh){
 return BXCT_PARAMS_DATA_motDePasseAgent_(book,actor,BXCT_PARAMS_CONFIG_.ADMIN_ID,fresh);
}
