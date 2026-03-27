# Test E2E prévente (Base Sepolia) — avant déploiement mainnet

Objectif : valider sur un **réseau public de test** que l’**UX** peut **acheter**, que l’**admin** peut **finaliser**, et que l’**utilisateur** **reçoit les GHOST** (`claim` / `claimGhost`) sans surprise — même logique Schnorr / SDK que les tests Hardhat (`ghost-schnorr-libz.js`, `PresaleSdkCoherence.test.ts`).

## 0. Peu d’ETH : parcours du plus économique au plus coûteux

Tu n’as **pas besoin** de dépenser de l’ETH tout de suite pour la **plus grande partie** des vérifications « contrat ↔ même logique que l’UX / le SDK ».

### A) **0 ETH** — barème automatique (recommandé en premier)

Une seule commande :

```bash
npm run verify:presale:sans-eth
```

Elle enchaîne :

1. **`compile:token`** — bytecode `GhostPresale` / `GhostToken` / mock aligné sur ce que tu déploieras.
2. **`test:token:sdk-coherence`** (`PresaleSdkCoherence.test.ts`) — sur réseau Hardhat intégré :
   - achat **wallet** (`buy` / `receive`) ;
   - achat **`buyTokensGhost`** avec **`ghost-schnorr-libz.js`** (même lib que l’UI pour les preuves) ;
   - **`claim`** et **`claimGhost`** ;
   - **bonus prévente** : `computePresaleBonusCredentialId` du paquet **`@ghost-protocol/sdk`** = même formule que `GhostPresaleBonusRegistry` on-chain.

Donc : **compatibilité des signatures**, des **challenges Schnorr**, du **`pseudo1ToCommit` + commits en calldata**, et du **SDK npm** côté bonus — **sans** Sepolia ni mainnet.

### B) **0 ETH on-chain** — ton **vrai compte Ghost** (Base) + prévente en local

Le **fork** copie l’état **Base** : ton pseudo existe déjà sur le **V2** réel.

```bash
npm run node:token:fork
```

Puis dans un **second** terminal :

```bash
npm run deploy:presale:fork
```

Ensuite `index.html` avec RPC `http://127.0.0.1:8545`, `ghost_allow_localhost`, contrat Ghost = adresse Base habituelle, prévente = adresse du JSON. Tu paies **0** ETH réel ; seul un RPC public (fork) consomme de la bande passante.

### C) **Protocole Ghost** (escrow, pas le dossier `contrat tokken` seul)

```bash
npm run test:protocol:sdk-coherence
```

Vérifie la cohérence **SDK / client ↔ contrat GhostProtocolV2** (calldata, décodage, etc.).

### D) **Un peu d’ETH test** — seulement si tu veux **Base Sepolia** « comme sur Internet »

C’est la suite de ce fichier (§1 et suivants). Une passe suffit souvent pour valider MetaMask + explorer.

### E) **Avant de griller du gas mainnet**

```bash
npm run estimate:deploy:gas
```

Donne un ordre de grandeur de coût de déploiement (à recouper avec le prix du gas du jour).

---

## Prérequis

1. **ETH Base Sepolia** sur le wallet de déploiement (faucet officiel Base / bridges testnet).
2. Fichier **`.env`** à la racine du dépôt :
   - `PRIVATE_KEY` (déployeur / gas)
   - `BASE_SEPOLIA_RPC_URL` (optionnel : défaut `https://sepolia.base.org`)

## 1. Déployer la prévente de test

```bash
npm run compile:token
npm run deploy:presale:e2e:sepolia
```

Le script écrit **`deployed-addresses-presale-e2e-testnet.json`** (gitignored) avec :

- `GhostToken`, `GhostPresale`
- soit **Mock** `MockGhostProtocolV2ForPresale`, soit **`GHOST_PROTOCOL_V2`** si tu l’as défini (compte Ghost déjà sur Sepolia)

Paramètres utiles :

| Variable | Rôle |
|----------|------|
| `E2E_PRESALE_START_OFFSET_SEC` | Délai avant ouverture (défaut **180** s) |
| `E2E_PRESALE_DURATION_SEC` | Durée de la prévente (défaut **7 j**) |
| `GHOST_PROTOCOL_V2` | Adresse V2 sur Sepolia — sinon mock auto |
| `GHOST_PRESALE_ADMIN` | Compte qui pourra `finalize()` (défaut déployeur) |
| `GHOST_E2E_ETH_RECEIVER` | Destinataire des ETH au `finalize()` (défaut déployeur) |

Vérifie les contrats sur [Base Sepolia explorer](https://sepolia.basescan.org).

## 2. Configurer l’UX (`index.html`)

1. **RPC** : `https://sepolia.base.org` (ou ta valeur `BASE_SEPOLIA_RPC_URL`).
2. **MetaMask** : réseau **Base Sepolia**, chain ID **84532**.
3. **Prévente** : colle l’adresse **`GhostPresale`** du JSON.
4. **Connexion Ghost** (pour **`buyTokensGhost` / compte connecté**) :
   - L’application charge l’**ABI complet** du protocole (événements, `getNonce`, etc.). Le **seul mock** déployé avec la prévente **ne suffit pas** comme contrat de « Connexion ».
   - **Comme en prod** : déploie **GhostProtocolV2** sur Base Sepolia (projet racine, `hardhat.config.ts`) :
     ```bash
     npx hardhat run scripts/deploy.ts --network baseSepolia
     ```
     Puis relance le déploiement prévente avec **`GHOST_PROTOCOL_V2=<adresse V2 du JSON>`**. Crée ton compte (`createAccount`) via l’UX sur ce V2 Sepolia, puis teste **Prévente → Compte connecté**.
   - **Sans V2 Sepolia** : tu peux quand même valider **achat classique** + **claim** (scénario A ci‑dessous) ; pour le Schnorr pur, utilise le **fork Base** (`npm run node:token:fork` + `npm run deploy:presale:fork`).

> Pas besoin de `ghost_allow_localhost` sur Sepolia (réservé au RPC `127.0.0.1`).

## 3. Scénario A — Achat **wallet classique** (le plus simple)

1. Attends l’**heure d’ouverture** (`presaleStartIso` dans le JSON).
2. **Envoyer → Prévente → Wallet externe** : clé avec du Sepolia ETH, montant petit (ex. `0.001` ETH).
3. Vérifie sur l’explorateur : événement `Purchase`, `contributions[tonAdresse]` cohérent (optionnel : lecture `buyerInfo` via cast / Hardhat console).
4. Après **`presaleEndIso`** (ou selon les règles du contrat si hard cap rempli plus tôt), le compte **admin** appelle **`finalize()`** (MetaMask sur l’admin, ou script Hardhat).
5. Même wallet qu’à l’achat : **`claim()`** dans l’UX → les **GHOST** doivent arriver sur ce wallet.

## 4. Scénario B — **`buyTokensGhost`** (comme en prod)

1. **GhostProtocolV2** déployé sur Base Sepolia + **même adresse** dans `GHOST_PROTOCOL_V2` au déploiement de la prévente (voir §2).
2. Crée le compte sur ce V2 avec l’UX (ou équivalent), puis **Connexion** avec le même RPC Sepolia.
3. **Prévente → Compte connecté** : `buyTokensGhost` ; **recipient** = adresse qui porte l’allocation.
4. **`finalize()`** puis **`claim()`** ou **`claimGhost`** selon le flux.

**Script `register:mock-presale:sepolia`** : utile surtout pour du **debug bas niveau** (enregistrer le mock utilisé *comme* `ghostProtocol` du `GhostPresale` sans repasser par le V2). Il **ne suffit pas** pour une session UX complète « Connexion ».

## 5. Checklist avant déploiement **Base mainnet**

- [ ] Scénario A (buy + finalize + claim) OK sur Sepolia.
- [ ] Si tu vends en Ghost : scénario B OK (ou test sur **fork Base** : `npm run node:token:fork` + `npm run deploy:presale:fork` avec V2 réel).
- [ ] Paramètres relevés : `ghostPerEth`, `maxPerWallet`, `hardCap`, fenêtres `start` / `end`, adresse **V2** prod.
- [ ] **Admin** et **récepteur ETH** `finalize()` sont bien des wallets prévus prod (pas le déployeur éphémère).
- [ ] Site / `website/js/config.js` alignés sur les adresses et textes définitifs.

## Rappel SDK

- Les preuves **`buyTokensGhost` / `claimGhost`** dans l’UX viennent de **`ghost-schnorr-libz.js`** — même famille que **`npm run test:token:sdk-coherence`**.
- Le package **`@ghost-protocol/sdk`** couvre surtout **protocole + bonus registre**, pas le remplacement de cette lib pour la prévente Schnorr.
