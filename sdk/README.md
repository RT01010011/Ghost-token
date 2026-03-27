# @ghost-protocol/sdk

Utilitaires TypeScript pour **Ghost Protocol V2** (contrat `GhostProtocolV2.sol`) et la **tokenomics GHOST** (`GhostToken.sol`).

**Prévente, registre bonus +5 %, campagne 100 GHOST / airdrop** : voir **[docs/PREVENTE-AIRDROP-COMMUNAUTE.md](../docs/PREVENTE-AIRDROP-COMMUNAUTE.md)** (référence unique côté produit).

## SDK unifié JavaScript (racine du dépôt)

Pour **Electron** ou scripts Node sans build TypeScript, voir **`ghost-sdk-unified.js`** à la racine du repo (client protocole étendu, bonus prévente, `GhostSDK` + Schnorr). Documentation : **`docs/GHOST-SDK-UNIFIED.md`**.

**Tests sécurité / cohérence (protocole + jeton + SDK unifié)** : **`docs/SDK-SECURITY-TESTS.md`** — commande `npm run test:sdk-security-suite`.

## Installation (depuis le dépôt)

```bash
cd sdk && npm install && npm run build
```

Dans un autre projet :

```json
"dependencies": {
  "@ghost-protocol/sdk": "file:../chemin/vers/ghost-protocol-v2/sdk",
  "ethers": "^6.16.0"
}
```

## Campagne bienvenue (calculs SDK)

Voir **[docs/PREVENTE-AIRDROP-COMMUNAUTE.md](../docs/PREVENTE-AIRDROP-COMMUNAUTE.md)** § 3. API : `planWelcomeCampaign`, `defaultWelcomeCampaignPlan`, `budgetFromWalletPercent`, constantes `ONE_HUNDRED_GHOST_WEI`, `WELCOME_CAMPAIGN_MAX_BUDGET_WEI`, etc.

Exemple :

```ts
import { ethers } from "ethers";
import { defaultWelcomeCampaignPlan, ghostToWei } from "@ghost-protocol/sdk";

const provider = new ethers.JsonRpcProvider(RPC);
const ghost = new ethers.Contract(GHOST_TOKEN, ["function balanceOf(address) view returns (uint256)"], provider);
const bal = await ghost.balanceOf(AIRDROP_WALLET);
const plan = defaultWelcomeCampaignPlan(bal);
console.log(plan.maxFullPayouts.toString(), "versements de 100 GHOST possibles");
```

### Lien compte protocole ↔ adresse ETH

Sur la chaîne, `createAccount` ne stocke **pas** l’adresse wallet de l’utilisateur. Pour envoyer des GHOST :

1. **Indexer** les txs `createAccount` et lire `pseudo1` via `decodeCreateAccountFromTx` / `decodeCreateAccountFromReceipt`.
2. **Côté app** : faire lier par l’utilisateur `(pseudo1 ou preuve) → adresse de réception` (base de données signée, Merkle, ou formulaire KYC léger selon ton cadre juridique).
3. **Payer** : depuis le wallet airdrop, `GhostToken.transfer(recipient, ONE_HUNDRED_GHOST_WEI)` ou un contrat **Merkle claim** (à ajouter si tu veux du 100 % on-chain sans liste manuelle).

### 5 % de quoi exactement ?

- **`budgetFromWalletPercent(balance, 500)`** → 5 % du **solde actuel** du wallet airdrop.
- **`fivePercentOfAirdropAllocationWei()`** → 5 % des **6,6 M GHOST** théoriques de la tranche airdrop (utile pour le plafond de planification avant que les GHOST soient sur le wallet).

## Lien avec les contrats de déploiement (GhostPresale + protocole)

Le dépôt relie explicitement :

- **`GhostPresale.sol`** : achat identifié Ghost via **`buyTokensGhost`** — l’appelant fournit **`pseudo2Commit`, `key1Commit`, `key2Commit`** (calldata) ; le contrat vérifie `keccak256(abi.encodePacked(...)) == pseudo1ToCommit(pseudo1)` puis les preuves Schnorr (`IGhostProtocolV2ForPresale` : **`pseudo1ToCommit` uniquement** — le V2 déployé n’expose pas les commits individuels on-chain).
- **Preuves off-chain** : **`prepareBuyPresaleGhost`** dans **`ghost-schnorr-libz.js`** (racine du repo), pas dans ce paquet npm — même challenges que Solidity (`buy_presale_p2` / `buy_presale_k1`). L’UX Electron (`index.html`) utilise cette lib.
- **Après finalisation** : **`claim()`** pour les achats wallet classique (signature de l’adresse créditée) ; **`claimGhost(...)`** + `prepareClaimPresaleGhost` pour les positions ouvertes via **`buyTokensGhost`** (jetons vers `payout`). Les deux exclusifs par adresse `recipient`.
- **Pendant la prévente** (`<= endTime`) : **`remboursementVolontaire()`** pour annuler sa part ; après la fin → **`finalize`** puis **`claim` / `claimGhost`** — voir `contrat tokken/GUIDE-PREVENTE-FLUX-COMPLET.md`.

**Documentation détaillée (schéma + table + commandes de test)** : **`docs/PRESALE-DEPLOYMENT-SDK-LINK.md`**.

## Bonus prévente +5 % (`GhostPresaleBonusRegistry`)

Même formule que le contrat pour recalculer l’empreinte :

```ts
import { computePresaleBonusCredentialId, DEFAULT_BONUS_CREDENTIAL_DOMAIN } from "@ghost-protocol/sdk";

const id = computePresaleBonusCredentialId({
  buyer: userAddress,
  ghostPurchasedWei: amountWei,
  presaleAddress: PRESALE,
  chainId: 8453n,
  credentialDomainSeparator: DEFAULT_BONUS_CREDENTIAL_DOMAIN,
});
```

## Client protocole

```ts
import { GhostProtocolV2Client } from "@ghost-protocol/sdk";

const client = new GhostProtocolV2Client(PROTOCOL_ADDR, provider);
const commit = await client.pseudo1ToCommit("alice");
const data = client.encodeCreateAccount({ pseudo1: "bob", ... });
```
