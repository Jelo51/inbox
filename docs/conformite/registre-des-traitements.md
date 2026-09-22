# Registre des activités de traitement

Établi au titre de l'**article 30 du règlement (UE) 2016/679 (RGPD)** et de la
**loi n° 2024/017 du 23 décembre 2024** portant protection des données à
caractère personnel au Cameroun.

Ce registre décrit ce que le code fait réellement. Il se met à jour en même
temps que le code, pas après : un registre qui décrit un système disparu ne
protège personne.

Dernière mise à jour : phase 7 (légal et conformité).

---

## Responsable du traitement

L'identité du responsable vit dans les variables d'environnement
(`PUBLISHER_*`) et non dans ce document : elle change le jour de
l'immatriculation de la société, et un registre qui la recopierait deviendrait
faux sans que personne s'en aperçoive. Elle est affichée dans les
[mentions légales](../../apps/api/legal/mentions-legales.fr.md).

À la date de rédaction, l'éditeur est une **personne physique établie en
France**. La société Inbox SARL, dont le siège sera au Cameroun, n'est pas
encore immatriculée.

**Délégué à la protection des données** : aucun n'est désigné à ce jour. Les
variables `DPO_NAME` et `DPO_EMAIL` existent et restent vides ; les lignes
correspondantes disparaissent alors des documents publiés. L'obligation de
désignation fait partie des points soumis à un juriste.

**Contact pour l'exercice des droits** : `PRIVACY_CONTACT_EMAIL`
(`donnees@inbox.cm`).

---

## Principes transversaux

Ces règles valent pour tous les traitements listés ensuite ; elles ne sont donc
pas répétées dans chaque fiche.

- **Aucune adresse IP complète n'est conservée.** `truncateIp()` tronque en /24
  (IPv4) ou /48 (IPv6) avant toute écriture, y compris dans les journaux
  applicatifs.
- **Aucune donnée n'est vendue, louée, ni transmise à des fins publicitaires.**
- **Les mots de passe ne sont jamais stockés**, seulement une empreinte
  argon2id (19 456 Kio, 2 itérations, parallélisme 1).
- **Les polices sont servies localement** (`@fontsource`) : aucune adresse IP
  de visiteur n'est transmise à un tiers au chargement d'une page.
- **Les métadonnées des photographies sont supprimées** avant publication,
  position GPS comprise.
- **Chiffrement en transit** par TLS ; chiffrement de bout en bout pour les
  messages.
- **Durées de conservation appliquées par des tâches planifiées**
  (`apps/api/src/jobs/retention.ts`), pas seulement annoncées.

---

## 1. Gestion des comptes

|                                   |                                                                                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**                      | Créer et gérer un compte, authentifier, sécuriser l'accès, permettre la récupération d'un mot de passe                                                                                                                |
| **Base légale (RGPD)**            | Exécution du contrat — article 6.1.b                                                                                                                                                                                  |
| **Base légale (loi n° 2024/017)** | Exécution du contrat auquel la personne est partie                                                                                                                                                                    |
| **Personnes concernées**          | Membres inscrits                                                                                                                                                                                                      |
| **Données**                       | Adresse électronique, empreinte du mot de passe, nom affiché, langue, ville facultative, biographie facultative, déclaration de majorité, dates d'inscription, de vérification et de dernière connexion, rôle, statut |
| **Destinataires**                 | Équipe d'administration ; Resend pour l'acheminement des courriers                                                                                                                                                    |
| **Transferts**                    | Hébergement en France (hors du Cameroun au sens de la loi n° 2024/017) ; Resend aux États-Unis                                                                                                                        |
| **Conservation**                  | Jusqu'à la suppression du compte. Avertissement après 2 ans sans connexion, anonymisation après 3 ans                                                                                                                 |
| **Sécurité**                      | argon2id, sessions revérifiées en base à chaque requête, révocation immédiate                                                                                                                                         |

## 2. Sessions et jetons

|                          |                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Maintenir une session, détecter le rejeu d'un jeton volé, permettre à un membre de voir ses appareils connectés                                                                              |
| **Base légale (RGPD)**   | Exécution du contrat — article 6.1.b ; intérêt légitime à la sécurité — article 6.1.f                                                                                                        |
| **Personnes concernées** | Membres connectés                                                                                                                                                                            |
| **Données**              | Empreinte SHA-256 du jeton (jamais le jeton), identifiant de chaîne de rotation, agent utilisateur, préfixe d'adresse IP, dates de création, de dernier usage, d'expiration et de révocation |
| **Destinataires**        | Aucun tiers                                                                                                                                                                                  |
| **Conservation**         | Jetons expirés : 30 jours. Sessions révoquées : 90 jours                                                                                                                                     |
| **Sécurité**             | Rotation à chaque usage, révocation de toute la chaîne en cas de rejeu                                                                                                                       |

## 3. Publication et modération des annonces

|                          |                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Publier des annonces, les vérifier avant mise en ligne, écarter les contenus interdits                                                |
| **Base légale (RGPD)**   | Exécution du contrat — article 6.1.b ; obligation légale et intérêt légitime pour la modération — articles 6.1.c et 6.1.f             |
| **Personnes concernées** | Membres vendeurs ; personnes figurant sur les photographies                                                                           |
| **Données**              | Titre, description, prix, état, catégorie, ville, quartier, photographies, statut, motif de refus, score de risque automatique, dates |
| **Destinataires**        | Public, pour les annonces publiées ; modérateurs ; Cloudinary si le stockage distant est activé                                       |
| **Transferts**           | Cloudinary (États-Unis / Union européenne) selon la configuration                                                                     |
| **Conservation**         | Annonce supprimée : 30 jours. Annonce expirée : 180 jours. Suppression du compte : immédiate                                          |
| **Sécurité**             | Métadonnées EXIF et GPS supprimées, type réel lu dans les octets, SVG refusés                                                         |

## 4. Messagerie chiffrée de bout en bout

|                                            |                                                                                                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**                               | Permettre l'échange entre acheteur et vendeur au sujet d'une annonce                                                                                                                                                       |
| **Base légale (RGPD)**                     | Exécution du contrat — article 6.1.b                                                                                                                                                                                       |
| **Personnes concernées**                   | Membres participant à une conversation                                                                                                                                                                                     |
| **Données**                                | Identifiants des participants, annonce d'origine, dates, **contenu chiffré** (`ciphertext`, `nonce`, et la copie destinée à l'expéditeur), clés publiques, empreintes, sauvegarde chiffrée de la clé privée                |
| **Ce que le responsable ne peut pas lire** | Le contenu des messages. Le modèle `Message` ne porte aucun champ de texte en clair, et un test de la chaîne d'intégration fait échouer la construction si quelqu'un en ajoute un                                          |
| **Destinataires**                          | Les deux participants, et eux seuls                                                                                                                                                                                        |
| **Conservation**                           | Jusqu'à la suppression du compte de l'un des participants                                                                                                                                                                  |
| **Sécurité**                               | `nacl.box` (X25519, XSalsa20-Poly1305) ; clé privée en IndexedDB, jamais transmise en clair ; sauvegarde chiffrée par `nacl.secretbox` avec une clé dérivée en argon2id d'une phrase secrète que le serveur ne voit jamais |

## 5. Affichage du numéro de téléphone

|                          |                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Permettre à un acheteur d'appeler un vendeur, tout en gardant le numéro hors des pages publiques                          |
| **Base légale (RGPD)**   | Exécution du contrat — article 6.1.b ; intérêt légitime du vendeur à ne pas voir son numéro moissonné — article 6.1.f     |
| **Personnes concernées** | Vendeurs ; visiteurs demandant l'affichage                                                                                |
| **Données**              | Numéro du vendeur ; identifiant du demandeur s'il est connecté, préfixe d'adresse IP sinon, annonce concernée, horodatage |
| **Destinataires**        | Le demandeur, pour le numéro ; le vendeur, pour le compteur de demandes                                                   |
| **Conservation**         | 180 jours pour la trace de demande                                                                                        |
| **Sécurité**             | Numéro jamais renvoyé dans la fiche d'annonce, limitation de fréquence                                                    |

## 6. Signalements et décisions de modération

|                          |                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Traiter les signalements d'annonces, de membres et de conversations ; décider d'une sanction                                                                                                  |
| **Base légale (RGPD)**   | Obligation légale — article 6.1.c ; intérêt légitime à la sûreté du service — article 6.1.f. Le contenu d'une conversation transmise repose sur le **consentement explicite** — article 6.1.a |
| **Personnes concernées** | Auteur du signalement, personne signalée, participants à la conversation transmise                                                                                                            |
| **Données**              | Motif, commentaire, cible, statut, modérateur ayant traité, note interne, dates. Le cas échéant, **messages déchiffrés par l'utilisateur et transmis volontairement** (`DisclosedMessage`)    |
| **Point d'attention**    | `DisclosedMessage.plaintext` est **le seul texte de conversation lisible de tout le système**. Il n'existe que lorsqu'un utilisateur a explicitement accepté de déchiffrer et de transmettre  |
| **Destinataires**        | Modérateurs et administrateurs                                                                                                                                                                |
| **Conservation**         | 2 ans après clôture, purge en cascade des messages transmis. Effacement immédiat si l'auteur supprime son compte                                                                              |
| **Sécurité**             | Consentement horodaté (`disclosureConsentAt`), accès réservé aux rôles de modération                                                                                                          |

## 7. Journal d'audit des décisions

|                          |                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Rendre les décisions de modération et d'administration vérifiables a posteriori                                                                                                                                                                                                 |
| **Base légale (RGPD)**   | Obligation légale et intérêt légitime — articles 6.1.c et 6.1.f                                                                                                                                                                                                                 |
| **Personnes concernées** | Modérateurs et administrateurs (auteurs) ; membres visés par une décision                                                                                                                                                                                                       |
| **Données**              | Auteur, action, type et identifiant de la cible, motif, détail de la décision, préfixe d'adresse IP, horodatage                                                                                                                                                                 |
| **Destinataires**        | Administrateurs                                                                                                                                                                                                                                                                 |
| **Conservation**         | 5 ans                                                                                                                                                                                                                                                                           |
| **Sécurité**             | **Immuabilité garantie par la base** : un déclencheur PostgreSQL refuse tout `UPDATE` et n'autorise `DELETE` qu'au-delà de la durée de conservation. La seule modification tolérée est le détachement de l'auteur (`actorId` mis à NULL), indispensable au droit à l'effacement |

## 8. Abonnement Pro, paiements et reçus

|                          |                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Vendre l'abonnement professionnel, encaisser, émettre les reçus, tenir la comptabilité                                                                                                                                           |
| **Base légale (RGPD)**   | Exécution du contrat — article 6.1.b ; **obligation légale comptable** — article 6.1.c                                                                                                                                           |
| **Personnes concernées** | Membres abonnés                                                                                                                                                                                                                  |
| **Données**              | Montant, devise, moyen de paiement, référence du fournisseur, statut, dates, numéro de reçu, identité de l'éditeur figée à l'émission                                                                                            |
| **Destinataires**        | Fournisseur de paiement (Maviance Smobilpay, ou un agrégateur couvrant le Cameroun) ; administrateurs                                                                                                                            |
| **Transferts**           | Selon le fournisseur retenu ; aucun compte n'est ouvert à ce jour                                                                                                                                                                |
| **Conservation**         | **10 ans**, indépendamment de la suppression du compte : une pièce comptable ne disparaît pas parce qu'un compte s'en va. Après suppression, le reçu ne porte plus de donnée identifiante, le compte associé ayant été anonymisé |
| **Sécurité**             | Webhooks lus bruts et vérifiés par signature, idempotence portée par une contrainte d'unicité en base                                                                                                                            |

## 9. Preuve d'acceptation des documents légaux

|                          |                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Prouver quelle version des conditions et de la politique de confidentialité a été acceptée, et quand                                                                             |
| **Base légale (RGPD)**   | Obligation légale de démontrer la conformité — articles 6.1.c et 5.2                                                                                                             |
| **Personnes concernées** | Membres inscrits                                                                                                                                                                 |
| **Données**              | Identifiant du membre, document et version acceptés, préfixe d'adresse IP, agent utilisateur, horodatage                                                                         |
| **Destinataires**        | Administrateurs                                                                                                                                                                  |
| **Conservation**         | Durée de la relation contractuelle, puis durée de prescription applicable. Les acceptations antérieures sont conservées : il faut pouvoir prouver ce qui a été accepté, et quand |
| **Sécurité**             | Le serveur refuse une acceptation portant sur une version périmée                                                                                                                |

## 10. Consentement aux traceurs

|                          |                                                                                                                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Recueillir et prouver le consentement à un traceur qui en exigerait un                                                                                                                                                                                                                                   |
| **Base légale (RGPD)**   | Consentement — article 6.1.a                                                                                                                                                                                                                                                                             |
| **Personnes concernées** | Visiteurs, connectés ou non                                                                                                                                                                                                                                                                              |
| **Données**              | Identifiant du membre ou identifiant de visiteur (cookie strictement nécessaire), choix, version de la politique, préfixe d'adresse IP, dates                                                                                                                                                            |
| **État actuel**          | **Aucun traceur soumis à consentement n'est en service.** La mesure d'audience retenue — Umami auto-hébergé — ne pose aucun cookie et ne conserve pas d'identifiant ; la bannière reste donc masquée. Le drapeau `ANALYTICS_REQUIRES_CONSENT` la fait apparaître le jour où un tel traceur serait ajouté |
| **Conservation**         | 3 ans pour la trace ; le consentement lui-même est redemandé au-delà de 6 mois                                                                                                                                                                                                                           |

## 11. Mesure d'audience

|                          |                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Finalité**             | Mesurer la fréquentation du site                                                                                         |
| **Base légale (RGPD)**   | Intérêt légitime — article 6.1.f, la mesure étant strictement nécessaire à la fourniture du service et sans cookie       |
| **Personnes concernées** | Visiteurs                                                                                                                |
| **Données**              | Page consultée, référent, type d'appareil, pays. Aucun cookie, aucun identifiant persistant, aucune adresse IP conservée |
| **Destinataires**        | Aucun tiers : **Umami est auto-hébergé**, sur la même infrastructure                                                     |
| **Conservation**         | Données agrégées ; aucune donnée individuelle identifiante                                                               |

## 12. Courriers électroniques transactionnels

|                          |                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Vérification d'adresse, réinitialisation de mot de passe, décisions de modération, confirmations de paiement, relances d'échéance, avertissement d'inactivité         |
| **Base légale (RGPD)**   | Exécution du contrat — article 6.1.b ; obligation légale d'information pour les décisions de modération — article 6.1.c                                               |
| **Personnes concernées** | Membres inscrits                                                                                                                                                      |
| **Données**              | Adresse électronique, nom affiché, langue, contenu du message                                                                                                         |
| **Destinataires**        | Resend                                                                                                                                                                |
| **Transferts**           | États-Unis                                                                                                                                                            |
| **Conservation**         | Aucune conservation applicative du contenu envoyé ; les jetons à usage unique expirent en 24 heures                                                                   |
| **Point d'attention**    | **Aucun contenu de message privé n'est jamais inclus.** La notification annonce qu'un message existe, jamais ce qu'il dit — le serveur ne peut d'ailleurs pas le lire |

## 13. Favoris et compteurs de consultation

|                          |                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**             | Permettre d'enregistrer des annonces ; afficher un compteur de vues au vendeur                                                   |
| **Base légale (RGPD)**   | Exécution du contrat — article 6.1.b ; intérêt légitime — article 6.1.f                                                          |
| **Personnes concernées** | Membres ; visiteurs                                                                                                              |
| **Données**              | Favoris : identifiant du membre et de l'annonce. Vues : **empreinte non réversible** (session et jour), sans donnée identifiante |
| **Conservation**         | Favoris : jusqu'au retrait ou à la suppression du compte. Vues : 180 jours                                                       |

## 14. Journaux techniques

|                               |                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalité**                  | Diagnostiquer les incidents, détecter les abus                                                                                                    |
| **Base légale (RGPD)**        | Intérêt légitime à la sécurité du service — article 6.1.f                                                                                         |
| **Personnes concernées**      | Visiteurs et membres                                                                                                                              |
| **Données**                   | Méthode, chemin, code de réponse, durée, **préfixe d'adresse IP tronqué**, identifiant de requête                                                 |
| **Champs jamais journalisés** | Mots de passe, jetons, en-têtes d'autorisation, cookies, jeton anti-CSRF — la configuration de `pino` les remplace par une valeur de remplacement |
| **Conservation**              | 1 an                                                                                                                                              |

---

## Droits des personnes et façon dont ils sont exercés

| Droit                                 | Mise en œuvre                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Accès et portabilité                  | Export JSON complet en libre-service, page « Mes données »                       |
| Rectification                         | Modification du profil ; pour l'adresse électronique, confirmation par courrier  |
| Effacement                            | Suppression de compte en libre-service, par anonymisation immédiate              |
| Opposition et retrait du consentement | Retrait d'une annonce, suppression du compte, refus des traceurs quand il y en a |
| Limitation                            | Sur demande à l'adresse de contact                                               |
| Réclamation                           | Auprès de l'autorité de protection des données compétente                        |

**Pourquoi la suppression est une anonymisation et non un effacement de la
ligne.** Le reçu comptable est en `Restrict` sur son paiement : la loi impose
de le conserver dix ans, et supprimer le compte ferait disparaître une pièce
qui doit survivre. Le compte est donc vidé de tout ce qui identifie une
personne — adresse électronique remplacée par une valeur unique et sans
signification, nom, téléphone, biographie, ville, annonces, conversations,
clés, sessions, signalements émis et messages transmis en clair. Ce qui reste
ne se rattache plus à personne.

---

## Points en attente

Voir [`a-verifier-par-un-juriste.md`](a-verifier-par-un-juriste.md). Les
principaux : dénomination exacte de l'autorité camerounaise, formalités
préalables, obligation de désigner un délégué, articulation des deux cadres au
jour de l'immatriculation de la société.
