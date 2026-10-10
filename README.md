# Aim Trainer 3D

Pièce pour [random.plagnito.com](https://random.plagnito.com) (slug `aim-trainer`) : un entraîneur de visée en 3D dans un dojo néon.
Site **statique**, sans build : ouvrir `index.html` via un serveur de fichiers (ex. `python3 -m http.server`).

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html` | `<head>` complet, CSS, structure des écrans (menu, séance, consignes, pause, calibrage, fin, réglages, stats, classement, succès, aide) |
| `jeu.js` | Tout le jeu : scène Three.js, huit modes, contrôles, son et musique Web Audio, sauvegarde, intégration `atlasJeu` |
| `three.min.js` | Three.js r158 embarqué (MIT, voir `three.LICENSE.txt`), script classique : aucune dépendance réseau |
| `random.json` | Fiche de la pièce et capacités déclarées |
| `tests/verifier-brief.mjs` | Vérifie les règles du brief (head, `random.json`, succès, API interdites, poids…) : `node tests/verifier-brief.mjs` |

## Les huit modes
Grille · Éclair 360° · Suivi · Précision · Volantes · Réflexes · **Strafe** (cible qui file de gauche à droite et change de sens) · **Rafale** (salves de 5 cibles, bonus si la salve est vidée vite) — chacun en Facile / Normal / Difficile (points ×1 / ×1,5 / ×2).
Cible touchée : 100 points (150 au centre), combo jusqu'à ×4 (+1 toutes les 5 touches d'affilée), note D→S.

## Fonctions
- **Échauffement libre** : les cibles de la Grille sans chrono ni score (rien n'est enregistré).
- **Défi du jour** : mode et difficulté tirés de la date (même choix pour tous, sans serveur), avec une série de jours consécutifs.
- **Séance guidée** : trois modes à la suite choisis d'après tes dernières parties (une spécialité pour l'échauffement, deux points à travailler ou à découvrir).
- **Précision à taille réglable** : cibles Larges (×0,8), Standard (×1), Fines (×1,3), Minuscules (×1,7) ; un record par taille.
- **Fantôme du record** : compteur 👻 en partie (avance ou retard sur ton meilleur essai au même instant), bilan en fin de partie.
- **Fin de partie** : note, progression vers la note suivante, graphique, **carte des tirs**, **image du score** téléchargeable (générée localement).
- **Statistiques** : totaux, **évolution des scores** (30 dernières parties par mode, moyenne glissante, tendance), **analyse avancée** (temps moyen par cible, régularité, carte de chaleur cumulée des tirs ratés), records, dernières parties.
- **Sauvegarde exportable** : code `AIM1.…` à copier / coller pour garder ou transférer sa progression (import en deux clics).
- **À débloquer** (conditions calculées localement, donc valables sans SDK) : cibles Or / Blanc glacé / Arc-en-ciel, viseurs Losange / Étoile, aspects Hologramme / Damier.
- **Réglages** : sensibilité (avec conversion cm/360° et depuis Valorant, CS2, Apex, Overwatch 2), champ de vision, axe vertical, viseur, couleur et aspect des cibles, aide daltonisme (croix sombre au centre, cible qui pulse et clignote en blanc avant de disparaître), décor Néon / Épuré, qualité (Auto adapte la résolution), volume, **musique synthwave générée** (volume et bouton dédiés), fantôme, gyroscope (mobile).
- **Gyroscope (mobile, expérimental)** : la vue suit le téléphone, un toucher tire au centre ; calibrage guidé des axes, recentrage depuis la pause, repli automatique sur le tactile si aucun capteur ne répond. Non testé sur matériel réel.

## Contrôles
- **Souris** : pointer-lock (style FPS), clic gauche pour tirer (maintenu en mode Suivi). `Échap`/`P` pause, `R` recommencer, `M` son, `N` musique.
- **Tactile / curseur libre** : toucher une cible pour tirer, glisser pour tourner la vue (Éclair 360°). Toutes les commandes clavier ont un bouton équivalent.
- Si le verrouillage de la souris est refusé, le jeu bascule seul en curseur libre.

## Capacités SDK (`window.atlasJeu`, facultatif)
- `progression` : réglages, records, stats, fantômes et historique dans `localStorage` (clé unique `etat`).
- `identite` : le pseudo est affiché sur l'accueil.
- `classement` (`desc`, points) : score envoyé en fin de partie ; bouton « Classement » seulement si accordé.
- `succes` : 24 succès (3 secrets) débloqués dans `jeu.js` ; bouton « Succès » seulement si accordé.

Sans SDK, tout le jeu reste jouable ; seuls le classement et les succès disparaissent.

## Mise au point
`index.html?debug` expose `window.__aim` (état interne) pour les tests automatisés.
