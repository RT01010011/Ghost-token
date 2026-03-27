# Prévente GHOST, registre bonus et campagne airdrop bienvenue

Documentation produit et tokenomics pour l’équipe et les intégrations. Les détails d’implémentation on-chain et SDK sont référencés ici ; le code source reste sans commentaires longs.

---

## 1. Deux mécanismes à ne pas confondre

| | **A — Registre bonus prévente** (`GhostPresaleBonusRegistry`) | **B — Campagne 100 GHOST / compte** |
|---|----------------------------------|----------------------------------|
| **Public** | Acheteurs ayant participé à la prévente (ETH → allocation GHOST), **après claim**. | Comptes Ghost (identité V2) **créés pendant** la fenêtre de prévente. |
| **« 5 % »** | **500 bps** sur les GHOST **achetés** en prévente (`ghostPurchased × bonusBps / 10_000`). Sert de base pour récompenses / rendement sur le site **Ghost communauté** et les événements. | **5 %** de la tranche **airdrop** du jeton (`AIRDROP_ALLOC` = **6 600 000 GHOST**) = **330 000 GHOST** plafond pour la campagne — **indépendant** des 500 bps du registre. |
| **Budget GHOST** | Le registre **ne transfère pas** de tokens ; provision côté trésorerie selon `bonusGhostAmount` et règles métier. | **100 GHOST × N** comptes éligibles, **N ≤ 3 300**. **Hors** les **4 950 000 GHOST** de prévente (`PRIVATE_SALE_ALLOC`). |
| **Recensement** | Adresses + optionnellement **pseudo1** (`pseudo1BonusListAt`, événements) pour lister les **acheteurs** prévente. | Comptes créés en prévente : **Ghost Protocol V2** + indexation (subgraph, backend), pas le registre bonus. |
| **Reliquat** | — | Part non distribuée des **330 000 GHOST** alloués à cette campagne **reste** sur le **wallet airdrop**. |

**Synthèse** : le **+5 % rendement acheteur** (registre + futur site communauté) n’est pas le même levier que les **100 GHOST bienvenue** (enveloppe **5 % de la tranche airdrop 20 %**).

---

## 2. Contrats et scripts

- **`GhostPresale.sol`** : achats ETH, allocations, claim ; **4 950 000 GHOST** max via `PRIVATE_SALE_ALLOC`.
- **`GhostPresaleBonusRegistry.sol`** : attestation post-claim, `credentialId`, liste pseudo1 pour acheteurs Ghost. Voir aussi `contrat tokken/BONUS-PREVENTE-REGISTRY.md` (détail fonctionnel du registre uniquement).
- **`GhostToken.sol`** : `AIRDROP_ALLOC`, `PRIVATE_SALE_ALLOC`, etc.
- **`scripts/deploy-ghost-ecosystem.ts`** : déploiement token, prévente, registre bonus, distribution vers wallets tokenomics. **Horodatage prévente** : variables `GHOST_PRESALE_START_UNIX` / `GHOST_PRESALE_END_UNIX` dans **`.env.example`** (ex. vendredi 27 mars 2026 02:10 Europe/Paris + 7 jours — à valider avant mainnet).
- **`GhostPresaleWelcomeRegistry.sol`** : premier airdrop « 100 GHOST » — enregistrement admin (`recordWelcomeAccount`) puis `claim` par le wallet de réception après `claimOpensAt`. Pas de logique dans le **vesting** (bénéficiaire unique, autre usage).
- **`IGhostProtocolV2ForWelcome.sol`** : `pseudo1ToCommit` + **`getAccountInfo(pseudo1)`** → `(name, createdAt, active)` — aligné sur le **GhostProtocolV2 déployé Base** ([`0x4ae6Aa27…aB` sur Basescan](https://basescan.org/address/0x4ae6Aa27aB7c822970D2cb7575bF8e6F5cea00aB)). La fenêtre prévente du registre welcome utilise **`createdAt`**. Si `createdAt == 0` (cas limite), la fenêtre n’est pas appliquée on-chain.

---

## 3. SDK (`sdk/src`)

Constantes alignées sur `GhostToken.sol` (à mettre à jour si le contrat change) :

| Symbole | Rôle |
|---------|------|
| `AIRDROP_ALLOC_WEI` | Tranche airdrop 20 % (6,6 M GHOST en wei). |
| `ONE_HUNDRED_GHOST_WEI` | Montant type par bénéficiaire campagne bienvenue. |
| `WELCOME_CAMPAIGN_MAX_BUDGET_WEI` | 5 % de `AIRDROP_ALLOC_WEI` → **330 000 GHOST** en wei. |
| `WELCOME_CAMPAIGN_MAX_ACCOUNTS_100` | **3 300** (330 000 / 100). |

Module **`welcomeAirdrop.ts`** : calcul de budget à partir d’un pourcentage du **solde** du wallet airdrop (`budgetFromWalletPercent`, `planWelcomeCampaign`, `defaultWelcomeCampaignPlan`), et `fivePercentOfAirdropAllocationWei()` qui renvoie `WELCOME_CAMPAIGN_MAX_BUDGET_WEI`.

Module **`presaleBonus.ts`** : `computePresaleBonusCredentialId` aligné sur `GhostPresaleBonusRegistry._credentialId`.

**`welcomeRegistryAbi.ts`** : ABI minimal `GHOST_PRESALE_WELCOME_REGISTRY_ABI` pour `recordWelcomeAccount`, `claim`, lectures.

**`welcomeAirdropSdk.ts`** (lecture / indexation alignée sur le contrat) :

| Export | Rôle |
|--------|------|
| `welcomeRegistryPseudo1Hash(pseudo1)` | Même clé que `keccak256(bytes(pseudo1))` on-chain pour `entries`. |
| `extractPseudo1FromCreateAccountCalldata(data)` | Ne retient que le **pseudo1** depuis le calldata `createAccount` (ne pas persister les commits côté produit si tu veux limiter la surface). |
| `v2AccountExistsForPseudo1` / `readV2Pseudo1Commit` | Vérifie l’existence du compte sur V2 **uniquement via pseudo1** (pas de clés). |
| `readV2AccountCreatedAt` | Lit `createdAt` via **`getAccountInfo`** (comme sur Base mainnet). |
| `GhostPresaleWelcomeRegistryReader` | Lit `entries`, `recordedCount`, `welcomeAmountWei`, `claimOpensAt`, adresses presale / V2. |

**`ghostProtocolV2Abi.ts`** inclut `getAccountInfo`, `accountExistsFor` (comme le contrat vérifié Base). **Événement `AccountCreated(string indexed pseudo1, …)`** : en RPC, le `pseudo1` indexé n’est pas relu en clair dans les topics ; pour l’indexation fiable du **pseudo1**, utiliser le **calldata** de la tx `createAccount` (`extractPseudo1FromCreateAccountCalldata` / `decodeCreateAccountFromReceipt`).

### Visibilité on-chain (Ghost Protocol vs registre welcome)

- Sur **Ghost Protocol V2**, l’état consultable pour l’airdrop est surtout **`pseudo1` → commit** (`pseudo1ToCommit`) et **`getAccountInfo(pseudo1)`** → `(name, createdAt, active)` (contrat Base vérifié). Les secrets (pseudo2, key1, key2, signatures, scalaires) ne sont **pas** exposés comme tels dans l’état du protocole ; en revanche la **transaction** `createAccount` porte les **commits** en calldata (hashés, pas les secrets en clair).
- Le contrat **`GhostPresaleWelcomeRegistry`** n’exige **aucune** signature ni scalaire : seulement **`pseudo1`** + lecture V2 + fenêtre prévente via **`createdAt`** retourné par **`getAccountInfo`**. L’adresse **`payout`** est enregistrée sur **ce** contrat (visible sur l’explorateur pour le registre d’airdrop), ce qui est nécessaire pour envoyer les 100 GHOST ; ce n’est pas une donnée du cœur Ghost Protocol.

---

## 4. Interface utilisateur

L’onglet **Connexion** de l’application (`index.html`) reprend une synthèse utilisateur des dispositifs A et B ; le texte contractuel et opérationnel fait foi via la présente documentation et les contrats déployés.

---

## 5. Premier airdrop — flux opérationnel

1. **Indexation** : à partir des transactions `createAccount` sur Ghost Protocol V2 (SDK : `decodeCreateAccountFromTx` / `decodeCreateAccountFromReceipt`), filtrer les créations dont le timestamp est dans `[GhostPresale.startTime, GhostPresale.endTime]`.
2. **Enregistrement** : l’**admin** du registre appelle `recordWelcomeAccount(pseudo1, payout)` (wallet qui recevra les 100 GHOST). Plafond `maxRecipients` (ex. 3 300). Le contrat vérifie que le compte existe sur V2 et, si **`createdAt` > 0** (via **`getAccountInfo`**), que la date est dans la fenêtre prévente.
3. **Trésorerie** : approvisionner le contrat en GHOST depuis le **wallet airdrop** (enveloppe type 330 000 GHOST), hors distribution vesting.
4. **Lancement** : après `claimOpensAt` (TGE / date fixée au déploiement), chaque `payout` appelle `claim(pseudo1)` pour recevoir `welcomeAmountWei` (ex. 100 GHOST).

Tests Hardhat : `tests/GhostPresaleWelcomeRegistry.test.ts`.
