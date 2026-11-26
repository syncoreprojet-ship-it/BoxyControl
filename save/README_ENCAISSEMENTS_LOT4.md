# BOXY CONTROL v7.0.12-rc2 — Lot 4/5
Build: 2026-11-25 14:51:29 UTC
Base: BoxyControl.zip + v7.0.12-rc1 LOT3 DELTA. Installer uniquement les fichiers de ce Delta, après sauvegarde.

## Nouveau
- Adaptateur FORMATION: BXCT_ENC_AcademyService.gs. Lecture via BXCT_ENC_SERVICE_ledger_ et calcul des mouvements via BXCT_ENC_SERVICE_amount_. Aucun registre supplémentaire. Devis validé du dossier via la logique historique acad5ReadClientQuote_. HISTORIQUE_PAIEMENTS est la source de vérité des mouvements.
- Wrappers historiques acad5Ledger_ et acad5Balance_ conservés. Projections historiques conservées. Le solde du dossier sans paiement est le total du devis.
- Interrupteur BXCT_ENC_ACADEMY_WRITE_ACTIVE_ fixé à false; les API historiques d'enregistrement (y compris remboursements) et de décision sont bloquées côté serveur. Aucun changement à PHOTO. Ne pas activer les interrupteurs financiers pendant la recette.
- UI: espace Encaissements ACADÉMIE, lecture seule réelle, simulation existante conservée; invalidation des réponses de lecture lors du changement de participant, fermeture ou déconnexion; montants longs repliables.
- Points d'entrée publics pour setup/audit; ne pas dupliquer les wrappers ajoutés manuellement: remplacer intégralement les fichiers correspondants.

## Dépendances
Academie_Lot5.gs -> BXCT_ENC_AcademyService.gs -> BXCT_ENC_Service.gs -> BXCT_ENC_Data.gs. Dépendances historiques: photo6States_, photo6Public_, photo6Int_, contrôle d'identité, permissions, devis et audit historiques. L'extraction complète du Core historique n'est pas réalisée; pas de nouvelle dépendance circulaire identifiée dans le chemin ajouté.

## Recette TEST
1. BXCT_ENC_SETUP (BXCT_ENC_Setup.gs), puis BXCT_ENC_AUDIT (BXCT_ENC_Audit.gs). Attendu: ok true, version 7.0.12-rc2, schemaVersion 1, ecritureActive false. Audit réel du lot 3 non communiqué.
2. Ouvrir ACADÉMIE, rechercher un participant confirmé ayant un devis officiel valide, ouvrir Encaissements ACADÉMIE. Vérifier échéances, solde, historique, reçu selon les droits; vérifier absence de formulaire réel. Comparer avec filtre FORMATION de la caisse générale. Tester un dossier sans versement et le changement rapide de dossier.
3. Ne pas effectuer de paiement réel. La consultation peut écrire dans l'audit historique, pas dans le registre financier. La réparation historique des projections n'est pas à exécuter pour cette recette.

## Contrôles locaux et limites
13 assertions sur données fictives: net, solde, attente, remboursement, historique, concordance générale, espèces/MM, dossier sans versement, verrou false, refus de devis incompatible et doublon. Syntaxe GS et scripts inline sans templates vérifiée. IDs historiques préservés, aucune nouvelle collision de déclarations GS de premier niveau; collision SYNC L2 historique maintenue. Chromium: panneau isolé, CSS existant, 50 lignes fictives et gros montants, 8 tailles d'écran, dernier bouton accessible, pas de débordement horizontal. Application déployée, clavier réel et permissions effectives non testés. Pas de validation complète de l'indépendance historique. Les totaux généraux restent limités aux dossiers présents au journal; les remboursements en attente sont nets au général mais exclus du montant des versements en attente ACADÉMIE. Aucun transfert ni mutation financière nouvelle.
