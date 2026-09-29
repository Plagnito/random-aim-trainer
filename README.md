# Aim Trainer 3D

Pièce pour [random.plagnito.com](https://random.plagnito.com) (slug `aim-trainer`) : un entraîneur de visée en 3D dans un dojo néon.
Site **statique**, sans build : ouvrir `index.html` via un serveur de fichiers (ex. `python3 -m http.server`).

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html` | `<head>` complet, CSS, structure des écrans (menu, consignes, pause, fin, réglages, stats, classement, succès, aide) |
| `jeu.js` | Tout le jeu : scène Three.js, six modes, contrôles, son Web Audio, sauvegarde, intégration `atlasJeu` |
| `three.min.js` | Three.js r158 embarqué (MIT, voir `three.LICENSE.txt`), script classique : aucune dépendance réseau |
| `random.json` | Fiche de la pièce et capacités déclarées |

## Les six modes
Grille · Éclair 360° · Suivi · Précision · Volantes · Réflexes — chacun en Facile / Normal / Difficile (points ×1 / ×1,5 / ×2).
Cible touchée : 100 points (150 au centre), combo jusqu'à ×4 (+1 toutes les 5 touches d'affilée), note D→S.

## Fonctions en plus des six modes
- **Échauffement libre** : les cibles de la Grille sans chrono ni score, pour régler sensibilité et viseur (rien n'est enregistré).
- **Défi du jour** : mode et difficulté tirés de la date (même choix pour tous, sans serveur), avec une série de jours consécutifs.
- **Fin de partie** : note, progression vers la note suivante, graphique, **carte des tirs** (où tombent tes tirs autour de la cible, biais moyen en texte) et **image du score** à télécharger (générée localement).
- **Réglages** : sensibilité, champ de vision, axe vertical inversé, viseur, couleur des cibles, décor (Néon / Épuré), qualité graphique (Auto adapte la résolution si l'appareil est lent), volume, effets réduits.
- **Retours** : tic-tac sur les 3 dernières secondes, carillon quand le combo monte, ★ sur les tirs au centre.

## Contrôles
- **Souris** : pointer-lock (style FPS), clic gauche pour tirer (maintenu en mode Suivi). `Échap`/`P` pause, `R` recommencer, `M` son.
- **Tactile / curseur libre** : toucher une cible pour tirer, glisser pour tourner la vue (mode Éclair 360°).
- Si le verrouillage de la souris est refusé, le jeu bascule seul en curseur libre.

## Capacités SDK (`window.atlasJeu`, facultatif)
- `progression` : réglages, records, stats et historique dans `localStorage` (clé `etat`, quelques Ko).
- `identite` : le pseudo est affiché sur l'accueil.
- `classement` (`desc`, points) : score envoyé en fin de partie ; bouton « Classement » seulement si accordé.
- `succes` : 20 succès (3 secrets) débloqués dans `jeu.js` ; bouton « Succès » seulement si accordé.

Sans SDK, tout le jeu reste jouable ; seuls le classement et les succès disparaissent.

## Mise au point
`index.html?debug` expose `window.__aim` (état interne) pour les tests automatisés.
