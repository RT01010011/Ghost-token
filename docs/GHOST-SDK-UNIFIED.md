# `ghost-sdk-unified.js` — SDK unifié (Node / Electron)

Fichier à la **racine du dépôt** : `ghost-sdk-unified.js`.

## Rôle

- **Client `GhostProtocolV2`** : lecture, encodage `createAccount`, décodage de txs, scan d’événements.
- **Bonus prévente** : `computePresaleBonusCredentialId` (même formule que `GhostPresaleBonusRegistry._credentialId`), plus helpers alignés sur le **vrai** ABI du registre (`registered`, `bonusBps`, `bonusGhostAmount`, `credentialIdOf`).
- **`GhostSDK`** : connexion à des contrats externes + challenges / preuves Schnorr (utilise **`ghost-schnorr-libz.js`** — `sign`, `deriveCommitment`, `verifyLocally`, etc.; `keccakPacked` est exporté pour usage avancé).
- **`GHOST_VERIFIER_SOLIDITY`** : snippet Solidity optionnel pour contrats tiers (non déployé par défaut dans ce repo).

## Dépendance

```js
const { ethers } = require('ethers');
const GhostSchnorr = require('./ghost-schnorr-libz.js');
const Unified = require('./ghost-sdk-unified.js');
```

## Lien avec `@ghost-protocol/sdk` (dossier `sdk/`)

| Zone | `sdk/` (TypeScript npm) | `ghost-sdk-unified.js` |
|------|-------------------------|-------------------------|
| Protocole V2 minimal | ABI réduit + `GhostProtocolV2Client` | ABI étendu + scans + vues `accountExistsFor`, `getNonce`, … |
| Bonus prévente | `computePresaleBonusCredentialId` | Idem + **lecture on-chain** registre corrigée |
| Schnorr / preuves | Non (voir `ghost-schnorr-libz.js`) | `GhostSDK` + lib Schnorr |
| **Prévente `buyTokensGhost` / `claimGhost`** | Non dans `sdk/` — voir `ghost-schnorr-libz.prepareBuyPresaleGhost` et **`prepareClaimPresaleGhost`** | Même lib Schnorr ; cohérence testée avec `GhostPresale` |

**Relier contrats de déploiement ↔ protocole ↔ SDK / Schnorr** (schéma, `claim`, bonus) : **`docs/PRESALE-DEPLOYMENT-SDK-LINK.md`**.

Pour une app **Electron** actuelle, `require('./ghost-sdk-unified.js')` est le plus direct. Pour un package **TypeScript** publié, continuer à utiliser ou étendre `sdk/src/`.

## Corrections appliquées (cohérence repo)

1. Import **`ethers`** en tête de fichier (évite `ReferenceError` sous Node).
2. **`buildExternalChallenge`** : hash via `ethers.solidityPacked` (ne s’appuie plus sur un appel invalide à `keccakPacked([...])`).
3. **Registre bonus** : le contrat n’a pas `isEligible` / `getBonusPercent` par `credentialId` — utiliser `checkPresaleBonusRegistered`, `getPresaleBonusBps`, `getPresaleBonusGhostAmount`, `getPresaleCredentialIdOnChain`.

## Chargement rapide

```bash
node -e "const u=require('./ghost-sdk-unified.js'); console.log(u.GHOST_SDK_VERSION, Object.keys(u).length);"
```

(À lancer depuis la racine du dépôt.)

## Suite sécurité complète (protocole + jeton + SDK unifié)

```bash
npm run test:sdk-security-suite
```

Détail des périmètres et limites : **`docs/SDK-SECURITY-TESTS.md`**.

## Cohérence avec les contrats jeton / prévente (Hardhat)

Les formules bonus sont aussi vérifiées **contre les contrats déployés** (même logique que `sdk/src/presaleBonus.ts`) :

```bash
npm run test:token:sdk-coherence
```

Voir `tests/PresaleSdkCoherence.test.ts` : achat **`receive()`** (ETH direct vers le contrat) + **`buy()`** payable, puis `credentialId` SDK = `credentialIdOnChain` après `recordEligibility`.

## Tests automatisés (sync UX + sécurité)

```bash
npm run test:sdk-unified
```

Couverture principale :

- **Bonus** : domaine par défaut, `computePresaleBonusCredentialId` = `solidityPacked` + `keccak256` (comme `GhostPresaleBonusRegistry`), sensibilité au montant.
- **Sync `index.html`** : `GhostSchnorr.prepareCreateAccount` / `deriveAll` + `GhostProtocolV2Client.encodeCreateAccount` / `decodeCreateAccountCalldata` ; `keccakPacked` = challenges type `approve` (même packing que la lib UX).
- **Sécurité `GhostSDK`** : challenge lié à l’adresse du contrat et au nonce ; clé manquante → erreur ; `K` incohérent avec `Px,Py` → échec `verifyLocally` ; `connect` adresse invalide ; `executeExternal` sans `connect` → erreur ; `checkPresaleBonus(bytes32)` ne renvoie pas un faux positif.

**Important** : le snippet `GHOST_VERIFIER_SOLIDITY` embarqué dans `ghost-sdk-unified.js` utilise une fonction `buildGhostChallenge` **différente** de `GhostSDK.buildExternalChallenge` (format des champs). Pour une vérif on-chain réelle, il faut **aligner** le même `keccak256(abi.encodePacked(...))` côté contrat et côté JS — sinon les preuves ne passeront pas à l’exécution Solidity.
