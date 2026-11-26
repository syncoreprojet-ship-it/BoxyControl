/** CONTROL Lot 8: liaison optionnelle, jamais activee par defaut. */
const BXCT_L8_VERSION_='7.0.3-rc1';
function BXCT_L8_CONFIG_active_(){
  const p=PropertiesService.getScriptProperties();
  const secret=String(p.getProperty('BXCT_L8_SECRET')||'');
  const url=String(p.getProperty('BXCT_L8_CLIENT_URL')||'');
  return p.getProperty('BXCT_L8_ENABLED')==='OUI' &&
    /^[A-Za-z0-9_-]{48,256}$/.test(secret) &&
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{25,}\/exec$/.test(url);
}
function BXCT_L8_CONFIG_secret_(){
  if(!BXCT_L8_CONFIG_active_())throw new Error('BXCT_L8_LIAISON_INACTIVE');
  return PropertiesService.getScriptProperties().getProperty('BXCT_L8_SECRET');
}
function BXCT_L8_CONFIG_url_(){
  if(!BXCT_L8_CONFIG_active_())throw new Error('BXCT_L8_LIAISON_INACTIVE');
  return PropertiesService.getScriptProperties().getProperty('BXCT_L8_CLIENT_URL');
}
