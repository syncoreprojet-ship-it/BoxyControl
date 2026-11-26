# BOXY CONTROL v7.0.13-rc3 — Accès direct Encaissements ACADÉMIE
Base : BoxyControl.zip + deltas financiers 3,4,5 + Formations lots 3 et 4. Le lot 5 Formations n'avait aucun fichier CONTROL.
Installer uniquement sur la copie TEST : ajouter les six fichiers BXCT_ENC_AcademyDesk*, remplacer Index.html et BXCT_ENC_Service.gs. Ce README ne doit pas être importé dans Apps Script.
Aucune migration, aucun setup, aucune activation de paiement. Le registre HISTORIQUE_PAIEMENTS et les devis figés DEVIS_ACADEMIE_CONTROL font autorité. Aucun fichier CLIENT modifié.

## Recette
1. Exécuter BXCT_ENC_TESTS (BXCT_ENC_Tests.gs, existant) : 26/26 attendus.
2. Exécuter BXCT_ENC_ACADEMY_DESK_TESTS (BXCT_ENC_AcademyDeskTests.gs) : 15/15 attendus.
3. Exécuter BXCT_ENC_AUDIT (BXCT_ENC_Audit.gs, existant) ; examiner les anomalies, ne pas réparer automatiquement.
4. Ouvrir CONTROL TEST, se reconnecter. Accueil > ACADÉMIE > Encaissements ACADÉMIE. Le bouton est visible mais désactivé si le droit CONSULTER_FINANCES_ACADEMIE ou les verrous de lecture ACADEMIE_FINANCES_LECTURE_ACTIVE et ACADEMIE_DEVIS_OFFICIELS_VALIDES sont absents. Vérifier les réglages existants par les procédures autorisées, ne pas activer les écritures.
5. Comparer les totaux avec le filtre ACADÉMIE du général, tester les vues Historique, Attente, Soldes, Mouvements validés, le filtre BX.FOR et la pagination. Les totaux restent globaux ACADÉMIE, le filtre ne concerne que les listes. Ouvrir la fiche préremplit le code si le droit de recherche historique est disponible; lancer la recherche puis ouvrir Encaissements ACADÉMIE. Les reçus sont consultés par cette fiche, pas émis par le nouveau panneau.
6. Tester sur tablette portrait/paysage, mobile, déconnexion et retour. Aucune opération financière réelle.

## Contrats et dépendances
Index (navigation, login/logout) -> DeskClient + DeskInterface -> BXCT_ENC_ACADEMY_DESK_LIRE -> ENC Auth Core -> DeskPermissions -> DeskValidation -> ENC Service existant -> ENC Data -> registre. La portée FORMATION est imposée côté serveur; aucun droit PHOTO nécessaire. Le droit finance ACADÉMIE existant autorise la vue agrégée de cette prestation; aucun nouveau droit ou rôle créé. Les droits historiques de recherche et reçus restent requis. Le service central ajoute une projection optionnelle pour le bureau, sans changer la réponse historique du général. Les lectures n'écrivent rien. Les devis uniquement CLIENT ne sont pas recensés. Un journal incohérent peut bloquer la lecture (comportement historique).

## Contrôles
26 tests financiers historiques et 15 nouveaux exécutés localement avec Node sur les fichiers GS cumulés. Syntaxe GS et scripts Index/module vérifiée; 296 IDs Index historiques conservés. Tests Chromium du module isolé, navigation/serveur simulés, 50 lignes fictives, 14 dimensions (320x568 à 1366x768, hauteur 300). Pas de test Apps Script réel, pas de test clavier virtuel physique, pas de recette complète de tous les parcours. Collision historique SYNC L2 non corrigée. Aucun changement du verrou BXCT_ENC_ACADEMY_WRITE_ACTIVE_.
