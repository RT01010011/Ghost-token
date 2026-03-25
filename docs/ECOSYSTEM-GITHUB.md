# Relier ce dépôt aux autres projets GitHub

## Rôles

| Dépôt | Rôle |
|-------|------|
| **Ce dépôt** (`depot-ghost-tokken` / jeton GHOST) | Contrats Solidity du jeton, prévente, bonus, scripts `deploy:ecosystem:base`, tokenomics documentée. |
| **Ghost Protocol V2** — [dépôt GitHub](https://github.com/RT01010011/ghost-protocol-v2) (clone local possible : `ghost protocol V2  dépot`) | `GhostProtocolV2` on-chain, UX Electron, `ghost-schnorr-libz.js`, paquet `@ghost-protocol/sdk`, tests protocole & cohérence Schnorr / prévente. |

Les deux se rejoignent en production via l’adresse **`GHOST_PROTOCOL_V2`** dans le `.env` du déploiement token et l’adresse **`GhostPresale`** côté UX.

## Métadonnées alignées

- **Personne** : **Rayane Hila** (orthographe alignée sur le `package.json` du dépôt Ghost Protocol V2).
- **Entreprise (copyright MIT, ce dépôt)** : **RayTech Solution**.
- **Marque / R&D** sur l’autre dépôt : **RayTech R&D** (champ `author` / `copyright` Electron dans Ghost Protocol V2) — à voir comme la ligne technique ou la marque produit du même groupe ; adapte si ta structure juridique impose une seule dénomination partout.
- **Contact** : [rayane.h42@proton.me](mailto:rayane.h42@proton.me).

## URL GitHub

Liens publics :

- **Jeton GHOST (ce dépôt)** : [https://github.com/RT01010011/Ghost-token](https://github.com/RT01010011/Ghost-token)
- **Ghost Protocol V2** : [https://github.com/RT01010011/ghost-protocol-v2](https://github.com/RT01010011/ghost-protocol-v2)

Exemples de champ `repository` dans `package.json` :

- **Ghost-token** : `https://github.com/RT01010011/Ghost-token.git` (déjà renseigné ici).
- **ghost-protocol-v2** : `https://github.com/RT01010011/ghost-protocol-v2.git` (à ajouter dans l’autre dépôt si absent).

## E-mail Git (important)

L’e-mail utilisé pour **`git commit`** (`git config user.email`) apparaît dans l’historique public GitHub. Pour ce projet, l’adresse de contact officielle du dépôt est **rayane.h42@proton.me** — tu peux l’utiliser pour `user.email` afin d’aligner commits et documentation.

```bash
cd "chemin/vers/dépôt tokken"
git config user.name "Rayane Hila"
git config user.email "rayane.h42@proton.me"
```

Répète avec le même couple **name / email** sur le dépôt Ghost Protocol V2 si tu veux une traçabilité cohérente.
