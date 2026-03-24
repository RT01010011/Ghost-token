# Contrats — référence déploiement

Documentation **hors chaîne** : rôles des contrats et des fonctions. Les fichiers `.sol` sont réduits au code et au `SPDX-License-Identifier` pour la publication / vérification sur explorateur.

Sources déployées via **[`../scripts/deploy-ghost-ecosystem.ts`](../scripts/deploy-ghost-ecosystem.ts)** (`npm run deploy:ecosystem:base` à la racine du dépôt).

Ordre d’instanciation (aligné sur ce script) :

| Ordre | Fichier | Contrat | Rôle |
|------|---------|---------|------|
| 1 | [`GhostToken.sol`](./GhostToken.sol) | `GhostToken` | ERC20 fixe 33 M GHOST ; mint unique vers le déployeur puis distribution. |
| 2 | [`GhostVesting.sol`](./GhostVesting.sol) | `GhostVesting` ×2 | Vesting équipe et trésorerie. |
| 3 | [`GhostTimelock.sol`](./GhostTimelock.sol) | `GhostTimelock` | Verrouillage de la tranche récompenses jusqu’à une date. |
| 4 | [`GhostEthProceedsSplitter.sol`](./GhostEthProceedsSplitter.sol) | `GhostEthProceedsSplitter` | Réception des ETH au `finalize()` du presale ; ventilation par bps (somme 10 000). |
| 5 | [`GhostPresale.sol`](./GhostPresale.sol) | `GhostPresale` | Prévente ETH → GHOST ; flux Schnorr via `GhostProtocolV2`. |
| 6 | [`GhostPresaleBonusRegistry.sol`](./GhostPresaleBonusRegistry.sol) | `GhostPresaleBonusRegistry` | Registre d’éligibilité bonus post-`claim`. |

Bibliothèque / interface (compilées avec le presale, pas déployées comme contrats autonomes à cette étape) :

| Fichier | Rôle |
|---------|------|
| [`GhostVerifier.sol`](./GhostVerifier.sol) | Vérifications Schnorr BN256 ; hérité par `GhostPresale`. |
| [`IGhostProtocolV2ForPresale.sol`](./IGhostProtocolV2ForPresale.sol) | Interface : `pseudo1ToCommit` sur le V2 déployé. |
| `IGhostTokenPresaleCap` (dans [`GhostPresale.sol`](./GhostPresale.sol)) | Lecture de `PRIVATE_SALE_ALLOC()` sur le token au constructeur du presale. |
| [`mocks/MockGhostProtocolV2ForPresale.sol`](./mocks/MockGhostProtocolV2ForPresale.sol) | Utilisé uniquement par `estimate-ghost-deploy-gas.ts` sur réseau Hardhat (pas déployé en production). |

---

## `GhostToken.sol`

| Élément | Fonction |
|---------|----------|
| Constantes `*_ALLOC` | Parts du supply (airdrop, trésorerie, équipe, récompenses, liquidité, prévente). |
| `TOTAL_SUPPLY` | 33 000 000 × 10¹⁸ wei. |
| `constructor` | Mint intégral vers `msg.sender` ; nom/symbole ; Permit + Votes. |
| `_update` | Override ERC20 / ERC20Votes. |
| `nonces` | Override ERC20Permit / Nonces. |

---

## `GhostVesting.sol`

| Élément | Fonction |
|---------|----------|
| `token`, `beneficiary`, `start`, `cliff`, `duration`, `totalAmount` | Paramètres figés au déploiement. |
| `released` | Cumul déjà libéré. |
| `constructor` | Vérifie adresses et durées ; calcule `cliff = start + cliffDuration`. |
| `release` | Transfère au `beneficiary` le montant libérable ; met à jour `released` avant transfert. |
| `releasable` | `vestedAmount(now) - released`. |
| `vestedAmount` | Linéaire après `cliff`, plafonné à `totalAmount`. |
| `status` | Vue agrégée pour interfaces. |

---

## `GhostTimelock.sol`

| Élément | Fonction |
|---------|----------|
| `token`, `beneficiary`, `releaseTime` | Figés au déploiement. |
| `constructor` | Exige `releaseTime` dans le futur. |
| `release` | Uniquement `beneficiary`, après `releaseTime` ; retire tout le solde du contrat. |
| `status` | Solde verrouillé, date, décompte. |

---

## `GhostEthProceedsSplitter.sol`

| Élément | Fonction |
|---------|----------|
| `_recipients`, `_bps` | Destinataires et parts (10 000 = 100 %). |
| `constructor` | Vérifie longueurs, adresses non nulles, somme des bps = 10 000. |
| `recipientCount` / `recipientAt` / `bpsAt` | Lecture publique. |
| `receive` | Répartit `msg.value` selon les bps ; dernier slot reçoit le reliquat d’arrondi. |

---

## `GhostPresale.sol`

| Élément | Fonction |
|---------|----------|
| `ghostToken`, `admin`, `ethProceedsReceiver`, `ghostProtocolV2` | Adresses figées ; `ethProceedsReceiver` reçoit les ETH au `finalize`. |
| `ghostPerEth`, caps, fenêtre | Taux et limites d’achat. |
| `maxGhostAllocatable` | Lu depuis `GhostToken.PRIVATE_SALE_ALLOC()` au déploiement. |
| `totalRaisedEth`, `totalTokensSold` | Compteurs globaux. |
| `finalized`, `refundMode` | Phases post-prévente. |
| `contributions`, `tokenAllocation`, `claimed`, `refunded` | État par acheteur (adresse EVM « classique »). |
| `ghostPresaleNonceByPseudoHash`, `ghostClaimNonceByPseudoHash` | Anti-rejeu pour les flux Ghost. |
| `allocationFromGhostPurchase` | Marque les allocations issues de `buyTokensGhost`. |
| `receive` / `buy` / `buyTokens` | Achats classiques ; créditent `msg.sender`. |
| `_buy` | Vérifie caps, plafond wallet, solde GHOST du contrat, plafond `maxGhostAllocatable`. |
| `buyTokensGhost` | Vérifie commits vs `pseudo1ToCommit`, preuves Schnorr, puis `_buy(recipient, …)`. |
| `finalize` | Admin ; soft cap OK ou fenêtre close + hard cap ; envoie les ETH au receiver. |
| `enableRefundMode` | Si soft cap non atteint après la fin. |
| `claim` | Retrait GHOST après finalisation (acheteur classique). |
| `claimGhost` | Retrait avec preuves ; envoi vers `payout`. |
| `refund` | Remboursement ETH en mode refund. |
| `remboursementVolontaire` | Sortie volontaire pendant la prévente. |
| `recoverUnsoldTokens` | Admin ; GHOST restants vers `admin`. |
| `presaleInfo`, `buyerInfo`, `ethForGhost`, `ghostForEth` | Vues. |

---

## `GhostPresaleBonusRegistry.sol`

| Élément | Fonction |
|---------|----------|
| `IGhostPresaleForBonus` | Lecture `buyerInfo` sur le presale lié. |
| `presale`, `bonusBps`, `credentialDomainSeparator` | Figés au déploiement. |
| `registered`, `ghostPurchased`, `credentialBindingConsumed` | État par acheteur. |
| `recordEligibility` | Enregistre si l’acheteur a contribué, claimé, et n’a pas été remboursé. |
| `bonusGhostAmount` | Bonus en wei selon `bonusBps`. |
| `credentialIdOf` | Empreinte publique pour indexation. |
| `consumeCredentialBinding` | Usage unique du lien credential côté produit. |

---

## `GhostVerifier.sol`

| Élément | Fonction |
|---------|----------|
| `SchnorrProof` | Points et scalaire de preuve. |
| `verifyGhostProof` | Vérifie la preuve Schnorr BN256 pour un commitment et un challenge. |
| `_ecMul`, `_ecAdd` | Précompiles 0x07 / 0x06. |

---

## `IGhostProtocolV2ForPresale.sol`

| Élément | Fonction |
|---------|----------|
| `pseudo1ToCommit` | Commitment composite du compte Ghost pour un `pseudo1` donné. |

Pour le détail d’implémentation ligne par ligne, se référer aux fichiers `.sol` ; ce README décrit les **responsabilités** et l’**ordre de déploiement**, pas une relecture exhaustive du source.
