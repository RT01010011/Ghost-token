# Dépôt GHOST Token

Compilation et déploiement du jeton **GHOST** et de l’écosystème associé sur **Base** (Hardhat, Solidity 0.8.28).

**Référence déploiement mainnet** : travailler depuis ce dossier (`dépôt tokken` sur le Bureau). Une copie de travail peut exister ailleurs (ex. dépôt « Ghost Protocol V2 ») : resynchroniser les contrats et `scripts/deploy-ghost-ecosystem.ts` ici avant tout `npm run deploy:ecosystem:base`.

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
| **Ghost Protocol V2** | Protocole Schnorr, UI desktop Electron, `ghost-schnorr-libz.js`, SDK, tests protocole | [github.com/RT01010011/ghost-protocol-v2](https://github.com/RT01010011/ghost-protocol-v2) |

Détail des titulaires, Git et contact : [`docs/TITULAIRE-LICENCE.md`](docs/TITULAIRE-LICENCE.md) et [`docs/ECOSYSTEM-GITHUB.md`](docs/ECOSYSTEM-GITHUB.md).

## Documentation

- [Tokenomics et flux on-chain](docs/TOKENOMICS.md)
- [Prévente, registre bonus +5 % et campagne airdrop 100 GHOST](docs/PREVENTE-AIRDROP-COMMUNAUTE.md)
- [Prévente — lien déploiement ↔ SDK (FR/EN)](docs/PRESALE-DEPLOYMENT-SDK-LINK.md)
- [Notes pré-GitHub / synchro contrats–SDK (bilingue)](docs/PRE-GITHUB-DEV-NOTES.md)
- [Structure du dépôt et variables d’environnement](docs/STRUCTURE-ET-DEPLOIEMENT.md)
- [Contrats Solidity — rôles et déploiement](contrat%20tokken/README.md)
- [Publication sur GitHub (remote, push)](docs/GITHUB-PUBLICATION.md)
- [Titulaire de la licence / société / Git](docs/TITULAIRE-LICENCE.md)
- [Lien avec les autres dépôts GitHub](docs/ECOSYSTEM-GITHUB.md)
- [Politique de sécurité et signalement](SECURITY.md)
- [Contribuer](CONTRIBUTING.md)
- [Audits externes (statut)](audits/README.md)
- [Tests Hardhat](tests/README.md)
- [SDK & intégration plateforme (Ghost Protocol)](sdk/README.md)

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

La suite **~224 tests** Hardhat couvre le token, la prévente, le splitter, les registres bonus / welcome, la cohérence SDK et Schnorr (`ghost-schnorr-libz.js`). Détail : [`tests/README.md`](tests/README.md). Rapport JSON : `npm run test:token:json`. Sur Windows en cas de manque mémoire : `NODE_OPTIONS=--max-old-space-size=8192` avant `npm run test:token`.

## Audits externes

Statut et feuille de route : [`audits/README.md`](audits/README.md). Aucun rapport d’audit tiers n’est publié dans ce dossier pour l’instant ; le code est couvert par une **suite de tests Hardhat** (~224 scénarios) et une documentation on-chain détaillée.

## International

La documentation est principalement en **français** (cible projet). Pour une audience investisseurs internationale, une version **anglaise** du README / tokenomics peut être ajoutée en parallèle (`README.en.md`, etc.).

## Déploiement (Base mainnet)

Le wallet associé à `PRIVATE_KEY` doit disposer d’**ETH sur Base** pour le gas.

```bash
npm run deploy:ecosystem:base
```

Les adresses déployées sont écrites dans `deployed-addresses-ghost-ecosystem.json` (fichier ignoré par Git — ne pas le committer s’il contient des données sensibles).

**Avant un déploiement mainnet** : vérifier `.env` (wallets, `GHOST_PRESALE_*`, `GHOST_PROTOCOL_V2`) et lancer `npm run compile:token` ; voir aussi la fin de [`docs/TOKENOMICS.md`](docs/TOKENOMICS.md).

## Prévente GHOST : soft cap, finalisation et UX

Documentation **produit / dev** (ne pas dupliquer en commentaires dans `index.html` ou les scripts ; maintenir ici).

- **`GHOST_PRESALE_SOFT_CAP_ETH=0`** est la valeur standard (voir [`.env.example`](.env.example)). Dans `GhostPresale`, si `softCapEth` est nul, **`finalize()`** n’impose aucun plancher de levée globale : même une petite partie du hard cap vendue (par ex. 5 %) permet, après `endTime`, de finaliser et de distribuer les **jetons** aux contributeurs au prorata — ce n’est pas un scénario « seuil minimum non atteint = remboursement collectif ».
- Les fonctions **`enableRefundMode()`** et **`refund()`** du contrat ne sont pertinentes que pour un déploiement avec **soft cap strictement positif** et une levée **restée sous** ce seuil ; avec soft cap à 0, `enableRefundMode()` revert toujours.
- L’**UX** (`index.html`) n’expose que le **remboursement volontaire** pendant la fenêtre d’achat (`remboursementVolontaire`), pas de bouton « remboursement soft cap », ce qui correspond à cette configuration.

## Sécurité

- Ne jamais committer `.env`, clés privées ni secrets RPC.
- Sur Base mainnet / Sepolia, le script d’écosystème **exige** les adresses wallet et les fenêtres de prévente dans `.env` (voir [SECURITY.md](SECURITY.md)).
- Avant tout déploiement mainnet, suivre la checklist projet (`.env`, compilation, voir [`docs/TOKENOMICS.md`](docs/TOKENOMICS.md)).

## Contact

**Rayane Hila** — **RayTech Solution** — [rayane.h42@proton.me](mailto:rayane.h42@proton.me) (questions générales ; pour les failles de sécurité, voir [SECURITY.md](SECURITY.md)).

## English (short overview)

**GHOST** ERC-20, **presale**, **+5 % bonus registry**, **100 GHOST welcome airdrop** registry, Hardhat deploy for **Base**, **TypeScript SDK** and **unified JS**. Deployment ↔ SDK map and bilingual pre-release checklist: [`docs/PRESALE-DEPLOYMENT-SDK-LINK.md`](docs/PRESALE-DEPLOYMENT-SDK-LINK.md), [`docs/PRE-GITHUB-DEV-NOTES.md`](docs/PRE-GITHUB-DEV-NOTES.md).

## Licence

[MIT](LICENSE) — copyright **RayTech Solution** (2026). Auteur principal du code et de l’écosystème : **Rayane Hila** (voir [`docs/TITULAIRE-LICENCE.md`](docs/TITULAIRE-LICENCE.md)).
