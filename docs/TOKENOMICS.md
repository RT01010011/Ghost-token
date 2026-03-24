# Tokenomics GHOST (référence on-chain)

Ce document reflète les **constantes et le flux codés** dans ce dépôt (`GhostToken.sol`, `scripts/deploy-ghost-ecosystem.ts`). Les pourcentages sont calculés par rapport au **supply total** de **33 000 000 GHOST** (18 décimales).

## Supply et répartition fixe

| Tranche | GHOST (nominaux) | % du supply | Constante Solidity |
|--------|-------------------|------------|--------------------|
| Airdrop | 6 600 000 | 20,00 % | `AIRDROP_ALLOC` |
| Trésorerie (vesting) | 5 940 000 | 18,00 % | `TREASURY_ALLOC` |
| Équipe (vesting) | 5 610 000 | 17,00 % | `TEAM_ALLOC` |
| Récompenses (timelock) | 6 600 000 | 20,00 % | `REWARDS_ALLOC` |
| Liquidité | 3 300 000 | 10,00 % | `LIQUIDITY_ALLOC` |
| Prévente (private sale) | 4 950 000 | 15,00 % | `PRIVATE_SALE_ALLOC` |
| **Total** | **33 000 000** | **100 %** | `TOTAL_SUPPLY` |

Jeton ERC-20 : nom **Ghost Protocol**, symbole **GHOST**. Le contrat inclut **ERC20Permit** (EIP-2612) et **ERC20Votes** (gouvernance / délégation de votes selon l’usage du standard OpenZeppelin).

## Après déploiement de l’écosystème (`deploy:ecosystem:base`)

Le script distribue l’intégralité du supply depuis le déployeur vers les destinations suivantes (ordre logique du script) :

| Destination | Tranche GHOST | Rôle |
|-------------|---------------|------|
| Wallet airdrop (`GHOST_WALLET_AIRDROP`) | 6 600 000 | Selon stratégie produit / campagnes. |
| `GhostVesting` équipe | 5 610 000 | Vesting bénéficiaire `GHOST_WALLET_TEAM_VESTING`. |
| `GhostVesting` trésorerie | 5 940 000 | Vesting bénéficiaire `GHOST_WALLET_TREASURY_VESTING`. |
| `GhostTimelock` récompenses | 6 600 000 | Déverrouillage au bénéficiaire `GHOST_WALLET_REWARDS_TIMELOCK` après la durée de lock (défaut : 1 an depuis le bloc de déploiement, configurable via `GHOST_REWARDS_LOCK_SECONDS`). |
| Wallet liquidité (`GHOST_WALLET_LIQUIDITY`) | 3 300 000 | Mise en marché / pools. |
| `GhostPresale` | 4 950 000 | Stock vendu contre ETH pendant la fenêtre de prévente ; plafond aligné sur `PRIVATE_SALE_ALLOC`. |

Les adresses exactes sont celles définies dans le **`.env`** pour Base mainnet / Sepolia (aucune valeur implicite de production dans le script).

## Vesting (linéaire, défini au déploiement du script)

Paramètres figés dans `deploy-ghost-ecosystem.ts` au moment du deploy :

| Contrat | Montant | Cliff | Durée totale de vesting |
|---------|---------|-------|-------------------------|
| Équipe | `TEAM_ALLOC` | 6 mois (≈ 180 jours) | 3 ans |
| Trésorerie | `TREASURY_ALLOC` | 0 | 2 ans |

Comportement : avant la fin du **cliff**, aucun jeton n’est libérable via `release()` ; après le cliff, la courbe suit `GhostVesting.vestedAmount` (linéaire jusqu’à `start + duration`). Détail : [`contrat tokken/GhostVesting.sol`](../contrat%20tokken/GhostVesting.sol).

## ETH collectés en prévente

À la **finalisation** de la prévente (`finalize()`), les ETH sont envoyés au **splitter** (`GhostEthProceedsSplitter`), qui les répartit entre cinq wallets selon des **basis points** (somme = 10 000).

Défaut du script si `GHOST_ETH_SPLIT_BPS` est absent : **2352 / 2117 / 2000 / 2352 / 1179** — ordre des destinataires : **Airdrop, Trésorerie, Équipe, Récompenses, Liquidité** (aligné sur les mêmes rôles que la distribution des GHOST).

## Prévente GHOST (paramètres opérationnels)

Fixés par variables d’environnement au déploiement (voir [`.env.example`](../.env.example) et [`STRUCTURE-ET-DEPLOIEMENT.md`](./STRUCTURE-ET-DEPLOIEMENT.md)) : taux `GHOST_PER_ETH_GHOST`, soft / hard cap en ETH, plafond par wallet, fenêtres `GHOST_PRESALE_START_UNIX` / `GHOST_PRESALE_END_UNIX`, adresse `GHOST_PROTOCOL_V2` pour les achats via `buyTokensGhost`. L’API détaillée des fonctions : [`contrat tokken/README.md`](../contrat%20tokken/README.md).

## Rappel avant déploiement mainnet

1. `.env` complet (wallets, timestamps, `GHOST_PROTOCOL_V2`, RPC, clé déployeur avec **ETH sur Base**).  
2. `npm run compile:token` sans erreur.  
3. `npm run deploy:ecosystem:base` au moment voulu.  
4. Conserver `deployed-addresses-ghost-ecosystem.json` en local (non versionné) et mettre à jour les interfaces / explorateur.

## Contact

**Rayane Hila** — **RayTech Solution** — [rayane.h42@proton.me](mailto:rayane.h42@proton.me).

*Les chiffres ci-dessus sont des faits de code ; toute communication publique (site, whitepaper) doit rester alignée avec le bytecode déployé.*
