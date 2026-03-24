# Politique de sécurité

## Versions supportées

Seule la branche principale et les tags de release actifs reçoivent des correctifs de sécurité pour ce dépôt.

## Signaler une vulnérabilité

Ne pas ouvrir d’issue publique pour un problème sensible (clés, RPC, détails d’exploitation).

**Canaux recommandés (par ordre)** :

1. **[GitHub Security Advisories](https://docs.github.com/code-security/security-advisories)** — onglet **Security** du dépôt → *Report a vulnerability* (si disponible pour ton rôle).
2. **E-mail privé** : [rayane.h42@proton.me](mailto:rayane.h42@proton.me) — **Rayane Hila**, **RayTech Solution**.

**Contact général projet** (pas pour signalement sensible) : même adresse ou issues GitHub publiques pour questions non critiques.
2. Décrire l’impact, les étapes de reproduction réduites, et éventuellement un correctif suggéré.
3. Accorder un délai raisonnable avant toute divulgation publique.

## Bonnes pratiques pour les contributeurs et opérateurs

- Ne jamais committer `.env`, clés privées, mnémoniques ni URLs RPC avec clé secrète.
- Vérifier `git status` et l’historique avant un `push` public.
- Sur **Base mainnet / Sepolia**, le script `deploy-ghost-ecosystem.ts` exige toutes les variables wallet et les timestamps de prévente dans `.env` (aucune adresse de production par défaut dans le code).
- Préférer des revues de code et des audits externes pour les déploiements mainnet.

## Dépendances

Les alertes Dependabot (si activées) et `npm audit` aident à suivre les vulnérabilités connues des paquets ; elles ne remplacent pas une revue des contrats Solidity.
