# Contribuer

## Langue

Les issues et PR peuvent être en **français** ou en **anglais**.

## Proposition de changement

1. **Fork** du dépôt ou branche dédiée selon tes droits sur le repo.
2. **Une PR par sujet** (contrat, doc, test) pour faciliter la relecture.
3. Pour toute modification **Solidity** ou **script de déploiement** : exécuter localement :
   - `npm run compile:token`
   - `npm run test:token`

## Ce qui est refusé

- Secrets : **jamais** de `.env`, clé privée, mnémonique, PAT GitHub, URL RPC avec clé dans le dépôt.
- Modifications massives non liées au sujet de la PR (« drive-by refactor »).

## Revue

Les changements sensibles (`contrat tokken/*.sol`, `scripts/deploy-*.ts`) doivent être relus avant fusion sur `main` lorsque plusieurs mainteneurs sont actifs (voir `CODEOWNERS`).

## Sécurité

Signalement d’une vulnérabilité : voir [SECURITY.md](SECURITY.md) — **pas** d’issue publique pour les failles exploitables.

## Contact

**Rayane Hila** — **RayTech Solution** — [rayane.h42@proton.me](mailto:rayane.h42@proton.me)
