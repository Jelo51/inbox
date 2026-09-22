# Inbox — mémo de travail

Marketplace de petites annonces pour le Cameroun. Ce fichier est la mémoire du
projet : commandes, conventions, décisions d'architecture et pièges rencontrés.
Il se met à jour quand une décision change.

---

## Commandes

```bash
# Tout l'environnement (Postgres, Umami, API, front), migrations et seed compris
docker compose up

# Sans Docker, avec un Postgres 16 déjà disponible
pnpm install
pnpm --filter @inbox/shared build      # les autres paquets en dépendent
pnpm db:migrate                        # migrations Prisma
pnpm db:seed                           # jeu de démonstration
pnpm dev                               # API sur :3001, front sur :3000

# Qualité — ce que la CI exécute
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

# Base de données
pnpm db:generate                       # régénérer le client Prisma
pnpm db:studio                         # explorateur Prisma
pnpm --filter @inbox/api exec prisma migrate dev --name <nom>
```

`packages/shared` doit être construit avant `apps/api` et `apps/web` : ils
importent son `dist/`. `pnpm build` le fait dans le bon ordre.

---

## Structure

```
apps/web        Nuxt 3 en SSR — TypeScript strict, Pinia, Tailwind, i18n fr/en
apps/api        Express + TypeScript — API REST /api/v1, Socket.IO, node-cron
packages/shared Schémas Zod, énumérations, constantes, utilitaires communs
docs/           Maquette de référence, conformité, déploiement
docker/         Images et configuration Nginx
```

Le front et l'API valident avec **les mêmes schémas Zod**, importés de
`@inbox/shared`. Une règle de validation ne s'écrit jamais deux fois.

---

## Décisions d'architecture

### Versions retenues, et pourquoi

| Choix                       | Raison                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript 5.9** et non 7 | TypeScript 7 (compilateur Go) n'est pas encore éprouvé avec `vue-tsc` et Prisma. À réévaluer quand l'écosystème aura suivi. |
| **ESLint 9** et non 10      | `eslint-plugin-vue` et `typescript-eslint` ciblent encore ESLint 9.                                                         |
| **Zod 3.25** et non 4       | Zod 4 change l'API des messages d'erreur (`errorMap` → `error`). Aucun gain qui justifie la migration aujourd'hui.          |
| **Express 4** et non 5      | Express 5 modifie la propagation des erreurs asynchrones ; le gain ne vaut pas le risque sur une base neuve.                |
| **Prisma 6** et non 7       | Prisma 7 change le générateur de client et impose un fichier de configuration séparé. À faire en une fois, plus tard.       |
| **Nuxt 3** et non 4         | Demandé au cahier des charges. `future.compatibilityVersion: 4` active déjà les comportements de Nuxt 4 utiles.             |
| **pino 10**                 | `pino-http` 11 est incompatible avec pino 9 (`logger[stringifySym] is not a function`). Les deux doivent avancer ensemble.  |

### Authentification

- **Jeton d'accès de 15 minutes** (JWT HS256, `jose`), **jeton de
  rafraîchissement de 30 jours** en cookie `httpOnly` `Secure` `SameSite=Lax`,
  limité au chemin `/api/v1/auth`.
- **Rotation à chaque usage, avec détection de rejeu.** Chaque connexion ouvre
  une chaîne (`familyId`). Si un jeton déjà consommé revient, toute la chaîne
  est révoquée : on ne sait pas distinguer le voleur du propriétaire, donc les
  deux sont déconnectés.
- **La session est revérifiée en base à chaque requête.** Un jeton d'accès
  reste cryptographiquement valide jusqu'à son expiration ; une déconnexion
  doit pourtant prendre effet immédiatement.
- **CSRF par double soumission signée.** Le cookie CSRF est lisible par le
  script (c'est le principe), mais sa valeur est signée avec `CSRF_SECRET` :
  sans cela, un sous-domaine compromis pourrait fabriquer une paire cohérente.
- **Aucune énumération de comptes.** Mot de passe faux et compte inexistant
  donnent la même réponse, et le même temps de calcul (`wastePasswordTime`).
  Le formulaire de mot de passe oublié répond toujours la même chose.

### Documents légaux et inscription

L'inscription **dépend** des CGU et de la politique de confidentialité publiées
en base : sans elles, `/auth/legal-versions` répond 503 et le formulaire
affiche un message explicite. C'est voulu — on ne fait pas accepter des
conditions qui n'existent pas — mais cela crée une dépendance de la phase 2
envers la phase 7. Ces deux documents sont donc rédigés avant les cinq autres.

L'utilisateur accepte une **version identifiée**. Le serveur refuse une
acceptation portant sur une version périmée, et une nouvelle version publiée
réapparaît comme « à réaccepter » à la connexion suivante. Les acceptations
précédentes restent en base : il faut pouvoir prouver ce qui a été accepté,
et quand.

### Annonces

- **Rien ne passe en ligne sans modération.** Le dépôt crée une annonce
  `PENDING`, jamais `PUBLISHED`. Modifier le contenu d'une annonce en ligne la
  y renvoie : sinon il suffirait de publier une annonce anodine puis d'en
  changer le texte.
- **Les métadonnées des photos sont supprimées**, position GPS comprise. Une
  photo prise au domicile du vendeur porte son adresse ; la publier telle
  quelle la diffuserait à son insu. `sharp` applique d'abord l'orientation EXIF
  (`rotate()` sans argument) puis jette tout le reste — sans cela, les photos
  de portrait ressortiraient couchées.
- **Le type réel d'une image est lu dans ses octets**, jamais dans son
  extension ni son `Content-Type`. Les SVG sont refusés explicitement : ils
  peuvent embarquer du script.
- **Le quota est recalculé depuis les données**, jamais tenu dans un compteur :
  un compteur se désynchronise à la première suppression ou au premier rejet.
  Seules les annonces réellement publiées dans le mois sont comptées — une
  annonce refusée ne consomme rien.
- **Pagination par curseur**, pas par décalage : avec `OFFSET`, une nouvelle
  annonce publiée pendant le défilement ferait sauter ou répéter des résultats.
- **Le numéro de téléphone n'est jamais renvoyé en clair** sur la fiche : elle
  ne porte qu'un aperçu masqué. Le numéro complet exige une requête explicite,
  tracée dans `PhoneReveal` et limitée en fréquence.

### Messagerie chiffrée

- **Une paire de clés par compte**, pas par appareil. Le multi-appareil passe
  par la restauration de la sauvegarde, pas par une clé de plus : sinon chaque
  message devrait être chiffré autant de fois qu'il y a d'appareils.
- **Chaque message est chiffré deux fois** : pour le destinataire, et pour
  l'expéditeur lui-même. Sans cette seconde copie, on ne pourrait pas relire
  ses propres messages après restauration sur un autre appareil.
- **La clé privée ne quitte jamais l'appareil en clair.** Elle vit dans
  IndexedDB. La sauvegarde envoyée au serveur est chiffrée par `nacl.secretbox`
  avec une clé dérivée en argon2id de la phrase secrète, que le serveur ne voit
  jamais. Le serveur stocke des octets inertes.
- **L'empreinte est vérifiée côté serveur.** Un client modifié pourrait sinon
  afficher une empreinte rassurante sur une clé qui ne l'est pas.
- **Les clés retirées restent en base.** Les supprimer casserait le rattachement
  des messages déjà échangés à la clé qui les a chiffrés.
- **Les primitives vivent dans `apps/web/app/utils/e2ee.ts`**, sans dépendance
  à Nuxt : elles sont ainsi testables directement, et le seed de l'API produit
  exactement le même format (un test le vérifie sur les données réelles).
- **Une conversation naît toujours d'une annonce.** Sans cette contrainte, la
  messagerie deviendrait un canal de démarchage à froid.
- **404 et non 403** sur une conversation dont on ne fait pas partie : répondre
  « interdit » confirmerait son existence.
- **Le repli en interrogation périodique n'est pas théorique** : les réseaux
  mobiles coupent régulièrement les WebSockets.

### Sécurité et vie privée

- **Le serveur ne peut pas lire les messages.** Le modèle `Message` n'a aucun
  champ de texte en clair, et `tests/unit/message-schema.test.ts` fait échouer
  la CI si quelqu'un en ajoute un. Le seul texte de conversation en clair du
  système vit dans `DisclosedMessage`, alimenté uniquement quand un utilisateur
  choisit explicitement de déchiffrer et de transmettre à la modération.
- **Aucune adresse IP complète n'est conservée.** `truncateIp()` tronque en
  /24 (IPv4) ou /48 (IPv6) ; c'est ce qui est écrit dans les journaux, dans
  `LegalAcceptance` et dans `ConsentRecord`.
- **Le journal d'audit est immuable en base**, pas seulement dans le code : un
  déclencheur PostgreSQL refuse tout `UPDATE`, et n'autorise `DELETE` qu'au-delà
  de la durée de conservation de cinq ans. Une purge légale reste possible, un
  effacement opportuniste non.
- **Les polices sont servies localement** via `@fontsource`. Charger Google
  Fonts enverrait l'adresse IP de chaque visiteur à un tiers, sans base légale
  et sans consentement.
- **La configuration est validée au démarrage.** `parseEnv()` fait échouer le
  lancement si une variable manque. En production, elle refuse aussi le
  fournisseur de paiement de démonstration, un `APP_URL` en clair, et trois
  secrets qui ne seraient pas distincts.

### Base de données

- **Recherche plein texte** : colonne générée `Listing.searchVector`
  (`tsvector`, configuration `french`, accents retirés), index GIN.
- **Quota mensuel** : calculé côté serveur à partir de `startOfMonthDouala()`.
  Le fuseau de Douala (UTC+1, sans heure d'été) fait foi, pas UTC : sinon la
  bascule aurait lieu à 1 h du matin pour les utilisateurs.
- **Suppression réelle par défaut.** `deletedAt` n'existe que là où une
  obligation légale impose de garder une trace.

### Paiements

Aucun compte Maviance ni Stripe n'est ouvert à ce jour. Le code passe par une
abstraction à trois implémentations : `MOCK` (espace de paiement de
démonstration, refusé en production), `MAVIANCE`, `STRIPE`. Brancher un
fournisseur réel ne demandera que de remplir les variables d'environnement.

**À vérifier avant d'engager quoi que ce soit** : le Cameroun ne figure pas,
à notre connaissance, parmi les pays où Stripe accepte l'ouverture d'un compte
marchand. Si c'est confirmé, il faudra un agrégateur couvrant le Cameroun
(Flutterwave, Paystack, Notch Pay, CinetPay) à la place de Stripe.

### Abonnement Pro et paiements

- **Le statut Pro n'est activé que par le serveur.** L'initiation laisse le
  paiement et l'abonnement en `PENDING` ; seule une notification vérifiée les
  fait basculer. Une redirection de navigateur ne prouve rien.
- **L'idempotence est portée par la base**, pas par une lecture préalable :
  `Payment.webhookEventId` est unique, donc un rejeu concurrent échoue à
  l'insertion. Les fournisseurs réémettent tant qu'ils n'ont pas reçu un 200 —
  le rejeu est le cas courant, pas l'exception.
- **Les webhooks sont lus bruts** (`express.raw` monté avant `express.json`) :
  recalculer une signature sur un JSON re-sérialisé échouerait, l'ordre des
  clés et les espaces n'étant pas préservés.
- **On répond 200 même à une signature invalide** : détailler l'échec
  renseignerait un attaquant et déclencherait des réémissions sans fin.
- **La numérotation des reçus est continue par année.** Une séquence PostgreSQL
  laisserait un trou à chaque transaction annulée, d'où le calcul sous verrou
  d'avis (`inbox_next_receipt_sequence`).
- **L'identité de l'éditeur est figée dans le reçu** (`issuerSnapshot`) : un
  reçu ne change pas rétroactivement le jour de l'immatriculation.
- **La résiliation prend effet en fin de période payée.** Couper
  immédiatement reviendrait à reprendre un service déjà facturé.
- **Le rôle PRO est porté par `User.role`**, pas déduit d'un calcul de date à
  chaque contrôle d'accès : une tâche planifiée le retire à l'échéance. Un
  modérateur ou un administrateur qui s'abonne garde son rôle.
- **Aucun prélèvement automatique.** Le renouvellement est à l'initiative de
  l'utilisateur, avec une relance par e-mail trois jours avant l'échéance.

### Cadre juridique

**Le RGPD s'applique**, confirmé en phase 0 : l'éditeur est établi à Reims, en
France, donc dans l'Union européenne, quel que soit le pays des utilisateurs.
Les documents légaux et le registre des traitements sont rédigés sous deux
cadres cumulés, droit camerounais et RGPD.

Corollaire contre-intuitif : héberger chez OVH en France ne déclenche aucun
transfert au sens du RGPD, mais constitue bien un transfert hors du Cameroun au
sens de la loi n° 2024/017.

### Identité de l'éditeur

Elle vit **entièrement dans les variables d'environnement** (`PUBLISHER_*`,
`HOST_*`), jamais en dur dans les textes. La société Inbox SARL n'est pas encore
immatriculée : l'éditeur est aujourd'hui une personne physique. Le jour de
l'immatriculation, changer ces variables et publier une nouvelle version des
documents légaux suffit — `LegalDocument` en garde l'historique.

---

## Pièges connus

- **`unaccent()` n'est pas `IMMUTABLE`** appelée sans dictionnaire explicite,
  donc inutilisable dans une colonne générée. La fonction `inbox_unaccent()`
  (migration `20260922070000`) nomme le dictionnaire, ce qui la rend
  déterministe. C'est le contournement standard.
- **pnpm 10 n'exécute plus les scripts d'installation** sans autorisation.
  Prisma, argon2 et esbuild en ont besoin : voir `onlyBuiltDependencies` dans
  `pnpm-workspace.yaml`.
- **`new Date()` est interdit** hors des deux services horloge
  (`packages/shared/src/utils/clock.ts` et `apps/api/src/lib/clock.ts`, règle
  ESLint). Toute lecture d'heure passe par eux, pour que les tests puissent
  figer le temps.
- **Nuxt préfixe les composants par leur dossier.** Sans
  `components: [{ path: '~/components', pathPrefix: false }]`,
  `ui/FormField.vue` devient `<UiFormField>` et une balise `<FormField>` se
  rend silencieusement comme un élément inconnu — le symptôme est une erreur
  de déstructuration des props de slot, à mille lieues de la cause.
- **Vue ne camélise pas les props de slot** : `:described-by` reste
  `described-by` dans l'objet de portée. Passer `v-bind="{ describedBy }"`
  lève l'ambiguïté.
- **Nuxt importe automatiquement** `useI18n`, `useHead`, `computed`… : la règle
  `no-undef` est désactivée sur `apps/web`, TypeScript fait le travail.
- **Le seed refuse de tourner si des annonces existent déjà**, et refuse
  catégoriquement `NODE_ENV=production`.
- **Supprimer un `User` ne peut pas cascader jusqu'au `Payment`** : `Receipt`
  est en `Restrict` sur son paiement, délibérément — une pièce comptable ne
  disparaît pas parce qu'on supprime un compte. La suppression de compte
  (phase 7) devra donc **anonymiser** et non supprimer.
- **`Report.authorId` est en `SetNull`** : supprimer un compte laisse ses
  signalements derrière lui, et avec eux les messages transmis en clair dans
  `DisclosedMessage`. La purge de compte devra les effacer explicitement — à
  traiter en phase 7.
- **Les polices PDF standard utilisent l'encodage WinAnsi**, qui ne connaît ni
  l'apostrophe typographique ni les tirets longs. `toWinAnsi()` les ramène à
  leur équivalent ASCII ; sans cela, `pdf-lib` lève « WinAnsi cannot encode »
  et un mot de trop dans un libellé casserait la facturation.
- **Prisma transmet les entiers JavaScript en `bigint`** dans `$queryRaw` :
  une fonction SQL déclarée sur `integer` reste introuvable sans transtypage
  explicite (`${year}::int`).
- **Aucun emoji** dans l'interface, les e-mails ou les documents légaux. Les
  icônes viennent de `lucide-vue-next`.

---

## Conventions

- **Commits** : Conventional Commits, en français.
  `feat(api): ...`, `fix(web): ...`, `chore: ...`, `docs: ...`.
- **Interface et documentation en français**, y compris les commentaires de
  code et les messages d'erreur. L'anglais est une langue d'affichage
  (i18n), pas la langue du dépôt.
- **Commentaires** : expliquer _pourquoi_, pas _quoi_. Un commentaire qui
  paraphrase le code est du bruit.
- **Montants** : entiers de francs CFA, formatés par `formatPrice()`
  (`385 000 FCFA`). Le FCFA n'a pas de sous-unité.
- **Les prix métier vivent en base** (`Plan.priceXaf`), jamais en dur.

---

## État d'avancement

| Phase                  | État    |
| ---------------------- | ------- |
| 1. Fondations          | fait    |
| 2. Auth et comptes     | fait    |
| 3. Annonces            | fait    |
| 4. Messagerie chiffrée | fait    |
| 5. Pro et paiements    | fait    |
| 6. Modération et admin | à faire |
| 7. Légal et conformité | à faire |
| 8. Finitions           | à faire |
| 9. Déploiement         | à faire |
