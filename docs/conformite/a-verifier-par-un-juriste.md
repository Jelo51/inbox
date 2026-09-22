# Points à faire valider par un juriste

Ce document liste ce qui, dans Inbox, dépasse ce qu'un développeur peut trancher
seul. Il **ne remplace pas** les documents légaux : ceux-ci sont rédigés pour
être complets et utilisables en l'état. Il signale les endroits où une erreur
d'appréciation coûterait cher.

Dernière mise à jour : phase 2 (authentification et comptes).

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

- Quelle autorité de contrôle citer, et dans quel ordre : la CNIL au titre du
  RGPD, l'autorité camerounaise de protection des données au titre de la loi
  n° 2024/017, ou les deux, avec quelle articulation ?
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
