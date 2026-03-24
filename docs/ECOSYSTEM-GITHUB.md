# Relier ce dépôt aux autres projets GitHub

## Rôles

| Dépôt | Rôle |
|-------|------|
| **Ce dépôt** (`depot-ghost-tokken` / jeton GHOST) | Contrats Solidity du jeton, prévente, bonus, scripts `deploy:ecosystem:base`, tokenomics documentée. |
| **Ghost Protocol V2** (dépôt local typique : `ghost protocol V2  dépot`) | `GhostProtocolV2` on-chain, UX, `ghost-schnorr-libz.js`, paquet `@ghost-protocol/sdk`, tests de cohérence Schnorr / prévente. |

Les deux se rejoignent en production via l’adresse **`GHOST_PROTOCOL_V2`** dans le `.env` du déploiement token et l’adresse **`GhostPresale`** côté UX.

## Métadonnées alignées

- **Personne** : **Rayane Hila** (orthographe alignée sur le `package.json` du dépôt Ghost Protocol V2).
- **Entreprise (copyright MIT, ce dépôt)** : **RayTech Solution**.
- **Marque / R&D** sur l’autre dépôt : **RayTech R&D** (champ `author` / `copyright` Electron dans Ghost Protocol V2) — à voir comme la ligne technique ou la marque produit du même groupe ; adapte si ta structure juridique impose une seule dénomination partout.
- **Contact** : [rayane.h42@proton.me](mailto:rayane.h42@proton.me).

## URL GitHub

Dans le [`README.md`](../README.md), section **Écosystème GitHub**, remplace les placeholders `https://github.com/…/…` par :

1. Ce dépôt jeton : **https://github.com/RT01010011/Ghost-token**
2. L’URL **exacte** du dépôt Ghost Protocol V2 (à compléter quand il est public).

Tu peux aussi ajouter dans `package.json` :

```json
"repository": {
  "type": "git",
  "url": "https://github.com/TON_COMPTE/TON_REPO_JETON.git"
}
```

(même chose dans l’autre dépôt pour le lien inverse si tu veux une boucle claire).

## E-mail Git (important)

L’e-mail utilisé pour **`git commit`** (`git config user.email`) apparaît dans l’historique public GitHub. Pour ce projet, l’adresse de contact officielle du dépôt est **rayane.h42@proton.me** — tu peux l’utiliser pour `user.email` afin d’aligner commits et documentation.

```bash
cd "chemin/vers/dépôt tokken"
git config user.name "Rayane Hila"
git config user.email "rayane.h42@proton.me"
```

Répète avec le même couple **name / email** sur le dépôt Ghost Protocol V2 si tu veux une traçabilité cohérente.
