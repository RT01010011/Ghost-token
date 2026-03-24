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

## Écosystème GitHub (même organisation / auteur)

Ce dépôt porte le **contrat jeton GHOST**, la **prévente** et les **scripts Hardhat** pour **Base**. Le **protocole Ghost** (Schnorr, application, `ghost-schnorr-libz.js`, SDK npm) vit dans le dépôt **Ghost Protocol V2** — auteur **Rayane Hila**, ligne produit **RayTech R&D** dans les métadonnées de ce projet.

| Dépôt | Contenu principal | URL |
|-------|-------------------|-----|
| **Ghost-token** (ce dépôt) | ERC-20, prévente, déploiement Base, tests Hardhat | [github.com/RT01010011/Ghost-token](https://github.com/RT01010011/Ghost-token) |
| **Ghost Protocol V2** | Protocole Schnorr, application, SDK npm (source hors de ce repo) | *À lier ici quand le dépôt public est publié* (même organisation ou compte GitHub). |

Détail des titulaires, Git et contact : [`docs/TITULAIRE-LICENCE.md`](docs/TITULAIRE-LICENCE.md) et [`docs/ECOSYSTEM-GITHUB.md`](docs/ECOSYSTEM-GITHUB.md).

## Documentation

- [Tokenomics et flux on-chain](docs/TOKENOMICS.md)
- [Structure du dépôt et variables d’environnement](docs/STRUCTURE-ET-DEPLOIEMENT.md)
- [Contrats Solidity — rôles et déploiement](contrat%20tokken/README.md)
- [Publication sur GitHub (remote, push)](docs/GITHUB-PUBLICATION.md)
- [Titulaire de la licence / société / Git](docs/TITULAIRE-LICENCE.md)
- [Lien avec les autres dépôts GitHub](docs/ECOSYSTEM-GITHUB.md)
- [Politique de sécurité et signalement](SECURITY.md)
- [Contribuer](CONTRIBUTING.md)
- [Audits (statut & transparence)](audits/README.md)
- [Tests Hardhat](tests/README.md)

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
npm run test:token
npm run estimate:deploy:gas
```

La suite **183 tests** Hardhat couvre le token, la prévente, le splitter, le registre bonus et la cohérence Schnorr (`ghost-schnorr-libz.js`). Détail : [`tests/README.md`](tests/README.md). Sur Windows en cas de manque mémoire : `NODE_OPTIONS=--max-old-space-size=8192` avant `npm run test:token`.

## Audits externes

Politique et statut : [`audits/README.md`](audits/README.md) — pas d’audit tiers publié à ce jour ; les tests automatisés ne remplacent pas un audit professionnel.

## International

La documentation est principalement en **français** (cible projet). Pour une audience investisseurs internationale, une version **anglaise** du README / tokenomics peut être ajoutée en parallèle (`README.en.md`, etc.).

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

## Contact

**Rayane Hila** — **RayTech Solution** — [rayane.h42@proton.me](mailto:rayane.h42@proton.me) (questions générales ; pour les failles de sécurité, voir [SECURITY.md](SECURITY.md)).

## Licence

[MIT](LICENSE) — copyright **RayTech Solution** (2026). Auteur principal du code et de l’écosystème : **Rayane Hila** (voir [`docs/TITULAIRE-LICENCE.md`](docs/TITULAIRE-LICENCE.md)).
