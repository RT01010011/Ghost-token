# Tests Hardhat — jeton GHOST & prévente

## Contenu

| Fichier | Rôle |
|---------|------|
| `GhostEcosystem.test.ts` | GhostToken, GhostPresale, vesting, timelock, flux principaux |
| `GhostExtensive.test.ts` | Cas étendus presale, token, votes, vesting, timelock |
| `GhostSecurity.test.ts` | Invariants sécurité, caps, refund, réentrance (`ReentrantRefundAttacker`) |
| `GhostEthProceedsSplitter.test.ts` | Splitter ETH |
| `GhostPresaleBonusRegistry.test.ts` | Registre bonus prévente |
| `PresaleSdkCoherence.test.ts` | Cohérence `ghost-schnorr-libz.js` + helper bonus ↔ contrats |
| `helpers/presaleBonus.ts` | Formules alignées sur `GhostPresaleBonusRegistry` (équivalent SDK) |

**Nombre de tests** : **183** scénarios Mocha (état vérifié avec `npm run test:token`).

Origine : suite portée depuis le dépôt **[Ghost Protocol V2](https://github.com/RT01010011/ghost-protocol-v2)** (dossier `test-ghost-token/` en amont), adaptée pour ce dépôt autonome (`./helpers/presaleBonus`, `../ghost-schnorr-libz.js`).

## Commandes

```bash
npm run test:token
```

Sur **Windows**, si la suite s’interrompt avec une erreur mémoire, augmenter le heap Node puis relancer :

```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run test:token
```

## Prérequis

Aucun `.env` obligatoire pour les tests : réseau **Hardhat** intégré, **MockGhostProtocolV2ForPresale** et **ReentrantRefundAttacker** dans `contrat tokken/mocks/`.
