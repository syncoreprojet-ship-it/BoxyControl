# BOXY CONTROL v7.0.14-rc1 — LOT 1/3
Build UTC : 2026-11-26 15:02:07 UTC

Base : BoxyControl.zip + deltas financiers v7.0.12-rc1 à rc3, CONTROL du lot Formations v7.0.13-rc1, v7.0.13-rc2, rc3 puis rc4. Hypothèse : ces deltas ont été installés dans cet ordre, sans changements manuels ultérieurs.

## Installation
Sauvegarder CONTROL. Remplacer Index.html. Créer trois fichiers HTML (sans double extension) : BXCT_ACA_HubInterface, BXCT_ACA_HubCards, BXCT_ACA_HubClient. Enregistrer et tester via le déploiement TEST. Aucun GS modifié, aucun setup, aucune fonction à exécuter, aucun changement de feuille ou de propriété. Ne pas installer dans CLIENT.

## Nouveau
Accueil à huit cartes, icônes SVG locales, 1/2/4 colonnes (600/1250 px). Catalogue et tableau des sessions dans leurs espaces respectifs. Encaissements via le bouton historique et sa route enc-academie. Inscriptions / Apprenants / Présences : entrées contextualisées vers la même fiche et ses actions existantes. Attestations et Statistiques désactivées et explicitement prévues au lot 3. Sessions reste en lecture seule : création manuelle, pagination serveur et gestion opérationnelle au lot 2. Le bouton historique de recherche et celui des encaissements restent dans le DOM, masqués et déclenchés par les cartes, avec les mêmes décisions d'accès. Protection des réponses tardives de recherche participant lors d'une sortie ou d'une déconnexion.

## Préservé et dépendances
HubCards : structure et libellés. HubInterface : CSS limité au hub et au conteneur ACADÉMIE. HubClient : navigation, dépend des contrôles historiques academy-open-participant, bxct-aca-desk-open, academyLookupHide, academyLoad, academyActivity, acad4CanRead et des panneaux existants. Aucune nouvelle API. Catalogue : BXCT_FORM_AdminInterface / Client et service existant ; Sessions : controlAcademieCatalogue ; recherche : controlAcademieLookup et parcours existants ; finances : BXCT_ENC_AcademyDeskInterface / Client. Les sources de vérité et écrivains métier sont inchangés. La permission serveur et les verrous existants demeurent applicables. L'accès aux présences via le hub exige les droits de recherche et de progression existants. Catalogue indisponible en démo comme auparavant. Les autres parcours restent accessibles dans la fiche partagée ; l'indépendance métier complète de ces modules relève du lot 2. Aucun changement aux permissions rc4.

## Contrôles réellement exécutés
Assemblage local des includes HTML, node --check sur tous les scripts inline assemblés, comparaison des 414 IDs historiques (aucun perdu, aucun nouveau doublon). Chromium local en mode démonstration : 8 cartes, ouverture/retour Sessions, Catalogue (message indisponible en démo), 3 entrées de recherche et fiche fictive, Encaissements (route sans lecture réelle), PHOTO, déconnexion/reconnexion ; aucune erreur JS observée. 11 tailles : 320x568, 360x640, 390x844, 600x960, 768x1024, 820x1180, 1024x768, 1180x820, 1366x768, 390x300, 1024x300. Vérification des colonnes, défilement des cartes, absence de débordement horizontal page accueil et Sessions. Pas de tests Apps Script réel, de serveur ni de tablettes physiques ; aucune écriture ni lecture de données réelles lors de ces tests. Recette requise en TEST pour droits réels, lecture du catalogue, sessions et finances. La protection des réponses tardives a été ajoutée mais pas exercée sur un serveur réel. Pas d'audit global des collisions GS historiques (aucun GS modifié).

## Retour arrière
Restaurer Index.html rc3 (inchangé par rc4), retirer les trois nouveaux fichiers HTML. Aucun rollback de données nécessaire.
