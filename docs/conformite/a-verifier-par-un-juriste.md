# Points à faire valider par un juriste

Ce document liste ce qui, dans Inbox, dépasse ce qu'un développeur peut trancher
seul. Il **ne remplace pas** les documents légaux : ceux-ci sont rédigés pour
être complets et utilisables en l'état. Il signale les endroits où une erreur
d'appréciation coûterait cher.

Dernière mise à jour : phase 1 (fondations).

---

## 1. Établissement de l'éditeur et droit applicable — priorité haute

**Le fait.** L'éditeur est aujourd'hui Flavien Noponkoue, personne physique,
domicilié 2 avenue Robert Schuman, 51100 Reims, France. La société Inbox SARL
n'est pas encore immatriculée. Le public visé est le Cameroun, puis l'Afrique
centrale.

**Le problème.** Le RGPD s'applique au traitement effectué dans le cadre des
activités d'un responsable de traitement **établi dans l'Union européenne**,
indépendamment du lieu où se trouvent les personnes concernées. Tant que
l'éditeur est établi en France, le RGPD s'applique donc vraisemblablement, en
plus du droit camerounais. S'y ajoutent probablement les obligations françaises
relatives aux éditeurs de services en ligne.

**À faire trancher.**

- Le RGPD s'applique-t-il effectivement dans cette configuration ?
- Quelle autorité de contrôle mentionner dans la politique de confidentialité :
  la CNIL, l'autorité camerounaise de protection des données, ou les deux ?
- Le siège de la future SARL sera-t-il au Cameroun ? Si oui, la situation
  change à l'immatriculation, mais il faut savoir quoi écrire d'ici là.
- Une déclaration ou une formalité est-elle exigée auprès de l'autorité
  camerounaise, et à partir de quel moment ?

**Ce que fait le code en attendant.** La politique de confidentialité est
structurée pour satisfaire les deux cadres (finalité, base légale, durée,
destinataires, transferts). L'identité de l'éditeur vit dans des variables
d'environnement : la corriger ne demandera aucune réécriture.

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
