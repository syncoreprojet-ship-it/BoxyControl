/**
 * BOXY CONTROL | PARAMETRES | Routage prive v7.0.7-rc1.
 * Depend de : HtmlService, ScriptApp. Utilise par : Code.gs/doGet.
 * /exec n'est JAMAIS redirige automatiquement vers Parametres.
 * Seule l'API des agents determine les autorisations, cote serveur.
 */
function BXCT_PARAMS_ROUTE_estParametres_(e) {
  var page=String(e&&e.parameter&&e.parameter.page||'').trim().toLowerCase();
  return page==='parametres'||page==='parametre';
}
function BXCT_PARAMS_ROUTE_base_() {
  return String(ScriptApp.getService().getUrl()||'').trim();
}
function BXCT_PARAMS_ROUTE_lienParametres_() {
  var base=BXCT_PARAMS_ROUTE_base_();
  return base ? base + (base.indexOf('?')>=0?'&':'?') + 'page=parametres' : '?page=parametres';
}
function BXCT_PARAMS_ROUTE_afficher_() {
  var page=HtmlService.createTemplateFromFile('BXCT_PARAMS_Page');
  page.accueilUrl=BXCT_PARAMS_ROUTE_base_();
  return page.evaluate()
    .setTitle('BOXY CONTROL | Parametres')
    .addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
/** Audit sans feuille, sans session et sans ecriture. */
function BXCT_PARAMS_ROUTE_AUDIT_SANS_ECRITURE(){
  var ok=BXCT_PARAMS_ROUTE_estParametres_({parameter:{page:'parametres'}})
      &&BXCT_PARAMS_ROUTE_estParametres_({parameter:{page:'parametre'}})
      &&!BXCT_PARAMS_ROUTE_estParametres_({parameter:{page:'accueil'}})
      &&!BXCT_PARAMS_ROUTE_estParametres_({parameter:{page:'../../AGENTS'}})
      &&!BXCT_PARAMS_ROUTE_estParametres_({});
  var result={ok:!!ok,version:'7.0.7-rc1',
    accueilPreserve:!!ok,routeParametres:!!ok,ecritureEffectuee:false};
  console.log(JSON.stringify(result));return result;
}
