# Feuille de route déploiement — GHOST sur Base

Document de référence pour l’équipe : **ce qui est déjà sur la chaîne** (snapshot mars 2026) et **ce qu’il reste à faire** pour tenir l’engagement **100 GHOST** aux comptes Ghost Protocol créés **pendant la prévente**.

Références produit détaillées : [`docs/PREVENTE-AIRDROP-COMMUNAUTE.md`](../docs/PREVENTE-AIRDROP-COMMUNAUTE.md).  
Contrat on-chain : `GhostPresaleWelcomeRegistry.sol`.  
Script **sans redéploiement** du reste de l’écosystème : `scripts/deploy-ghost-welcome-registry-only.ts` → `npm run deploy:welcome-registry:base`.

---

## 1. Jeton GHOST sur Base (déjà déployé)

| Lien | URL |
|------|-----|
| **Token sur Basescan** | [GHOST — Base mainnet](https://basescan.org/token/0x06e30818b8cCAd79d85e24876cdA525b4F41abbe) |
| Contrat (checksum) | `0x06e30818b8cCAd79d85e24876cdA525b4F41abbe` |

---

## 2. Snapshot écosystème déjà en place sur la blockchain (chainId 8453)

Ces adresses proviennent de `deployed-addresses-ghost-ecosystem.json` (fichier local gitignored ; recopier depuis ton déploiement si besoin).

| Rôle | Adresse |
|------|---------|
| **GhostToken** | `0x06e30818b8cCAd79d85e24876cdA525b4F41abbe` |
| **GhostPresale** | `0x9E5B75E5bf82aD2ed250E473A394B557688C6522` |
| **GhostProtocolV2** | `0x4ae6Aa27aB7c822970D2cb7575bF8e6F5cea00aB` |
| **GhostPresaleBonusRegistry** (+5 % attestation) | `0x480bf860fA8f0C95B471b0d91744C99394a98760` |
| **GhostPresaleWelcomeRegistry** (100 GHOST) | `0x6c23de97212A75ED5264800b5926763767B942Fd` — voir aussi `deployed-addresses-ghost-welcome-registry.json` |
| **GhostEthProceedsSplitter** | `0x6360829a998e54FA054db263a6AC75c12ebc1CD8` |
| **GhostVestingTeam** | `0xf6EA7ac51AbF563883Ba64B1E998b5e53d8CE861` |
| **GhostVestingTreasury** | `0x11311f1Bc273387476eD5FE67823F64b4a6790aE` |
| **GhostTimelockRewards** | `0xDA34b145684fdF5d1FE57FE7250bd21310180D4B` |

**Fenêtre prévente (on-chain)** — utilisée par le welcome registry pour tester si un compte a été créé « pendant la prévente » :

- `startTime` ≈ **1774660860** (ex. sam. 28 mars 2026 02:21 Europe/Paris, selon `.env` au déploiement)
- `endTime` ≈ **1775265660** (+ 7 jours)

**Wallet airdrop (tokenomics)** — source des GHOST pour la campagne 100 GHOST une fois le registre approvisionné :

- `0x9D5DB811b409E6EcCE8B097093e719bfc5430f9a`

**Admin prévente / opérations** (souvent même entité que multisig) :

- `0xed7c344bAF2950Ba217CAb2279c400a830e6dD50`

---

## 3. Phases déjà réalisées (checklist)

- [x] Déploiement **GhostToken** + distribution tokenomics (dont **6,6 M GHOST** vers wallet airdrop, **4,95 M** vers prévente, vestings, etc.)
- [x] Déploiement **GhostPresale** lié au **GhostProtocolV2** et au **splitter ETH**
- [x] Déploiement **GhostPresaleBonusRegistry** (500 bps — attestation post-claim, pas envoi auto de jetons)
- [x] Déploiement **GhostPresaleWelcomeRegistry** (100 GHOST) — `0x6c23de97212A75ED5264800b5926763767B942Fd` ; `claimOpensAt` = fin prévente (`2026-04-04T01:21:00.000Z` UTC)
- [x] Paramétrage UX : adresse prévente par défaut dans `index.html`

---

## 4. Suite obligatoire — **garantir 100 GHOST** (comptes créés pendant la prévente)

L’engagement produit (« 100 GHOST à toute personne qui crée un compte Ghost Protocol **pendant la prévente** ») est **garanti on-chain** via **`GhostPresaleWelcomeRegistry`** : le contrat impose que le compte existe sur **V2** et que **`createdAt`** (via `getAccountInfo`) tombe dans **`[presale.startTime, presale.endTime]`** lors de `recordWelcomeAccount` (sauf cas `createdAt == 0` documenté dans `PREVENTE-AIRDROP-COMMUNAUTE.md`).

### 4.1 Déployer le registre welcome (une seule fois)

**Fait sur Base** : `npm run deploy:welcome-registry:base` — adresse dans `deployed-addresses-ghost-welcome-registry.json`. **Ne pas relancer** ce script (anti-doublon).

1. Copier / vérifier `deployed-addresses-ghost-ecosystem.json` à la racine du dépôt.
2. `.env` :
   - **`GHOST_WELCOME_CLAIM_OPENS_UNIX`** : optionnel. Si absent, le script prend **`presale.endUnix`** du fichier `deployed-addresses-ghost-ecosystem.json` (fin des **7 jours** après le **28/03/2026**, soit la clôture prévente déjà déployée), plus **`GHOST_WELCOME_CLAIM_OPENS_AFTER_END_SEC`** (défaut **0**). Sinon lecture **`endTime()`** on-chain sur `GhostPresale`.
   - Optionnel : `GHOST_WELCOME_MAX_RECIPIENTS` (défaut **3300**), `GHOST_WELCOME_AMOUNT_GHOST` (défaut **100**), `GHOST_WELCOME_ADMIN` (sinon aligné sur `GHOST_PRESALE_ADMIN` / JSON).
3. Exécuter :  
   `npm run deploy:welcome-registry:base`
4. **Ne pas relancer** si `deployed-addresses-ghost-welcome-registry.json` existe déjà (anti-doublon — voir en-tête du script).

### 4.2 Approvisionner le contrat en GHOST

- Depuis le **wallet airdrop** (`0x9D5D…`), transférer des **GHOST** vers l’adresse **`GhostPresaleWelcomeRegistry`** déployée.
- Budget indicatif : jusqu’à **`100 × maxRecipients`** GHOST (ex. **330 000 GHOST** si 3 300 places), en cohérence avec l’enveloppe **5 %** de la tranche airdrop décrite dans la doc produit.

### 4.3 Recenser les comptes éligibles (off-chain → on-chain)

1. **Indexer** les transactions **`createAccount`** sur **GhostProtocolV2** (`0x4ae6Aa27…`).
2. Filtrer les comptes dont la création est **dans la fenêtre prévente** (alignée sur `startTime` / `endTime` du **GhostPresale** déployé).
3. Pour chaque bénéficiaire, obtenir une **adresse `payout`** (wallet qui recevra les 100 GHOST) — selon ton parcours produit (lien utilisateur, formulaire, etc.).
4. L’**admin** du registre appelle **`recordWelcomeAccount(pseudo1, payout)`** pour chaque entrée (le contrat refait les vérifications V2 + fenêtre).

### 4.4 Ouverture des réclamations utilisateurs

- Après **`claimOpensAt`** : chaque **`payout`** appelle **`claim(pseudo1)`** sur le registre welcome.
- Prévoir **gas ETH** sur le wallet `payout` pour la transaction.
- **À faire côté produit** : bouton ou écran dans l’UX (`index.html` ou app dédiée) pointant vers le contrat welcome + explications (pseudo1, même wallet que `payout`).

### 4.5 Cohérence juridique / produit

- Les **critères exacts** d’éligibilité (KYC, pays, anti-bot, une entrée par personne, etc.) complètent la logique smart contract — à documenter côté CGU / support.

---

## 5. Après la prévente (rappel — hors welcome 100 GHOST)

- **Admin** : **`finalize()`** sur `GhostPresale` quand les conditions du contrat sont remplies.
- **Acheteurs** : **`claim()`** / **`claimGhost`** pour les GHOST **prévente** (distincts des 100 GHOST welcome).
- **Bonus +5 %** : appeler **`recordEligibility`** / **`recordEligibilityWithPseudo`** sur le bonus registry **après** claim prévente (process séparé — le registre n’envoie pas les GHOST tout seul).

---

## 6. Fichiers utiles

| Fichier | Usage |
|---------|--------|
| `GhostPresaleWelcomeRegistry.sol` | Logique `recordWelcomeAccount` / `claim` |
| `scripts/deploy-ghost-welcome-registry-only.ts` | Déploiement isolé du welcome registry |
| `sdk/src/welcomeAirdropSdk.ts` | Lecture registre, `createdAt` V2, hash pseudo1 |
| `docs/PREVENTE-AIRDROP-COMMUNAUTE.md` | Distinction 100 GHOST vs +5 % acheteurs |
| `contrat tokken/BONUS-PREVENTE-REGISTRY.md` | Bonus prévente uniquement |

---

*Dernière mise à jour : feuille de route étendue avec snapshot Base et parcours 100 GHOST pendant prévente.*
