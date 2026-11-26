# BOXY CONTROL — 7.0.12-rc1 — lot 3/5

Delta issu de BoxyControl.zip (recherche generale v7.0.11-rc8). Aucun fichier CLIENT.

## Installation
1. Sauvegarder le projet Apps Script et le classeur. Appliquer uniquement les fichiers du ZIP au projet CONTROL, en conservant les noms. Ne pas supprimer les autres fichiers.
2. Sur le classeur TEST deja configure, executer depuis l'editeur `BXCT_ENC_SETUP_` (BXCT_ENC_Setup.gs), puis `BXCT_ENC_AUDIT_` (BXCT_ENC_Audit.gs). Les deux sont sans mutation; si ok:false ou exception, ne pas publier.
3. Tester la nouvelle page depuis l'accueil avec un compte ADMIN_CONTROL ou SUPERVISEUR ayant CONSULTER_PAIEMENTS et CONSULTER_FINANCES_ACADEMIE. Les interrupteurs historiques PAIEMENTS_ACTIFS, ACADEMIE_FINANCES_LECTURE_ACTIVE et ACADEMIE_DEVIS_OFFICIELS_VALIDES doivent deja etre autorises pour la lecture. Ne pas activer les paiements reels pour cette recette. Si les interrupteurs sont OFF, la lecture est refusee; aucun changement automatique.
4. Tester un compte non habilite et la deconnexion. Valider le lot avant le suivant.

## Contrats et source de verite
- HISTORIQUE_PAIEMENTS: evenement_id identifie un evenement; transaction_id et version reconstituent le statut; montant_fcfa, type_mouvement, methode et statut_apres font autorite pour le net; devis_client_fcfa est la valeur historique du devis, pas un nouveau devis. code_prestation=FORMATION identifie ACADÉMIE, les transactions historiques TXN- sans meta sont PHOTO. Domaines non reconnus: echec ferme, pas de classement arbitraire.
- Une seule fonction d'ajout interne BXCT_ENC_SERVICE_append_, puis DATA. Les wrappers photo6Append_ et acad5Append_ conservent les signatures, schemas (24/29 colonnes), controles metier, verrou et idempotence des appels existants. Aucun nouveau point d'entree d'ecriture, aucune activation ni transfert. Les chemins historiques restent soumis a leurs propres interrupteurs existants; ce lot ne les desactive pas globalement.
- API publique BXCT_ENC_LIRE(token,{prestation,page}), enveloppe ok/code/message/data. Lecture globale seulement pour les roles et droits listes ci-dessus, aucune extension des permissions. 50 transactions/page. Aucun secret de verification ni reference externe renvoyes. Les totaux couvrent les transactions filtrees, pas seulement la page.
- Solde: somme des soldes positifs des dossiers avec mouvements, sur devis historique; dossiers sans mouvement exclus. Si devis historique divergent, lecture refusee pour eviter un total trompeur. Montants en attente nets des remboursements en attente; montant valide net des remboursements valides. Pas de rapprochement de caisse, de nouveaux devis ni d'integration d'autres prestations dans ce lot.
- Setup: schema version 1 du module, controle des colonnes existantes, pas de migration destructive et pas de nouveau registre. Version globale de schema CONTROL inchangee.

## Dependances
UI Index (hooks login/logout) -> BXCT_ENC_Client -> API -> Auth (Core Code.gs) -> Permissions -> Validation -> Service -> Data -> journal. Service reutilise photo6States_ et photo6Int_ existants; Data reutilise les constantes PHOTO6_EVENTS_, ACA5_META_ et photo6AssertHeader_. Les anciens modules utilisent le service commun d'ajout; ce couplage de compatibilite reste a extraire vers un Core financier dedie lors d'un refactoring autorise. Les projections et le reste des APIs historiques sont inchanges.

## Verification locale
Syntaxe de tous les GS et du JS nouveau, fonctions GS des fichiers historiques modifies et IDs Index existants verifies; 11 assertions Node (calcul, filtres, doublon, refus droit, vide); interface isolee avec CSS Index et reponse API simulee: 320x568, 360x640, 375x667, 390x667, 390x844, 430x932, 768x1024, 1366x768, 50 lignes et code long, largeur et dernier bouton accessibles. Pas de recette Apps Script/Sheets live, ni clavier virtuel reel. Collision historique BXCT_SYNC_L2_AUDIT_SANS_ECRITURE deja presente, non corrigee hors perimetre. Aucun nouveau modal.
