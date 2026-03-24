# Publier ce dépôt sur GitHub

## 1. Dépôt vide côté GitHub

Créer un nouveau repository **sans** README / `.gitignore` / licence générés par GitHub (évite un premier conflit de merge).

## 2. Lier l’origine et pousser

À la racine du projet (branche `main` déjà initialisée localement si tu as suivi l’init Git du dépôt) :

```bash
git remote add origin https://github.com/TON_ORG/TON_REPO.git
git push -u origin main
```

(Remplace par ton URL SSH si tu utilises des clés SSH.)

## 3. Après le premier push

- **Topics** suggérés : `solidity`, `hardhat`, `base`, `erc20`, `ethereum`, `ghost`, `presale`.
- **About** : coller la description courte du repo (voir README).
- Activer **Dependabot** (déjà configuré via `.github/dependabot.yml`) si GitHub le propose.
- **Branch protection** (optionnel) : exiger une PR vers `main` pour les contributions externes.

## 4. Ne jamais pousser

- `.env`, clés, mnémoniques  
- `deployed-addresses-*.json` si tu y mets des données sensibles  
- `node_modules/`, `cache-ghost-token/`, `artifacts-ghost-token/`, `typechain-types/` (déjà dans `.gitignore`)
