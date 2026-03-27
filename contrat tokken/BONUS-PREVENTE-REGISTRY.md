# Bonus +5 % prévente — `GhostPresaleBonusRegistry`

Distinction avec la campagne **100 GHOST / compte** et tokenomics airdrop : **[docs/PREVENTE-AIRDROP-COMMUNAUTE.md](../docs/PREVENTE-AIRDROP-COMMUNAUTE.md)**.

## Rôle

Contrat **séparé** de `GhostPresale` : enregistre qu’une **adresse EVM** a bien **claim** des GHOST en prévente, fixe un **credential** public unique (`credentialId`) et expose le **montant de bonus** en wei : `ghostPurchased × bonusBps / 10_000` (défaut **500** = 5 %).

- **Pseudo1 (achat `buyTokensGhost`)** : `GhostPresale` enregistre `ghostPurchasePseudo1Hash[recipient] = keccak256(bytes(pseudo1))` à l’achat. Le registre expose **`recordEligibilityWithPseudo(buyer, pseudo1)`** : vérifie ce hash pour les acheteurs Ghost, et maintient une liste énumérable **`pseudo1BonusListAt(i)`** / **`pseudo1BonusListLength()`** (un pseudo distinct par hash) pour ton recensement +5 %.
- **Achat wallet classique** (`buy` / `receive`) : utiliser **`recordEligibility(buyer)`** ou **`recordEligibilityWithPseudo(buyer, "")`** avec chaîne vide (tout autre `pseudo1` est rejeté).
- **Secret** : on-chain il n’y a pas de secret partagé uniquement avec l’utilisateur. Le `credentialId` est une **empreinte publique** (commitment) pour indexer et lier au backend. La **distribution** des GHOST bonus (trophées, grades) reste dans tes wallets / contrats futurs, en t’appuyant sur `bonusGhostAmount` + événements.

## Flux

1. L’utilisateur achète et **`claim()`** (ou **`claimGhost`**) sur `GhostPresale`.
2. Quelqu’un appelle **`recordEligibility(buyer)`** ou **`recordEligibilityWithPseudo(buyer, pseudo1)`** (l’utilisateur, un bot ou ton indexeur). Vérif : `buyerInfo` → `hasClaimed`, pas `hasRefunded`, `ghostAllocated > 0` ; si achat Ghost, `pseudo1` doit matcher `ghostPurchasePseudo1Hash(buyer)` sur le presale.
3. Émission **`EligibilityRecorded(buyer, ghostPurchasedWei, credentialId)`** ; si nouveau pseudo listé, **`PresaleBonusPseudo1Listed(pseudo1Hash, pseudo1)`** → index subgraph / DB.
4. Sur le site : lecture **`credentialIdOf(buyer)`**, **`bonusGhostAmount(buyer)`**, cumul avec tes règles « grades ».
5. **Lien compte site une fois** : l’utilisateur appelle **`consumeCredentialBinding()`** depuis le même wallet → **`CredentialBindingConsumed`** ; `credentialBindingConsumed[buyer] = true` empêche un second lien on-chain (tu peux compléter avec ta logique DB).

## SDK

`computePresaleBonusCredentialId` + `DEFAULT_BONUS_CREDENTIAL_DOMAIN` dans `@ghost-protocol/sdk` — mêmes entrées que le contrat (`buyer`, `ghostPurchasedWei`, `presale`, `chainId`, `credentialDomainSeparator`).

## Déploiement

Inclus dans `scripts/deploy-ghost-ecosystem.ts` (étape 7/7). Variables : `GHOST_PRESALE_BONUS_BPS`, `GHOST_BONUS_CREDENTIAL_DOMAIN`.

## Limite

Ce contrat **ne transfère pas** de GHOST : il **atteste** l’éligibilité et **calcule** le montant théorique du bonus. Prévois le budget GHOST (airdrop / récompenses) côté trésorerie pour honorer les bonus réels sur ton site.

## Vérification déploiement (bonus = prévente officielle uniquement)

À contrôler après déploiement (BaseScan ou script) :

| Vérification | Attendu |
|----------------|---------|
| `GhostPresale.ghostToken()` | = adresse du **GhostToken** déployé (même déploiement). |
| `GhostPresale.maxGhostAllocatable()` | = `GhostToken.PRIVATE_SALE_ALLOC()` → **4 950 000 GHOST** (15 % du supply). |
| `GhostPresaleBonusRegistry.presale()` | = adresse du **GhostPresale** déployé à l’étape 6 — **pas** un autre contrat. |
| `GhostPresaleBonusRegistry.bonusBps()` | ex. **500** (= 5 %). |

Le script `deploy-ghost-ecosystem.ts` déploie le registre en **7/7** avec `GhostPresaleBonusRegistry.deploy(presaleAddr, BONUS_BPS, BONUS_CRED_DOMAIN)` et vérifie déjà `maxGhostAllocatable === PRIVATE_SALE_ALLOC`. Tant que `presale()` pointe vers ce presale, **seuls** les acheteurs ayant **claim** sur **ce** presale peuvent passer `recordEligibility`.

## Marqueur, jetons GHOST et changement d’adresse

- **Pas de « label +5 % » dans le contrat du jeton** : le `GhostToken` est un ERC20 classique ; chaque unité de GHOST est **fongible**. On ne distingue pas on-chain « ce GHOST vient de la prévente » une fois les tokens sur un wallet.
- **Le « marqueur » = `credentialId`** (bytes32) : empreinte publique dérivée de `(adresse acheteuse, montant GHOST prévente, adresse presale, chainId, domaine)`. Elle sert au site **Ghost communauté** et aux API pour savoir **quel montant de bonus théorique** est lié à **cette** participation prévente.
- **Une activation on-chain par wallet** : `consumeCredentialBinding()` depuis l’adresse enregistrée marque `credentialBindingConsumed[buyer] = true` — tu relies **un** compte site à **ce** wallet (logique métier côté serveur).
- **Si l’utilisateur change de wallet** après coup : l’entrée `registered[buyer]` et le `credentialId` restent sur l’**ancienne** adresse presale ; les GHOST transférés ailleurs **ne portent pas** automatiquement le bonus sur la nouvelle adresse. Pour suivre la personne malgré le changement d’adresse, il faut une **règle produit** (support, lien manuel vérifié, ou futur mécanisme on-chain) — ce n’est pas imposé par le registre actuel.
