# Dépôt GHOST Token

Compilation et déploiement du jeton **GHOST** et de l’écosystème associé sur **Base** (Hardhat, Solidity 0.8.28).

## Documentation

- [Structure du dépôt et variables d’environnement](docs/STRUCTURE-ET-DEPLOIEMENT.md)
- [Contrats Solidity — rôles et déploiement](contrat%20tokken/README.md)
- [Politique de sécurité et signalement](SECURITY.md)

## Prérequis

- Node.js 20+
- Un fichier `.env` local (non versionné), calqué sur [`.env.example`](.env.example)

## Installation

```bash
npm ci
```

## Vérification locale

```bash
npm run compile:token
npm run estimate:deploy:gas
```

## Déploiement (Base mainnet)

Le wallet associé à `PRIVATE_KEY` doit disposer d’**ETH sur Base** pour le gas.

```bash
npm run deploy:ecosystem:base
```

Les adresses déployées sont écrites dans `deployed-addresses-ghost-ecosystem.json` (fichier ignoré par Git — ne pas le committer s’il contient des données sensibles).

## Sécurité

- Ne jamais committer `.env`, clés privées ni secrets RPC.
- Sur Base mainnet / Sepolia, le script d’écosystème **exige** les adresses wallet et les fenêtres de prévente dans `.env` (voir [SECURITY.md](SECURITY.md)).
- Les contrats ne remplacent pas un audit indépendant avant toute utilisation en production.

## Licence

[MIT](LICENSE)
