# Tests automatisés — jeton GHOST & prévente

Documentation de référence pour **README / releases GitHub** : commandes exécutées à la racine du dépôt, portée des suites, résultats de validation manuelle récents.

## Prérequis

```bash
npm install
```

Toutes les commandes ci-dessous se lancent depuis la **racine** du repository (`ghost-protocol-v2`).

## Commandes principales

| Commande | Rôle |
|----------|------|
| `npm run compile:token` | Compile les contrats sous `contrat tokken/` (config `hardhat-ghost-token.config.ts`). |
| `npm run verify:presale:sans-eth` | `compile:token` puis **`tests/PresaleSdkCoherence.test.ts`** — cohérence prévente ↔ `ghost-schnorr-libz.js` ↔ `@ghost-protocol/sdk` (bonus registre). **Aucun ETH requis.** |
| `npm run test:token` | **Toute** la suite `tests/*.test.ts` (prévente, token, vesting, timelock, splitter, registre bonus, sécurité, cohérence SDK). |
| `npm run test:token:json` | Même suite avec reporter Mocha **JSON** → fichier `test-results-hardhat.json` à la racine (voir `scripts/export-hardhat-test-json.cjs`). |

### Protocole Ghost (hors dossier `contrat tokken/`)

| Commande | Rôle |
|----------|------|
| `npm run test:protocol:sdk-coherence` | Cohérence client / SDK ↔ `GhostProtocolV2` (config `hardhat.config.ts`). |

## Résultats enregistrés (validation manuelle)

*À mettre à jour après chaque campagne de tests majeure (copier-coller la sortie `passing` dans les releases GitHub si besoin).*

| Date (UTC) | Commande | Résultat |
|------------|----------|----------|
| 2026-03-24 | `npm run verify:presale:sans-eth` | **10 passing** — cohérence SDK / Schnorr / prévente / registre bonus. |
| 2026-03-24 | `npm run test:token` | **220 passing** — suite complète `tests/` (dont `GhostSupplemental.test.ts`). |

> Les nombres exacts peuvent évoluer si de nouveaux tests sont ajoutés ; l’objectif en CI est **0 échec** sur ces commandes.

## Couverture fonctionnelle (résumé)

- **GhostToken** : supply fixe, allocations, ERC20, permit, votes.
- **GhostPresale** : `buy` / `receive`, caps, soft/hard cap, `finalize`, `claim`, remboursements, `buyTokensGhost` / `claimGhost` (commits + Schnorr), `remboursementVolontaire`, états et accès admin.
- **GhostVesting / GhostTimelock** : règles de libération et reverts.
- **GhostEthProceedsSplitter** : bps, somme 10 000, répartition.
- **GhostPresaleBonusRegistry** : éligibilité, `credentialId`, bonus.
- **Cohérence SDK** (`PresaleSdkCoherence`) : même formule `credentialId` que le contrat ; preuves `prepareBuyPresaleGhost` / `prepareClaimPresaleGhost` acceptées on-chain.

Les contrats exécutés sont les **sources Solidity réelles** du dépôt ; le mock `MockGhostProtocolV2ForPresale` ne remplace que la vue minimale `IGhostProtocolV2ForPresale` pour les tests **sans** fork (voir commentaires dans les tests).

## Tests manuels complémentaires (non remplacés par Hardhat)

- **Fork Base local** : `npm run node:token:fork` puis `npm run deploy:presale:fork` — V2 réel + prévente déployée ; voir `docs/PRESALE-E2E-TESTNET.md` et `deployed-addresses-fork-presale.json` (gitignored).
- **Base Sepolia** : `npm run deploy:presale:e2e:sepolia` — voir `docs/PRESALE-E2E-TESTNET.md`.

## Suggestion CI (GitHub Actions)

Sur chaque PR touchant `contrat tokken/` ou `tests/` :

```yaml
- run: npm ci
- run: npm run verify:presale:sans-eth
- run: npm run test:token
```

(Optionnel) ajouter `npm run test:protocol:sdk-coherence` si le PR modifie le protocole ou le SDK associé.
