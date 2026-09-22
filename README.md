# Inbox

Marketplace de petites annonces pour le Cameroun : dépôt d'annonces,
recherche, messagerie chiffrée de bout en bout, abonnement professionnel.

- **Front** : Nuxt 3 en rendu serveur, TypeScript, Tailwind, français et anglais
- **API** : Express + TypeScript, REST versionnée `/api/v1`
- **Base** : PostgreSQL 16 avec Prisma

---

## Démarrage

### Avec Docker (recommandé)

```bash
cp .env.example .env
docker compose up
```

Au premier lancement, les migrations sont appliquées et le jeu de démonstration
est chargé automatiquement. Aucune étape manuelle.

| Service              | Adresse                      |
| -------------------- | ---------------------------- |
| Front                | http://localhost:3000        |
| API                  | http://localhost:3001/api/v1 |
| Statistiques (Umami) | http://localhost:3002        |
| PostgreSQL           | localhost:5432               |

### Sans Docker

Prérequis : Node.js 20 ou 22, pnpm 10, PostgreSQL 16 avec l'extension
`unaccent` disponible.

```bash
cp .env.example .env            # ajuster DATABASE_URL et les trois secrets
pnpm install
pnpm --filter @inbox/shared build
pnpm db:migrate
pnpm db:seed
pnpm dev
```

---

## Comptes de démonstration

Créés par `pnpm db:seed`. **Ils n'existent qu'en développement** : le seed
refuse de s'exécuter avec `NODE_ENV=production`.

| Rôle           | Adresse                | Mot de passe               |
| -------------- | ---------------------- | -------------------------- |
| Particulier    | `utilisateur@inbox.cm` | `Demo-Utilisateur-2026`    |
| Professionnel  | `pro@inbox.cm`         | `Demo-Professionnel-2026`  |
| Administrateur | `admin@inbox.cm`       | `Demo-Administrateur-2026` |

Le jeu contient 40 annonces publiées réparties sur les huit catégories et les
douze villes, plus quatre annonces en attente de modération dont deux
manifestement frauduleuses, et deux conversations réellement chiffrées.

### Messagerie chiffrée en développement

Les clés privées des comptes de démonstration ne sont pas en base : elles sont
sauvegardées comme celles d'un vrai utilisateur, c'est-à-dire chiffrées par une
phrase secrète. Pour lire les conversations de démonstration, connectez-vous,
ouvrez **Messages**, puis saisissez la phrase secrète :

```
phrase-secrete-de-demonstration-2026
```

C'est le parcours réel de quelqu'un qui change d'appareil — pas un raccourci de
développement.

---

## Variables d'environnement

Toutes sont décrites et commentées dans [`.env.example`](.env.example). L'API
les valide au démarrage et **refuse de démarrer** si l'une manque ou est mal
formée, plutôt que de tomber en panne plus tard.

Les trois obligatoires en local :

```bash
DATABASE_URL=postgresql://inbox:inbox@localhost:5432/inbox?schema=public
JWT_SECRET=$(openssl rand -base64 48)
REFRESH_SECRET=$(openssl rand -base64 48)
CSRF_SECRET=$(openssl rand -base64 48)
```

En production, la validation exige en plus : Cloudinary, Resend, un fournisseur
de paiement réel (le fournisseur de démonstration est refusé), un `APP_URL` en
HTTPS et trois secrets distincts.

---

## Commandes

```bash
pnpm dev            # API et front en parallèle
pnpm build          # construction complète
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm typecheck      # TypeScript sur les trois paquets
pnpm test           # tests unitaires et tests d'API
pnpm test:e2e       # parcours Playwright
pnpm db:migrate     # migrations Prisma
pnpm db:seed        # jeu de démonstration
pnpm db:studio      # explorateur de base
```

---

## Documentation

| Fichier                  | Contenu                                                         |
| ------------------------ | --------------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md) | Décisions d'architecture, conventions, pièges connus            |
| `docs/design-reference/` | Maquette d'interface de référence                               |
| `docs/conformite/`       | Registre des traitements, points à faire valider par un juriste |
| `docs/deploiement/`      | Mise en ligne, sauvegardes, restauration                        |

---

## Licence

Projet privé. Tous droits réservés.
