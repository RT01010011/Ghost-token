# Dépôt GHOST Token

Compilation et déploiement du jeton **GHOST** et de l’écosystème associé sur **Base** (Hardhat, Solidity 0.8.28).

## Tokenomics (référence)

| Tranche | GHOST | % du supply 33 M |
|--------|-------|------------------|
| Airdrop | 6 600 000 | 20 % |
| Trésorerie (vesting) | 5 940 000 | 18 % |
| Équipe (vesting) | 5 610 000 | 17 % |
| Récompenses (timelock) | 6 600 000 | 20 % |
| Liquidité | 3 300 000 | 10 % |
| Prévente | 4 950 000 | 15 % |

Détail des flux post-déploiement, vesting, splitter ETH et checklist mainnet : **[`docs/TOKENOMICS.md`](docs/TOKENOMICS.md)**.

## Documentation

- [Tokenomics et flux on-chain](docs/TOKENOMICS.md)
- [Structure du dépôt et variables d’environnement](docs/STRUCTURE-ET-DEPLOIEMENT.md)
- [Contrats Solidity — rôles et déploiement](contrat%20tokken/README.md)
- [Publication sur GitHub (remote, push)](docs/GITHUB-PUBLICATION.md)
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

**Avant un déploiement mainnet** : vérifier `.env` (wallets, `GHOST_PRESALE_*`, `GHOST_PROTOCOL_V2`) et lancer `npm run compile:token` ; voir aussi la fin de [`docs/TOKENOMICS.md`](docs/TOKENOMICS.md).

## Sécurité

- Ne jamais committer `.env`, clés privées ni secrets RPC.
- Sur Base mainnet / Sepolia, le script d’écosystème **exige** les adresses wallet et les fenêtres de prévente dans `.env` (voir [SECURITY.md](SECURITY.md)).
- Les contrats ne remplacent pas un audit indépendant avant toute utilisation en production.

## Licence

[MIT](LICENSE)
