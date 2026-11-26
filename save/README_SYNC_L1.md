# BOXY CONTROL — Synchronisation CLIENT — Lot 1 / 7

Version : v7.0.9-rc1

## Nouveau
- Module `BXCT_SYNC_L1_Config.gs` : contrats et references des deux copies TEST.
- Module `BXCT_SYNC_L1_Audit.gs` : audit idempotent, strictement en lecture seule.
- Copies Google Sheets TEST : onglets techniques alignes sur la structure attendue, huit prestations presentes et fermees, source CONTROL TEST redirigee vers CLIENT TEST.

## A installer dans le projet Apps Script BOXY CONTROL
Ajouter ces DEUX fichiers `.gs` ; ne supprimer aucun fichier historique.
Ne pas installer l'audit dans BOXY CLIENT : il lit les deux copies TEST depuis CONTROL.

### Fonction a executer depuis l'editeur Apps Script de CONTROL
- Fonction : `BXCT_SYNC_L1_AUDIT_SANS_ECRITURE()`
- Fichier : `BXCT_SYNC_L1_Audit.gs`
- Resultat attendu : `ok: true`, `code: BXCT_SYNC_L1_PRET_POUR_LOT2`.
- Ne pas executer depuis l'interface visiteur; elle demande la preuve du proprietaire des deux copies.

## Emplacements Google Sheets TEST verifies
- CONTROL TEST : `11okNL6OMeAvTn68GW6ktBzoV79vfNEY1Yl29tCdPmQM`.
- CLIENT TEST : `1luxbfMP8RXmc4kGn5a6QVnjUNdiLmYXuNk4qC2wxyJU`.
- CONTROL TEST / PARAMETRES!B8 correspond maintenant a l'ID CLIENT TEST.
- CLIENT TEST : onglets `BXCL_L8_RAPPELS`, `BXCL_SYNC5_CONFIG`, `BXCL_SYNC5_JOURNAL`, `CODES_BOXY`, `CODES_BOXY_HISTORIQUE`, `CODES_BOXY_CONFIG` crees vides (sauf configurations fermees).
- CONTROL TEST : onglets techniques `_BXCT_PARAMS_AUDIT` et `_BXCT_LOGIN_AUDIT` crees avec entetes, sans historique de production.
- CLIENT TEST / PRESTATIONS : huit codes officiels, avec `visible_public = NON` et `inscriptions_ouvertes = NON`.

## Preservations / interdictions
- Les classeurs principaux CLIENT et CONTROL sont inchanges.
- Ne jamais recopier les vrais dossiers ou mots de passe dans les copies TEST.
- Aucun flag de synchronisation, d'inscription, de paiement ou d'operation n'est active.
- Aucun secret HMAC n'est defini ou imprime.
- Aucun traitement de dossier, rappel ni confirmation n'est execute.
- Les roles et permissions sont inchanges.

## Dependances identifiees pour Lot 2
1. `BXCL_P2_Config.gs` contient encore un identifiant de classeur principal fige ; les services metier CLIENT de la copie doivent recevoir un routage TEST explicite, isole et controle avant tout appel HTTP.
2. Les copies TEST n'ont pas de comptes agents ni de sessions actives : elles ne doivent pas reutiliser de sessions ou de secrets de production.
3. `BXCT_L3_Auth.gs` bloque actuellement le mode TEST et plusieurs fonctions anciennes imposent des conditions de production. Pour le test de bout en bout, utiliser des points d'entree distincts et securises plutot que supprimer globalement ces protections.
4. `BXCT_L8_CONFIG_active_` et `BXCL_L8_CONFIG_active_` restent fermes. L'activation sera une operation distincte, apres recettes signees.
5. Les ecritures du Lot 7 et du Lot 8 doivent rester non concurrentes : writer metier unique pour chaque source de verite.

## Lot 1 accepte lorsque
- L'audit manuel retourne `ok:true` sur les deux COPIES TEST.
- La liaison CLIENT principale n'est jamais lue par la copie CONTROL TEST.
- Les verrouillages restent `NON` et les schemas sont compatibles.
- Le proprietaire valide explicitement le Lot 1 avant Lot 2.
