# Présenter Inbox devant un jury

Déroulé en douze minutes, avec ce qu'il faut dire à chaque étape et les
questions auxquelles se préparer.

**Avant de commencer**

- Ouvrez les trois onglets : l'accueil, une fiche d'annonce, `/pro`.
- Connectez-vous **à l'avance** avec `utilisateur@inbox.cm`, et restaurez la
  clé de messagerie (phrase secrète dans le README). Le faire en direct
  prend une minute et casse le rythme.
- Prévoyez le repli local (`docker compose up`) si le réseau de la salle est
  incertain.

---

## 1. L'accueil — trente secondes

Montrez la page d'accueil, puis **réduisez la fenêtre** jusqu'à la largeur d'un
téléphone. La barre d'onglets du bas apparaît avec le bouton « Déposer » au
centre, et la grille passe de quatre colonnes à une.

> « Le Cameroun consulte les petites annonces au téléphone. L'interface est
> pensée mobile d'abord, pas adaptée après coup. »

## 2. La recherche — une minute

Tapez **`etat`**, sans accent : sept annonces remontent, toutes contenant
« état ». Refaites la recherche avec **`état`** : le même résultat.

> « La recherche est en français, et elle ignore les accents : personne ne tape
> les accents sur un clavier de téléphone. Elle applique aussi la racinisation
> française — "meuble" trouve "meublé" et "meublés". »

Autres requêtes vérifiées, si vous préférez : `réfrigérateur` et
`refrigerateur` donnent le même résultat, `toyota` en donne deux.

Filtrez sur **Immobilier** et **Douala**, puis triez par prix croissant.
Faites remarquer que l'URL change : une recherche se partage et se met en
favori.

## 3. Une fiche d'annonce — une minute

Ouvrez une annonce. Montrez le prix, les photos, le vendeur.

Cliquez sur **« Afficher le numéro »**.

> « Le numéro du vendeur n'est pas dans la page : il n'y a qu'un aperçu masqué.
> Il faut une action explicite pour l'obtenir, chaque affichage est tracé et
> limité en fréquence. C'est ce qui empêche un robot d'aspirer tous les
> numéros du site. »

## 4. La messagerie chiffrée — trois minutes, le cœur du sujet

Ouvrez **Messages**, puis une conversation.

Cliquez sur l'icône de cadenas : l'empreinte de la clé du correspondant
s'affiche.

> « Les messages sont chiffrés sur l'appareil avant d'être envoyés. Le serveur
> transporte des données qu'il ne peut pas ouvrir. Il sait qui écrit à qui, à
> propos de quelle annonce et quand — mais jamais ce qui est dit. »

**La démonstration qui convainc** : ouvrez la console du navigateur (F12),
onglet Réseau, rechargez la conversation, et cliquez sur la requête
`.../messages`. La réponse ne contient que `ciphertext` et `nonce`.

> « Ce ne sont pas des mots masqués à l'affichage. Il n'y a pas de texte du
> tout. Un test automatisé balaye toutes les colonnes de la base de données à
> chaque intégration et fait échouer la construction s'il trouve une phrase en
> clair. »

Si on vous demande comment la modération peut agir :

> « Elle ne peut pas lire les conversations, et c'est assumé. Si un utilisateur
> veut signaler une arnaque, c'est **lui** qui déchiffre les messages sur son
> appareil et choisit de les transmettre. L'écran lui dit combien de messages
> partiront, et rien ne part sans son accord explicite. »

## 5. Le dépôt et la modération — deux minutes

Ouvrez **Déposer une annonce**. Montrez le compteur de quota.

> « Dix annonces par mois pour un particulier. Le compteur est calculé par le
> serveur, jamais par le navigateur. Une annonce refusée par la modération ne
> consomme rien : on ne fait pas payer à l'utilisateur une décision qui n'est
> pas la sienne. »

Sur les photos :

> « À chaque photo téléversée, les métadonnées sont supprimées, y compris la
> position GPS. Une photo prise chez soi contient son adresse : la publier
> telle quelle reviendrait à la diffuser à son insu. »

Et sur la modération :

> « Aucune annonce ne passe en ligne sans vérification. Un filtre automatique
> repère les formulations d'arnaque — l'argent doublé, l'acompte avant toute
> rencontre — et remonte l'annonce en tête de file. Il signale, il ne décide
> pas : c'est un humain qui tranche. »

## 6. L'abonnement Pro — deux minutes

Ouvrez **`/pro`**. Montrez les deux offres, 7 500 FCFA par mois.

Lancez un paiement par MTN Mobile Money. L'espace de démonstration s'ouvre.

> « Les comptes Maviance et Stripe ne sont pas encore ouverts : cet espace
> remplace la page du fournisseur. Mais il ne triche pas — la confirmation part
> au serveur et emprunte exactement le chemin d'une vraie notification. »

Confirmez. Le compte passe Pro, le reçu apparaît.

Téléchargez le reçu PDF.

> « Numérotation continue par année, identité de l'émetteur figée au moment de
> l'émission : un reçu ne change pas rétroactivement. »

Point technique, si le jury est technique :

> « Le statut Pro ne s'active jamais sur une redirection de navigateur, mais
> sur une notification signée du fournisseur. Et la même notification rejouée
> ne prolonge pas l'abonnement une seconde fois — les fournisseurs réémettent
> tant qu'ils n'ont pas reçu de confirmation, donc le rejeu est le cas courant,
> pas l'exception. »

## 7. Conclure — une minute

> « Cent quatre-vingt-dix-sept tests automatisés, dont ceux qui vérifient
> qu'aucun message en clair n'existe côté serveur et que les métadonnées des
> photos disparaissent réellement. L'ensemble tourne en une commande. »

---

## Questions à préparer

**« Comment gagnez-vous de l'argent ? »**
L'abonnement professionnel à 7 500 FCFA par mois. Les particuliers ne paient
rien. Pas de publicité, pas de revente de données — le modèle et la promesse de
confidentialité ne se contredisent pas.

**« Pourquoi pas WhatsApp, que tout le monde utilise déjà ? »**
Sur WhatsApp, l'annonce disparaît dans le fil, rien n'est modéré, et il faut
donner son numéro à un inconnu pour engager la conversation. Ici l'annonce est
vérifiée avant publication, la conversation est chiffrée, et le numéro reste
masqué jusqu'à ce que le vendeur le veuille.

**« Le chiffrement, c'est vrai ou c'est un argument commercial ? »**
Montrez l'onglet Réseau. C'est la réponse.

**« Et si quelqu'un se fait arnaquer ? »**
L'annonce est modérée avant publication ; un filtre automatique remonte les
formulations à risque ; le signalement existe sur chaque annonce et chaque
conversation ; et les conseils de sécurité sont accessibles depuis la fiche.
Aucun de ces garde-fous n'est suffisant seul, c'est leur superposition qui
compte.

**« Que reste-t-il à faire ? »**
Le back-office de modération, les documents légaux, et le déploiement de
production. Les comptes de paiement et l'immatriculation de la société sont des
démarches en cours, pas des questions techniques.

---

## Ce qu'il vaut mieux ne pas tenter en direct

- **Créer un compte** : l'inscription exige des conditions générales publiées,
  qui ne le sont pas encore. Utilisez les comptes de démonstration.
- **Déposer une annonce avec une photo**, si Cloudinary n'est pas configuré :
  la photo ne sera pas conservée.
- **Attendre un message en temps réel** sur un déploiement Vercel : il arrive,
  mais avec jusqu'à quinze secondes de délai.
