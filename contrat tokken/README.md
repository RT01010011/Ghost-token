# Contrats jeton GHOST

Fichiers sources du token **GHOST** (Ghost Protocol) et mécanismes associés.

**→ Feuille de route complète de déploiement (tokenomics → transferts → prévente) :** [`FEUILLE-DE-ROUTE-DEPLOIEMENT.md`](./FEUILLE-DE-ROUTE-DEPLOIEMENT.md)  
**→ Paramètres importés depuis un dossier type `GhostProtocolV2` (Téléchargements) :** [`PARAMETRES_IMPORTES_DOWNLOADS.md`](./PARAMETRES_IMPORTES_DOWNLOADS.md)  
**→ Vérification interne (revue code + limites, pas audit cabinet) :** [`AUDIT_VERIFICATION_INTERNE.md`](./AUDIT_VERIFICATION_INTERNE.md)  
**→ Schémas d’architecture, flux et checklist post-déploiement (Mermaid) :** [`ARCHITECTURE-SCHEMAS.md`](./ARCHITECTURE-SCHEMAS.md)  
**→ Bilan des tests automatisés (jeton / prévente / SDK) pour GitHub :** [`../docs/TESTS-GHOST-TOKEN-PREVENTE.md`](../docs/TESTS-GHOST-TOKEN-PREVENTE.md)

| Fichier | Rôle |
|---------|------|
| `GhostToken.sol` | ERC20 fixe **33 000 000 GHOST**, Permit, Votes — **source de vérité** pour les % et montants d’allocation. |
| `GhostVesting.sol` | Vesting linéaire (équipe : cliff + durée ; trésorerie : linéaire selon déploiement). |
| `GhostTimelock.sol` | Verrouillage jusqu’à une date (ex. tranche type `REWARDS_ALLOC`). |
| `GhostPresale.sol` | Prévente ETH → GHOST (paramètres au déploiement). |
| `GhostEthProceedsSplitter.sol` | Répartition des ETH au `finalize()` vers 5 wallets (bps). |
| `GhostPresaleBonusRegistry.sol` | Éligibilité bonus % sur GHOST prévente + `credentialId` (couche externe). |
| `GhostPresaleWelcomeRegistry.sol` | Airdrop **100 GHOST** (admin `recordWelcomeAccount`, utilisateur `claim` après `claimOpensAt`). Déploiement **isolé** : `npm run deploy:welcome-registry:base` + `scripts/deploy-ghost-welcome-registry-only.ts` (ne redéploie pas token/prévente). |

### `GhostPresale` — lien `recipient` ↔ pseudo1 (achat Ghost)

Lors d’un **`buyTokensGhost`**, le contrat fixe **`ghostPurchasePseudo1Hash[recipient]`** à **`keccak256(bytes(pseudo1))`** (premier achat pour cette adresse). Les achats suivants pour le même **`recipient`** exigent le **même** `pseudo1`. **`remboursementVolontaire`** remet ce hash à zéro avec l’allocation. Achat **`buy` / `receive`** seul : le mapping reste à zéro pour cette adresse.

### `GhostPresaleBonusRegistry` — pseudo1 et liste bonus

Après **`claim`** sur le presale : **`recordEligibility(buyer)`** (adresse seule) ou **`recordEligibilityWithPseudo(buyer, pseudo1)`** — pour un achat Ghost, `pseudo1` doit coïncider avec **`ghostPurchasePseudo1Hash(buyer)`** sur le presale ; pour un achat wallet, passer **`""`**. Liste énumérable : **`pseudo1BonusListLength`** / **`pseudo1BonusListAt`**. Flux, événements et intégration : **[`BONUS-PREVENTE-REGISTRY.md`](./BONUS-PREVENTE-REGISTRY.md)**.

## Déploiement (Hardhat)

Ces fichiers sont compilés avec une **config séparée** du protocole escrow (dossier `contracts/`).

1. Copier `.env.example` vers `.env` et renseigner les variables listées dans `.env.example` (clés et RPC — ne pas les committer).
2. Compiler le jeton :
   ```bash
   npm run compile:token
   ```
3. Déployer **GhostToken** (tout le supply part sur l’adresse déployeur) :
   ```bash
   npm run deploy:token:baseSepolia
   ```
   ou en production Base :
   ```bash
   npm run deploy:token:base
   ```
4. Le script écrit `deployed-addresses-ghost-token.json` à la racine du dépôt (fichier gitignored).

Ensuite, selon la feuille de route : transferts vers multisig, déploiement de `GhostPresale` / `GhostVesting` / `GhostTimelock`, alimentation en GHOST, etc.

## Cohérence avec le site vitrine

Le tableau **tokenomics** du white paper (`website/js/config.js` → `tokenomics.allocations`) doit **reproduire** les constantes de `GhostToken.sol` (`AIRDROP_ALLOC`, `TREASURY_ALLOC`, etc.).  
Si vous modifiez le contrat, **mettez à jour** `config.js` ensuite.

Le site **protocole** ne détaille pas les produits communautaires ou « reward » à part : seule la part on-chain et les contrats y sont décrits de façon neutre.
