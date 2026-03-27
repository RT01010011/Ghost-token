# Notes archivées — avant publication GitHub / Archived notes — pre-GitHub release

Ce fichier conserve des formulations retirées du code source pour garder le dépôt propre. **FR** puis **EN**.

---

## FR — Vérification synchronisation (contrats ↔ SDK)

- **GhostProtocolV2 (Base)** : `getAccountInfo(pseudo1) → (name, createdAt, bool active)` — aligné avec `sdk/src/ghostProtocolV2Abi.ts`, `protocolClient.ts`, `welcomeAirdropSdk.ts`, `ghost-sdk-unified.js`, `index.html` (`CONTRACT_ABI`).
- **Prévente** : `GhostPresale` + flux `buyTokensGhost` / `claimGhost` — cohérence testée dans `tests/PresaleSdkCoherence.test.ts` et libs Schnorr.
- **Bonus +5 %** : `GhostPresaleBonusRegistry` — `computePresaleBonusCredentialId` / `DEFAULT_BONUS_CREDENTIAL_DOMAIN` dans `sdk/src/presaleBonus.ts` ; ABI `GHOST_PRESALE_BONUS_REGISTRY_ABI`.
- **Airdrop welcome (100 GHOST)** : `GhostPresaleWelcomeRegistry` — `welcomeRegistryAbi.ts`, `welcomeAirdropSdk.ts` ; fenêtre basée sur `createdAt` V2 vs `startTime`/`endTime` prévente (voir `docs/PREVENTE-AIRDROP-COMMUNAUTE.md`).

### Commentaire retiré de `scripts/deploy-ghost-ecosystem.ts` (en-tête)

- *« Surcharge exceptionnelle : GHOST_SKIP_DEPLOYER_SEPARATION_CHECKS=1 (tests / debug uniquement). »* — Désactive les garde-fous qui interdisent au wallet `PRIVATE_KEY` d’être identique aux wallets tokenomics ; **à n’utiliser que hors production** (tests locaux, repro bug).

### Journaux navigateur (`index.html`, détection du bloc de déploiement)

- Anciennes traces `console.log('[Ghost] Bloc de départ …')` lors du scan `AccountCreated` : retirées pour limiter le bruit en production ; en cas de besoin, réactiver temporairement dans `detectDeployBlock` ou utiliser les outils développeur Réseau.

### Référence prix indicatif ETH (UI)

- L’estimateur dans `index.html` utilise une **fourchette hors chaîne** (ex. ~2 060 USD, bande 2 040–2 080) uniquement pour l’affichage ; le **prix effectif** reste le taux **on-chain** `ghostPerEth`.

---

## EN — Sync check (contracts ↔ SDK)

- **GhostProtocolV2 (Base)** : `getAccountInfo(pseudo1) → (name, createdAt, bool active)` — matches `sdk/src/ghostProtocolV2Abi.ts`, `protocolClient.ts`, `welcomeAirdropSdk.ts`, `ghost-sdk-unified.js`, and `index.html` (`CONTRACT_ABI`).
- **Presale** : `GhostPresale` + `buyTokensGhost` / `claimGhost` — covered by `tests/PresaleSdkCoherence.test.ts` and Schnorr libs.
- **+5 % bonus** : `GhostPresaleBonusRegistry` — `computePresaleBonusCredentialId` / `DEFAULT_BONUS_CREDENTIAL_DOMAIN` in `sdk/src/presaleBonus.ts`; `GHOST_PRESALE_BONUS_REGISTRY_ABI`.
- **Welcome airdrop (100 GHOST)** : `GhostPresaleWelcomeRegistry` — `welcomeRegistryAbi.ts`, `welcomeAirdropSdk.ts`; eligibility window uses V2 `createdAt` vs presale `startTime`/`endTime` (see `docs/PREVENTE-AIRDROP-COMMUNAUTE.md`).

### Comment removed from `scripts/deploy-ghost-ecosystem.ts` (header)

- *“Optional override: GHOST_SKIP_DEPLOYER_SEPARATION_CHECKS=1 (tests / debug only).”* — Skips checks that forbid the deployer `PRIVATE_KEY` from matching tokenomics wallets; **non-production only**.

### Browser logs (`index.html`, deploy block detection)

- Former `console.log('[Ghost] …')` lines during `AccountCreated` scan were removed to reduce console noise; re-enable locally in `detectDeployBlock` if needed.

### Indicative ETH USD (UI)

- The presale estimator uses an **off-chain band** (e.g. ~USD 2 060, range 2 040–2 080) for display only; **effective pricing** is always the on-chain `ghostPerEth` rate.
