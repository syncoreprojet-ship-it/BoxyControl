# BOXY CONTROL v7.0.13-rc2 - Formations lot 4/5
Build: 2026-11-25 16:57:55 UTC
Base: BoxyControl.zip + Encaissements lots 3, 4, 5 + Formations lot 3 CONTROL.

Installation: sauvegarder CONTROL. Ajouter BXCT_UI_Responsive (HTML), remplacer Index.html et BXCT_PARAMS_Page.html. README hors Apps Script. Aucun fichier CLIENT, aucune migration ni fonction a executer. Enregistrer et tester le deploiement TEST. Les routes doGet (Code.gs) et BXCT_PARAMS_ROUTE_afficher_ (BXCT_PARAMS_Route.gs) restent intactes.

Nouveau: largeur maximale 1440px, navigation existante laterale des 960px, cartes et champs tactiles, tableaux sessions adaptatifs, fenetres L6/L7 contenues dans le viewport, adaptation page Parametres. A faible hauteur, la fenetre L7 defile integralement afin de conserver les actions accessibles. Aucun nouveau menu metier ni changement de droits.
Preserve: les deux pages sont identiques octet pour octet hors inclusion CSS; aucun GS ni JS modifie. CSS sans dependance nouvelle, scope app et settings, hors impression.
Tests locaux Chromium: 14 dimensions (320x568,360x640,375x667,390x667,390x844,430x932,600x960,768x1024,820x1180,1024x768,1180x820,1366x768,390x300,1024x300). Neuf panneaux affiches en demo locale par switchTab; controle largeur document, catalogue injecte de 15 cartes fictives, position L6/L7 et acces au dernier bouton L7. Parametres: connexion et formulaire agent affiches sans authentification reelle dans le DOM local; largeur et scroll vers boutons verifies. Aucun pageerror sur application principale. Pas de test de tous les etats dynamiques, du clavier physique, du serveur ou des droits reels. Les controles locaux ne constituent pas une recette de production.
Recette: login/logout, recherche, PHOTO, ACADEMIE, catalogue, encaissements, notifications L6/L7, impression recu, Parametres, tablette portrait/paysage, clavier virtuel, petits ecrans. Aucun paiement ou modification de donnees necessaire. Ne pas activer les operations verrouillees.
