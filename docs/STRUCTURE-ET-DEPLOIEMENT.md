# Arborescence du dépôt et déploiement

## Dossiers et fichiers (sources — hors `node_modules`, caches, artefacts)

```
dépôt tokken/
├── README.md                      # Point d’entrée : commandes et liens
├── package.json                   # Scripts npm et dépendances Hardhat
├── package-lock.json              # Verrouillage des versions npm
├── tsconfig.json                  # Compilation TypeScript des scripts
├── hardhat-ghost-token.config.ts  # Réseaux Base / Sepolia, chemins, Solidity 0.8.28
├── .env.example                   # Modèle de variables (sans secrets)
├── .gitignore
├── docs/
│   └── STRUCTURE-ET-DEPLOIEMENT.md  # Ce fichier
├── scripts/
│   ├── deploy-ghost-ecosystem.ts  # Déploiement token + vestings + timelock + splitter + presale + bonus + transferts
│   ├── deploy-ghost-token.ts      # Déploiement GhostToken seul + vérif optionnelle
│   └── estimate-ghost-deploy-gas.ts # Estimation gas en réseau Hardhat local
├── tests/
│   ├── README.md                  # Suite Hardhat (183 scénarios)
│   ├── helpers/                   # presaleBonus (aligné registre bonus)
│   └── *.test.ts                  # Token, prévente, sécurité, cohérence Schnorr
├── audits/
│   └── README.md                  # Statut audits externes & transparence
├── CONTRIBUTING.md
├── .gitattributes                 # Fin de ligne (LF) pour Solidity / TS
└── contrat tokken/
    ├── README.md                  # Contrats : ordre de déploiement et API
    ├── *.sol                      # Contrats de production
    └── mocks/
        ├── MockGhostProtocolV2ForPresale.sol  # Tests + estimate gas (local)
        └── ReentrantRefundAttacker.sol        # Test réentrance refund (local)
```

Générés localement (ne pas committer) : `node_modules/`, `cache-ghost-token/`, `artifacts-ghost-token/`, `typechain-types/`, `.env`, `deployed-addresses-*.json`.

## Variables d’environnement

- **`.env`** : fichier **local** avec secrets et valeurs réelles (listé dans `.gitignore`). **Rien ne remplace** ton `.env` déjà rempli : on ne le recrée pas via le dépôt.
- **`.env.example`** : **modèle** listant toutes les **clés** possibles (sans secrets), à jour avec les scripts. Copier vers `.env` uniquement pour une **nouvelle** machine.

Obligatoires pour `deploy:ecosystem:base` sur **Base mainnet / Sepolia** : `PRIVATE_KEY`, `BASE_RPC_URL`, `GHOST_PROTOCOL_V2`, **toutes** les clés `GHOST_WALLET_*` / `GHOST_PRESALE_ADMIN`, **`GHOST_PRESALE_START_UNIX`** et **`GHOST_PRESALE_END_UNIX`** (aucune adresse ni date implicite pour la prod). En pratique aussi `BASESCAN_API_KEY` pour la vérification des contrats. Sur Hardhat local (31337), des valeurs par défaut de développement peuvent encore s’appliquer pour les wallets.

## Commandes

```bash
npm install
npm run compile:token
npm run test:token
npm run estimate:deploy:gas
npm run deploy:ecosystem:base
```

Les adresses déployées sont écrites dans `deployed-addresses-ghost-ecosystem.json`.

Répartition du supply et flux après déploiement : [`TOKENOMICS.md`](./TOKENOMICS.md). Premier push GitHub : [`GITHUB-PUBLICATION.md`](./GITHUB-PUBLICATION.md).

## Contact

**Rayane Hila** — **RayTech Solution** — [rayane.h42@proton.me](mailto:rayane.h42@proton.me).
