# Tests Hardhat — jeton GHOST & prévente

## Contenu

| Fichier | Rôle |
|---------|------|
| `GhostEcosystem.test.ts` | GhostToken, GhostPresale, vesting, timelock, flux principaux |
| `GhostExtensive.test.ts` | Cas étendus presale, token, votes, vesting, timelock |
| `GhostSecurity.test.ts` | Invariants sécurité, caps, refund, réentrance (`ReentrantRefundAttacker`) |
| `GhostEthProceedsSplitter.test.ts` | Splitter ETH |
| `GhostPresaleBonusRegistry.test.ts` | Registre bonus prévente |
| `PresaleSdkCoherence.test.ts` | Cohérence `ghost-schnorr-libz.js` + **`sdk/src/presaleBonus.ts`** ↔ contrats |
| `GhostSupplemental.test.ts` | Splitter (edges), bonus registry, token, presale, vesting, timelock — couverture additionnelle |
| `helpers/presaleBonus.ts` | Réexport de `sdk/src/presaleBonus.ts` (pas de logique dupliquée) |
| `../test-node/ghost-sdk-unified.test.cjs` | Tests Node natifs (`node:test`) pour `ghost-sdk-unified.js` (hors `tests/` pour Hardhat) |

**Suite Mocha** : `npm run test:token` — **220** scénarios environ (voir `docs/TESTS-GHOST-TOKEN-PREVENTE.md`).

**Rapport JSON** : `npm run test:token:json` → `test-results-hardhat.json` (racine, ignoré par Git).

**SDK unifié JS** : `npm run test:sdk-unified` — pas de RPC, offline.

Origine : aligné sur le dépôt **[Ghost Protocol V2](https://github.com/RT01010011/ghost-protocol-v2)** (`test-ghost-token/` en amont). Ce dépôt utilise le dossier **`tests/`** et le paquet **`sdk/`** pour `PresaleSdkCoherence`.

## Commandes

```bash
npm run compile:token
npm run test:token
npm run test:token:json
npm run test:token:sdk-coherence
npm run test:sdk-unified
npm run verify:presale:sans-eth
```

Fork Base + déploiement prévente UX (voir `docs/PRESALE-E2E-TESTNET.md`) :

```bash
npm run node:token:fork
# autre terminal :
npm run deploy:presale:fork
```

Base Sepolia E2E :

```bash
npm run deploy:presale:e2e:sepolia
```

Sur **Windows**, si la suite Mocha s’interrompt (mémoire) :

```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run test:token
```

## Prérequis

Aucun `.env` obligatoire pour les tests Hardhat : réseau intégré, **MockGhostProtocolV2ForPresale** et **ReentrantRefundAttacker** dans `contrat tokken/mocks/`.

Recompiler le SDK TypeScript si tu modifies `sdk/src/` :

```bash
npm run build:sdk
```

## Contact

**Rayane Hila** — **RayTech Solution** — [rayane.h42@proton.me](mailto:rayane.h42@proton.me)
