# Publier / synchroniser ce dépôt sur GitHub

## Dépôt public actuel

- **Ghost-token** : [https://github.com/RT01010011/Ghost-token](https://github.com/RT01010011/Ghost-token)

Si le dépôt GitHub est **déjà créé** (cas actuel), il suffit de lier l’origine et pousser les commits locaux.

## Lier l’origine (une seule fois)

À la racine du projet :

```bash
git remote add origin https://github.com/RT01010011/Ghost-token.git
```

Si `origin` existe déjà avec une autre URL :

```bash
git remote set-url origin https://github.com/RT01010011/Ghost-token.git
```

(Remplace par ton URL SSH si tu utilises des clés SSH : `git@github.com:RT01010011/Ghost-token.git`.)

## Mettre GitHub à jour avec ton dossier local

```bash
git push -u origin main
```

Si GitHub affiche encore un **ancien README** (sans e-mail, sans tests, sans lien ghost-protocol-v2), c’est en général que les **derniers commits n’ont pas été poussés** : refaire `git push origin main` après avoir résolu l’auth (PAT avec scope **`workflow`** si tu modifies `.github/workflows/`).

## Après un push réussi

- **Topics** suggérés : `solidity`, `hardhat`, `base`, `erc20`, `ethereum`, `ghost`, `presale`.
- **About** : description alignée sur le README du dépôt.
- **Dependabot** : déjà configuré via `.github/dependabot.yml`.
- **Branch protection** (optionnel) : exiger une PR vers `main` pour les contributions externes.

## Ne jamais pousser

- `.env`, clés, mnémoniques  
- `deployed-addresses-*.json` si tu y mets des données sensibles  
- `node_modules/`, `cache-ghost-token/`, `artifacts-ghost-token/`, `typechain-types/` (déjà dans `.gitignore`)

## Contact dépôt

**Rayane Hila** — **RayTech Solution** — [rayane.h42@proton.me](mailto:rayane.h42@proton.me)
