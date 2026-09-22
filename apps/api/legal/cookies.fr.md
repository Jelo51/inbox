# Politique cookies

**Version 1.0** — en vigueur depuis le {{document.effectiveAt}}

## L'essentiel

Inbox dépose **quatre cookies, tous strictement nécessaires** à son
fonctionnement. Aucun cookie publicitaire. Aucun traceur tiers. Aucun script
externe chargé avant, pendant ou après votre visite.

C'est pourquoi vous ne verrez pas de bandeau vous demandant d'accepter des
traceurs : il n'y en a aucun à accepter. Les cookies listés ci-dessous ne
peuvent pas être refusés, car sans eux le site ne fonctionne pas — mais aucun
ne sert à vous suivre.

## Sommaire

1. Cookies strictement nécessaires
2. Mesure d'audience
3. Cookies déposés par des tiers
4. Gérer vos cookies
5. Si cela devait changer

---

## 1. Cookies strictement nécessaires

| Nom             | Finalité                                                                                                                                      | Durée     | Émetteur         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------- |
| `inbox_refresh` | Maintenir votre session ouverte d'une visite à l'autre. Inaccessible au code de la page (`httpOnly`), limité aux adresses d'authentification. | 30 jours  | {{site.domaine}} |
| `inbox_csrf`    | Protéger contre les requêtes falsifiées : la valeur est signée par nos serveurs et comparée à un en-tête que seul le site peut envoyer.       | 30 jours  | {{site.domaine}} |
| `inbox_locale`  | Mémoriser votre choix de langue, français ou anglais.                                                                                         | 1 an      | {{site.domaine}} |
| `inbox_vue`     | Éviter de compter plusieurs fois la même visite sur une annonce. Contient un identifiant aléatoire sans lien avec votre compte.               | 24 heures | {{site.domaine}} |

Ces quatre cookies sont **propres à Inbox**. Aucun n'est lu par un tiers, aucun
ne sort de nos serveurs, aucun ne sert à établir un profil publicitaire.

`inbox_vue` mérite une précision : il contient un nombre tiré au sort, changé
chaque jour, qui sert uniquement à ne pas compter deux fois la même personne
sur la même annonce. Il ne permet ni de vous identifier, ni de vous suivre d'une
annonce à l'autre, ni de relier vos visites à votre compte.

## 2. Mesure d'audience

Nous mesurons la fréquentation du site avec une solution **auto-hébergée qui ne
dépose aucun cookie** et n'utilise aucun identifiant persistant.

Elle enregistre la page consultée, la page d'origine, le type d'appareil et le
pays, sans constituer de profil individuel et sans possibilité de vous
reconnaître d'une visite à l'autre. Les données restent sur nos serveurs et ne
sont transmises à personne.

C'est un choix délibéré : une mesure d'audience classique aurait exigé un
bandeau de consentement et un transfert de données vers un tiers.

## 3. Cookies déposés par des tiers

**Sur les pages d'Inbox, aucun.**

Un seul cas fait exception, et il ne se produit que si vous souscrivez un
abonnement professionnel par carte bancaire : vous êtes alors redirigé vers la
page de paiement de **Stripe**, qui dépose ses propres cookies à des fins de
sécurité et de lutte contre la fraude.

Ces cookies sont déposés **par Stripe, sur le domaine de Stripe**, sous sa
responsabilité et selon sa propre politique de confidentialité. Nous n'y avons
pas accès. Vous ne les rencontrez que le temps du paiement, et jamais en
naviguant sur Inbox.

Le paiement par Mobile Money ne passe par aucune page tierce : la confirmation
se fait sur votre téléphone.

## 4. Gérer vos cookies

Les quatre cookies listés à la section 1 étant strictement nécessaires, il n'y
a rien à accepter ni à refuser : sans eux, vous ne pourriez ni rester connecté,
ni être protégé contre les requêtes falsifiées.

Vous pouvez néanmoins les supprimer ou les bloquer depuis les réglages de votre
navigateur. Dans ce cas :

- vous serez déconnecté à chaque rechargement de page ;
- certaines actions seront refusées par la protection anti-falsification ;
- votre choix de langue ne sera pas mémorisé.

Chaque navigateur a ses propres réglages ; cherchez « cookies » dans ses
préférences.

## 5. Si cela devait changer

Si nous devions un jour ajouter un traceur soumis à consentement, alors :

- **aucun traceur ne serait déposé avant votre choix** ;
- un bandeau vous proposerait de tout accepter ou de tout refuser, avec **deux
  boutons de même visibilité et de même difficulté d'accès** ;
- aucune case ne serait précochée ;
- votre choix serait modifiable à tout moment et vous serait redemandé au bout
  de six mois ;
- votre choix serait enregistré, avec sa date et une adresse IP tronquée, pour
  que nous puissions en justifier.

Le mécanisme technique est déjà en place. Il est simplement inutilisé, faute de
traceur à soumettre à consentement.

---

Cette politique complète la
[politique de confidentialité]({{site.url}}/legal/confidentialite).

En cas de divergence entre la version française et la version anglaise de la
présente politique, **la version française fait foi**.
