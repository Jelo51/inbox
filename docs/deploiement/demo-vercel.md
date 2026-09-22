# Mettre la démonstration en ligne sur Vercel

Objectif : une URL publique, stable, montrable devant un jury.

> **Lu avant tout.** Cette procédure n'a pas pu être exécutée depuis
> l'environnement de développement (aucun identifiant Vercel n'y était
> disponible). Le code, la configuration et le build ont été vérifiés
> localement ; le déploiement lui-même reste à faire et demande environ
> vingt minutes. **Faites-le au moins deux jours avant la présentation**, pas
> la veille au soir.

---

## Ce que Vercel sait faire, et ce qu'il ne sait pas faire ici

Vercel exécute du code en fonctions éphémères. Trois conséquences, toutes
acceptables pour une démonstration et **aucune acceptable en production** :

| Fonctionnalité                              | Sur Vercel                  | Conséquence pour la démonstration                                                                                                                                                               |
| ------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Messagerie temps réel                       | Pas de WebSocket persistant | Le client bascule sur son repli en interrogation périodique : un message met jusqu'à quinze secondes à apparaître. Rien ne casse.                                                               |
| Tâches planifiées                           | Ne tournent pas             | Les annonces n'expirent pas, les abonnements non plus, les purges ne s'exécutent pas. Sans effet sur une démonstration de vingt minutes.                                                        |
| Photos téléversées pendant la démonstration | Pas de disque persistant    | Sans Cloudinary, une photo déposée en direct n'est pas conservée : l'interface affiche une tuile de remplacement. **Configurez Cloudinary si vous comptez déposer une annonce devant le jury.** |

Les visuels des 40 annonces de démonstration s'affichent quoi qu'il arrive :
en l'absence de fichier, l'interface rend une tuile sobre aux couleurs du
produit plutôt qu'une image cassée.

**Pour la mise en production réelle**, la cible reste OVH avec Docker
(`docker-compose.prod.yml`, phase 9) : le temps réel, les tâches planifiées et
le stockage y fonctionnent.

---

## 1. Base de données

Vercel n'héberge pas PostgreSQL. Créez une base sur **Neon**
(`neon.tech`, offre gratuite suffisante) ou **Supabase**.

Dans Neon, activez l'extension `unaccent` — la recherche plein texte en dépend :

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

Récupérez la chaîne de connexion **avec `?sslmode=require`**, et prenez la
version _pooled_ si Neon en propose une : les fonctions serverless ouvrent
beaucoup de connexions courtes.

---

## 2. Appliquer les migrations et charger la démonstration

Depuis votre poste, une seule fois :

```bash
git clone https://github.com/Jelo51/inbox.git && cd inbox
pnpm install
pnpm --filter @inbox/shared build

export DATABASE_URL="postgresql://…?sslmode=require"
pnpm --filter @inbox/api exec prisma migrate deploy
pnpm db:seed
```

Le seed affiche à la fin les trois comptes de démonstration et la phrase
secrète de restauration des clés. **Notez-les.**

---

## 3. Déployer l'API

```bash
npm i -g vercel
cd apps/api
vercel link          # créer un projet, par exemple « inbox-api »
vercel --prod
```

Dans les réglages du projet Vercel, **Root Directory** doit valoir `apps/api`.

Variables d'environnement à définir (Settings → Environment Variables) :

```
NODE_ENV=production
DATABASE_URL=postgresql://…?sslmode=require
APP_URL=https://inbox-demo.vercel.app          # l'URL du front, voir étape 4
API_URL=https://inbox-api.vercel.app
CORS_ORIGINS=https://inbox-demo.vercel.app

JWT_SECRET=…        # openssl rand -base64 48
REFRESH_SECRET=…    # trois valeurs DIFFÉRENTES
CSRF_SECRET=…

PUBLISHER_KIND=INDIVIDUAL
PUBLISHER_NAME=Flavien Noponkoue
PUBLISHER_ADDRESS=2 avenue Robert Schuman, 51100 Reims, France
PUBLISHER_EMAIL=contact@inbox.cm
PUBLICATION_DIRECTOR=Flavien Noponkoue
PRIVACY_CONTACT_EMAIL=donnees@inbox.cm
ABUSE_CONTACT_EMAIL=abus@inbox.cm
HOST_NAME=Vercel Inc.
HOST_ADDRESS=440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
HOST_COUNTRY=États-Unis
```

> **`NODE_ENV=production` refusera de démarrer** tant que Cloudinary, Resend et
> un vrai fournisseur de paiement ne sont pas configurés — c'est voulu, la
> validation protège la mise en production. Pour une démonstration, mettez
> **`NODE_ENV=development`** : l'espace de paiement de démonstration, le
> transport d'e-mails en console et le stockage local redeviennent disponibles.
> Ne laissez jamais cette valeur sur un site réellement ouvert au public.

Si vous disposez d'un compte Cloudinary, ajoutez `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET` : les photos déposées pendant
la démonstration seront alors conservées.

---

## 4. Déployer le front

```bash
cd ../web
vercel link          # par exemple « inbox-demo »
vercel --prod
```

**Root Directory** : `apps/web`. Variables :

```
NUXT_PUBLIC_API_BASE=https://inbox-api.vercel.app/api/v1
NUXT_PUBLIC_SITE_URL=https://inbox-demo.vercel.app
```

Puis retournez dans le projet de l'API pour que `APP_URL` et `CORS_ORIGINS`
pointent bien vers l'URL définitive du front, et redéployez l'API.

---

## 5. Vérifier avant le jour J

```bash
curl https://inbox-api.vercel.app/api/v1/health          # {"status":"ok"}
curl -s "https://inbox-api.vercel.app/api/v1/listings?limit=1" | head -c 200
```

Puis, dans un navigateur, déroulez le parcours de `docs/demo-jury.md` **en
entier**, sur mobile et sur ordinateur. Une démonstration répétée une fois à
blanc ne réserve pas de surprise.

---

## Solution de repli, si Vercel résiste

Le front sur Vercel et l'API sur un hébergeur de conteneurs
(**Render**, **Railway** ou **Fly.io**, tous avec une offre gratuite) évitent
d'un coup les trois limitations du tableau ci-dessus : le `Dockerfile` de
production de la phase 9 s'y déploie tel quel, avec le temps réel et les
tâches planifiées.

Et si le réseau de la salle fait défaut, `docker compose up` sur l'ordinateur
du présentateur donne exactement la même application en local. **Prévoyez ce
repli**, quelle que soit la solution retenue.
