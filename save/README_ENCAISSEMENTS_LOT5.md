# BOXY CONTROL v7.0.12-rc3 — Lot 5/5
Build: 2026-11-25 16:00:46 UTC
Base: BoxyControl.zip/save + LOT3 DELTA rc1 + LOT4 DELTA rc2, avec GO utilisateur. Les résultats d'audit réels des lots 3/4 n'ont pas été communiqués. Installer ce Delta uniquement après les deux précédents. Aucun fichier CLIENT modifié.

## Nouveau
- Audit renforcé, sans écriture: événements, idempotence, référence Mobile Money, immutabilité des champs de décision, auteur/contrôleur distincts, reçus, origine et plafond des remboursements, net hors limites, concordance des totaux par prestation et des soldes individuels ACADÉMIE. Aucun identifiant client ni montant réel dans la sortie publique.
- Tests synthétiques déterministes: 26/26 exécutés localement avec Node.js. Fonction publique BXCT_ENC_TESTS. Pas d'accès aux feuilles ni mutation par les tests.
- Montants en attente séparés: versements et remboursements, plus attente nette générale. Les champs historiques restent inchangés. Solde = max(0, devis - encaissements validés + remboursements validés).
- Les devis déjà figés et validés dans DEVIS_ACADEMIE_CONTROL sont comptés dans le général une seule fois, y compris sans mouvement. Ce n'est pas un recensement exhaustif des devis CLIENT; les devis exclusivement CLIENT et dossiers PHOTO sans mouvement restent hors couverture. Les devis figés sont des obligations historiques, non une confirmation d'éligibilité actuelle; pas de relecture du CLIENT dans le général. Incompatibilité de devis => refus, pas de correction implicite.
- Correction ciblée PHOTO: exclure les transactions ACADÉMIE du résumé PHOTO, des reçus PHOTO, de la caisse journalière PHOTO et de la réparation des projections PHOTO. Les vérifications globales de référence MM et d'idempotence sont conservées. Pas de réparation rétroactive exécutée.
- Verrou ACADÉMIE maintenu dans le contexte historique et ajouté au service commun, qui vérifie aussi la cohérence du domaine. Aucun nouvel endpoint d'écriture, remboursement ou transfert. Les interrupteurs historiques PHOTO ne sont pas modifiés; ne pas les activer pour cette recette. Aucun changement de schéma (1).

## Source de vérité et dépendances
HISTORIQUE_PAIEMENTS: mouvements, montant_fcfa, statut_apres, transaction_id et evenement_id; append unique via BXCT_ENC_SERVICE_append_ -> BXCT_ENC_DATA_append_, appelants historiques conservent LockService et contrôle d'idempotence. DEVIS_ACADEMIE_CONTROL: devis figés (montant_total_fcfa, statut_devis, reference_devis_client); devis individuels éligibles via acad5ReadClientQuote_ (CLIENT lecture seule et règles historiques).
UI -> API -> AUTH -> PERMISSIONS -> VALIDATION -> SERVICE -> DATA. L'audit est transversal en lecture. Dépendances historiques photo6States_, photo6Int_, acad5Table_, ACA5_QUOTE_HEADER_ et photo6Public_ conservées; pas d'extraction complète ni prétention à indépendance intégrale du Core. Collision historique BXCT_SYNC_L2_AUDIT_SANS_ECRITURE non modifiée (hors périmètre). Aucune nouvelle collision détectée.

## Installation / recette TEST
1. Sauvegarder CONTROL. Ajouter BXCT_ENC_Tests.gs, remplacer les fichiers GS/HTML modifiés. Le README est documentaire, pas un fichier à importer dans Apps Script. Enregistrer.
2. BXCT_ENC_SETUP (BXCT_ENC_Setup.gs) -> ok:true, version:7.0.12-rc3, schemaVersion:1, ecritureActive:false.
3. BXCT_ENC_TESTS (BXCT_ENC_Tests.gs) -> ok:true, total:26, reussis:26, echecs:[], ecritureActive:false.
4. BXCT_ENC_AUDIT (BXCT_ENC_Audit.gs) -> ok:true, version:7.0.12-rc3, schemaVersion:1, ecritureActive:false, anomalies:[] si les données sont cohérentes. Si anomalie, transmettre le code et ne pas réparer automatiquement. Audit en lecture seule, pas de données personnelles dans la sortie. Les projections historiques, la configuration des droits réels et les outbox ne sont pas intégralement auditées.
5. Sur déploiement TEST uniquement: comparer Encaissements généraux filtre FORMATION et Encaissements ACADÉMIE sur un dossier confirmé. Vérifier historique, net, soldes, attentes séparées, reçu selon droits. Tester un dossier sans versement, un utilisateur non autorisé, changement rapide de dossier, interface mobile avec clavier virtuel. Aucun paiement réel ni réparation à lancer. Les consultations historiques peuvent journaliser dans AUDIT, pas dans le registre financier.
6. Vérifier que les reçus PHOTO ne présentent pas de transactions FORMATION et que la caisse PHOTO n'inclut pas ces mouvements. Vérifier les réglages d'écriture historiques PHOTO en TEST sans les activer. Validation explicite avant clôture et prompt maître autonome.

## Contrôles locaux
- Syntaxe de la version cumulée: 90 GS concaténés, scripts inline Index.html et BXCT_ENC_Client.html sans templates; 484 noms de fonctions GS de premier niveau, aucun nom antérieur supprimé (296 IDs Index conservés).
- 26 tests synthétiques réussis: acompte, multiples, intégral, devis sans mouvement, concordance, méthodes, rejets, doublons, remboursement, sécurité des domaines, permissions, pagination, verrous. Pas d'exécution Apps Script réelle ici.
- Chromium: 2 panneaux isolés, CSS existant + conteneur de test scrollable, 50 lignes fictives et montants longs. 320x568, 360x640, 375x667, 390x667, 390x844, 430x932, 768x1024, 1366x768: pas de débordement horizontal et dernier contrôle visible après scroll. Pas de nouveau modal. Ne prouve pas le layout intégré, le clavier réel ni les appels serveur déployés.
- Limites: registre plafonné à 15000 lignes, table de devis historique plafonnée à 500 lignes (en-tête compris), selon garde-fous existants. Pas de lecture exhaustive CLIENT, pas de réparation automatique ni activation des opérations. Recette utilisateur indispensable; ce lot est une version candidate, pas une autorisation de mise en production.
