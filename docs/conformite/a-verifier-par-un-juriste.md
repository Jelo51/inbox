# Points à faire valider par un juriste

Ce document liste ce qui, dans Inbox, dépasse ce qu'un développeur peut trancher
seul. Il **ne remplace pas** les documents légaux : ceux-ci sont rédigés pour
être complets et utilisables en l'état. Il signale les endroits où une erreur
d'appréciation coûterait cher.

Dernière mise à jour : phase 7 (légal et conformité).

---

## 1. Établissement de l'éditeur et droit applicable

**Confirmé par le porteur du projet.** L'adresse 2 avenue Robert Schuman,
51100 Reims, France est bien celle de l'éditeur, et non un domicile temporaire.
L'éditeur est aujourd'hui Flavien Noponkoue, personne physique, établi en
France. La future SARL Inbox aura son siège au Cameroun.

**Conséquence retenue.** Le responsable du traitement étant établi dans l'Union
européenne, le RGPD s'applique au traitement, indépendamment du fait que les
utilisateurs visés se trouvent au Cameroun et en Afrique centrale. Les
documents légaux sont donc rédigés sous **deux cadres cumulés** : le droit
camerounais et le RGPD. Ce n'est plus une hypothèse de prudence mais le régime
de référence du projet.

**Une inversion à ne pas manquer.** L'hébergement chez OVH en France ne pose
aucune question de transfert au sens du RGPD, puisque les données restent dans
l'Union. En revanche, il constitue bien un **transfert hors du Cameroun** au
sens de la loi n° 2024/017, et doit être encadré comme tel. C'est l'inverse de
l'intuition habituelle.

**Ce qu'il reste à faire valider.**

- **Dénomination exacte de l'autorité camerounaise.** Les documents publiés
  citent l'« Autorité de Protection des Données à Caractère Personnel (APDP) ».
  Cette dénomination a été **fournie par le porteur du projet** et n'a pas pu
  être recoupée avec le texte publié de la loi n° 2024/017 ni avec un acte de
  création. Si l'autorité porte un autre nom, ou n'est pas encore installée,
  les sept documents doivent être republiés en version 1.1 : la mention d'une
  autorité inexistante rendrait le droit de réclamation impraticable.
- Quelle autorité de contrôle citer, et dans quel ordre : la CNIL au titre du
  RGPD, l'APDP au titre de la loi n° 2024/017, ou les deux, avec quelle
  articulation ? Les documents citent aujourd'hui les deux, l'APDP en premier.
- Quelles formalités préalables auprès de l'autorité camerounaise, compte tenu
  d'un responsable de traitement établi hors du Cameroun ?
- La désignation d'un délégué à la protection des données est-elle obligatoire ?
  L'activité n'implique ni traitement de données sensibles à grande échelle ni
  surveillance systématique au sens du RGPD, mais le volume de données
  personnelles traitées mérite un avis.
- Un éditeur personne physique établi en France doit-il en outre satisfaire les
  obligations françaises applicables aux éditeurs de services en ligne ?
- **Au moment de l'immatriculation de la SARL au Cameroun** : le transfert de
  la qualité d'éditeur vers la société déplace l'établissement hors de l'Union.
  Le RGPD cessera-t-il alors de s'appliquer, ou continuera-t-il au titre des
  moyens de traitement restés en France, ou de la direction effective depuis
  Reims ? Cette question déterminera s'il faut publier une nouvelle version des
  documents ou simplement en changer l'identité de l'éditeur.

**Ce que fait le code.** L'identité de l'éditeur vit dans les variables
d'environnement (`PUBLISHER_*`) et les documents sont versionnés en base : le
changement d'éditeur ne demandera aucune réécriture, seulement une nouvelle
version publiée.

---

## 2. Statut d'hébergeur et responsabilité éditoriale

Inbox se présente comme hébergeur d'annonces et intermédiaire, non partie aux
ventes entre utilisateurs. Ce statut conditionne le régime de responsabilité.

**À faire trancher.**

- La modération _a priori_ des annonces (file `PENDING` avant publication)
  remet-elle en cause le statut d'hébergeur, en droit camerounais comme en
  droit français ?
- Quelles obligations de retrait sur signalement, et sous quel délai ?
- Faut-il conserver des données d'identification des auteurs de contenu, et
  pendant combien de temps ? Cette obligation entrerait en tension avec la
  suppression de compte en libre-service.

---

## 3. Entrée en vigueur de la loi camerounaise sur les données personnelles

La loi n° 2024/017 du 23 décembre 2024 portant protection des données à
caractère personnel est indiquée comme en vigueur depuis le 23 juin 2026. Cette
date a été fournie par le porteur du projet et **n'a pas pu être vérifiée**.

**À faire vérifier.** La date d'entrée en vigueur, l'existence et la
désignation de l'autorité de protection des données, et les formalités
préalables éventuelles.

---

## 4. Fiscalité de l'abonnement Pro

Le prix retenu est de 7 500 FCFA par mois, annoncé TTC.

**À faire trancher.**

- L'éditeur est-il assujetti à la TVA camerounaise (19,25 %) sur ce service ?
  Tant que la société n'est pas immatriculée et sans NIU, la question reste
  ouverte.
- Si l'éditeur est établi en France, quel régime de TVA s'applique à un service
  vendu à des clients camerounais ?
- Quelles mentions obligatoires sur les reçus, et faut-il émettre des factures
  au sens fiscal plutôt que des reçus ?

**Ce que fait le code en attendant.** `Plan.vatRateBp` vaut 0 et le montant est
affiché « 7 500 FCFA TTC ». Activer la TVA ne demande qu'un changement en base.

---

## 5. Absence de remboursement de l'abonnement

La politique retenue est : aucun remboursement, résiliation effective à la fin
de la période payée.

**À faire trancher.** Cette clause est-elle opposable au regard de la loi-cadre
n° 2011/012 du 6 mai 2011 portant protection du consommateur au Cameroun ?
Existe-t-il un droit de rétractation applicable à un service numérique vendu à
distance, et une exécution immédiate du service y fait-elle échec ?

---

## 6. Messagerie chiffrée et réquisitions

Le serveur ne peut techniquement pas déchiffrer les messages. C'est un choix
assumé, expliqué aux utilisateurs.

**À faire trancher.**

- Cette impossibilité technique est-elle compatible avec les obligations de la
  loi n° 2010/012 du 21 décembre 2010 relative à la cybersécurité et à la
  cybercriminalité au Cameroun ?
- Quelle réponse apporter à une réquisition judiciaire portant sur le contenu
  de conversations ? Le dispositif de signalement volontaire, où l'utilisateur
  déchiffre lui-même et transmet, est-il suffisant ?
- Faut-il documenter cette limite ailleurs que dans la politique de
  confidentialité ?

---

## 7. Transferts de données hors du Cameroun

Les destinataires envisagés et leur pays d'implantation :

| Sous-traitant           | Rôle                                  | Pays                          |
| ----------------------- | ------------------------------------- | ----------------------------- |
| OVH                     | Hébergement                           | France                        |
| Cloudinary              | Stockage et transformation des photos | États-Unis / Union européenne |
| Resend                  | Envoi des e-mails transactionnels     | États-Unis                    |
| Maviance Smobilpay      | Paiement Mobile Money                 | Cameroun                      |
| Stripe _(sous réserve)_ | Paiement par carte                    | États-Unis / Irlande          |

**À faire trancher.** Quelles garanties encadrer pour les transferts hors du
Cameroun au sens de la loi n° 2024/017, et hors de l'Union au sens du RGPD ?
Les clauses contractuelles types des sous-traitants suffisent-elles ?

---

## 8. Mineurs

L'inscription est réservée aux personnes de 18 ans ou plus, par déclaration à
l'inscription, sans vérification d'identité.

**À faire trancher.** Une déclaration sur l'honneur suffit-elle ? Quelle
conduite tenir si un compte de mineur est signalé ?

---

## 9. Conservation des messages jusqu'à la suppression du compte

Le porteur du projet a retenu : **les messages sont conservés jusqu'à la
suppression du compte**, sans durée maximale. Le code applique ce choix — il
n'existe aucune tâche de purge des messages.

**À faire trancher.** Une conservation sans terme est-elle compatible avec le
principe de limitation de la durée (article 5.1.e du RGPD) ? L'argument retenu
est que les messages sont chiffrés de bout en bout : le responsable ne peut ni
les lire, ni juger de leur péremption, et les effacer d'office priverait leurs
deux auteurs d'un historique dont eux seuls détiennent la clé. Cet argument
tient-il devant une autorité de contrôle, ou faut-il fixer malgré tout une
durée (trois ans après le dernier message d'une conversation, par exemple) ?

---

## 10. Suppression de compte par anonymisation

La suppression en libre-service **n'efface pas la ligne du compte** : elle la
vide de tout ce qui identifie une personne et la marque comme supprimée. La
raison est technique et comptable — le reçu de paiement doit survivre dix ans,
et il est rattaché à un paiement lui-même rattaché au compte.

**À faire trancher.**

- Cette anonymisation est-elle suffisante au sens du droit à l'effacement
  (article 17 du RGPD) ? L'adresse électronique est remplacée par une valeur
  aléatoire unique, non réversible et sans lien avec l'ancienne ; le nom
  devient « Compte supprimé ».
- Les acceptations de documents légaux et les paiements restent rattachés au
  compte anonymisé. Est-ce le bon équilibre entre le droit à l'effacement et
  l'obligation de prouver ce qui a été accepté et facturé ?
- Le journal d'audit conserve les décisions de modération dont la personne a
  fait l'objet, pendant cinq ans, avec l'identifiant de son compte anonymisé.
  La durée est-elle défendable ?

---

## 11. Conservation de données d'identification des auteurs de contenu

Une obligation de conserver de quoi identifier les auteurs de contenus publiés
entrerait en **contradiction directe** avec deux choix déjà faits : la
troncature systématique des adresses IP, et la suppression de compte par
anonymisation immédiate.

**À faire trancher, en priorité.** Si une telle obligation existe en droit
camerounais ou en droit français applicable à l'éditeur, elle change
l'architecture : il faudrait conserver l'adresse IP complète à la publication,
ce que le code ne fait nulle part aujourd'hui. Mieux vaut le savoir avant la
mise en ligne qu'après.

---

## 12. Absence de médiateur de la consommation

**Aucun médiateur de la consommation n'est désigné**, et les conditions
générales n'en mentionnent aucun. Elles prévoient un règlement amiable par
courrier électronique, puis la compétence des juridictions camerounaises.

**À faire trancher.** La désignation d'un médiateur est-elle obligatoire pour
un service vendu à distance à des consommateurs, en droit camerounais comme en
droit français applicable à un éditeur établi en France ? Si oui, la clause de
règlement des différends des CGU et des CGV doit être republiée.

---

## 13. Contact par courrier électronique uniquement

Le porteur du projet a retenu : **l'adresse électronique suffit**, aucun numéro
de téléphone ni formulaire de contact n'est publié.

**À faire trancher.** Les mentions obligatoires d'un éditeur de service en
ligne exigent-elles un moyen de contact direct supplémentaire ? Les variables
`PUBLISHER_PHONE` existent et sont vides : les renseigner fait apparaître la
ligne correspondante dans les documents, sans republication.

---

## 14. Rédaction en deux langues

Les sept documents existent en français et en anglais, chaque version anglaise
se terminant par une clause de prévalence du français. L'acceptation à
l'inscription porte sur la **version française**, quelle que soit la langue
d'affichage.

**À faire trancher.** Faire accepter une version française à un utilisateur qui
lit l'anglais est-il opposable ? Faut-il au contraire enregistrer l'acceptation
de la version lue, en maintenant la prévalence du français en cas de
divergence ?
