import type { ListingCondition, PriceUnit } from '@inbox/shared';

export interface ListingSeed {
  title: string;
  description: string;
  price: number;
  priceUnit?: PriceUnit;
  category: string;
  city: string;
  neighbourhood: string;
  condition: ListingCondition;
  /** `pro` pour le compte professionnel, `user` pour le compte particulier. */
  owner: 'user' | 'pro';
  images: number;
}

/**
 * Annonces de démonstration. Prix et quartiers choisis pour rester plausibles
 * au Cameroun : ce jeu sert aussi à juger la mise en page réelle.
 */
export const DEMO_LISTINGS: ListingSeed[] = [
  {
    title: 'iPhone 13 Pro 128 Go, très bon état',
    description:
      "iPhone 13 Pro 128 Go couleur graphite, acheté en décembre. Batterie à 91 %, aucune rayure sur l'écran, léger éclat sur le coin inférieur droit visible sur la quatrième photo. Livré avec câble et coque. Facture d'achat disponible. Essai possible à Akwa.",
    price: 385000,
    category: 'telephones',
    city: 'douala',
    neighbourhood: 'Akwa',
    condition: 'LIKE_NEW',
    owner: 'user',
    images: 4,
  },
  {
    title: 'Samsung Galaxy A54 5G neuf sous blister',
    description:
      "Galaxy A54 5G 256 Go, neuf, jamais ouvert, garantie constructeur 12 mois. Trois coloris disponibles en boutique. Facture remise à l'achat. Possibilité de livraison dans Douala.",
    price: 215000,
    category: 'telephones',
    city: 'douala',
    neighbourhood: 'Bonanjo',
    condition: 'NEW',
    owner: 'pro',
    images: 3,
  },
  {
    title: 'Tecno Camon 20 Pro, 8 Go / 256 Go',
    description:
      "Tecno Camon 20 Pro en excellent état, utilisé six mois. Écran impeccable, batterie qui tient la journée. Vendu avec chargeur d'origine et deux coques. Je réponds rapidement aux messages.",
    price: 98000,
    category: 'telephones',
    city: 'yaounde',
    neighbourhood: 'Bastos',
    condition: 'GOOD',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Infinix Hot 30i, écran à changer',
    description:
      "Infinix Hot 30i fonctionnel mais écran fissuré en haut à gauche, tactile encore opérationnel. Vendu en l'état, idéal pour pièces ou pour une réparation. Prix ferme.",
    price: 22000,
    category: 'telephones',
    city: 'bafoussam',
    neighbourhood: 'Marché A',
    condition: 'FOR_PARTS',
    owner: 'user',
    images: 2,
  },
  {
    title: 'MacBook Air M1 8 Go / 256 Go',
    description:
      "MacBook Air M1 2020, 8 Go de mémoire et 256 Go de stockage. 220 cycles de batterie. Clavier AZERTY. Aucun choc, coque protégée depuis l'achat. Chargeur d'origine inclus. Démonstration possible avant achat.",
    price: 420000,
    category: 'electronique',
    city: 'douala',
    neighbourhood: 'Bonapriso',
    condition: 'GOOD',
    owner: 'pro',
    images: 5,
  },
  {
    title: 'Téléviseur LED 43 pouces Hisense',
    description:
      "Téléviseur Hisense 43 pouces Full HD, deux ans d'usage, image nette, télécommande d'origine. Support mural non inclus. À récupérer sur place à Bonamoussadi.",
    price: 115000,
    category: 'electronique',
    city: 'douala',
    neighbourhood: 'Bonamoussadi',
    condition: 'GOOD',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Groupe électrogène 3 kVA, démarrage manuel',
    description:
      "Groupe électrogène essence 3 kVA, révisé le mois dernier, bougie et filtre neufs. Autonomie d'environ six heures. Idéal pour boutique ou domicile pendant les coupures.",
    price: 185000,
    category: 'electronique',
    city: 'yaounde',
    neighbourhood: 'Mvog-Mbi',
    condition: 'GOOD',
    owner: 'pro',
    images: 4,
  },
  {
    title: 'Kit panneaux solaires 500 W avec batterie',
    description:
      "Kit complet : deux panneaux de 250 W, régulateur 30 A, batterie 150 Ah et onduleur 1000 W. Installation possible moyennant supplément. Garantie six mois sur l'onduleur.",
    price: 560000,
    category: 'electronique',
    city: 'garoua',
    neighbourhood: 'Poumpoumre',
    condition: 'NEW',
    owner: 'pro',
    images: 4,
  },
  {
    title: 'Imprimante HP LaserJet Pro M404dn',
    description:
      "Imprimante laser monochrome réseau, recto-verso automatique. Environ 12 000 pages au compteur. Toner à moitié plein fourni. Testée devant l'acheteur.",
    price: 145000,
    category: 'electronique',
    city: 'douala',
    neighbourhood: 'Deido',
    condition: 'GOOD',
    owner: 'pro',
    images: 2,
  },
  {
    title: 'Toyota Corolla 2012, essence, boîte automatique',
    description:
      "Toyota Corolla de 2012, 168 000 km, boîte automatique, climatisation fonctionnelle, pneus refaits l'an dernier. Entretien suivi chez un mécanicien à Bonabéri, carnet disponible. Papiers à jour. Visite possible en semaine.",
    price: 6800000,
    category: 'vehicules',
    city: 'douala',
    neighbourhood: 'Bonabéri',
    condition: 'GOOD',
    owner: 'user',
    images: 6,
  },
  {
    title: 'Toyota Hilux double cabine 2016',
    description:
      'Hilux double cabine diesel, 2016, 4x4 enclenchable, 142 000 km. Entretien complet effectué. Idéal pour chantier ou déplacement en province. Dédouanement en règle.',
    price: 14500000,
    category: 'vehicules',
    city: 'yaounde',
    neighbourhood: 'Nsam',
    condition: 'GOOD',
    owner: 'pro',
    images: 6,
  },
  {
    title: 'Moto Sanili 150 cm3, bon état',
    description:
      'Moto Sanili 150 cm3 achetée il y a deux ans, révision récente, chaîne et plaquettes neuves. Deux casques offerts. Vendue avec la carte grise au nom du vendeur.',
    price: 420000,
    category: 'vehicules',
    city: 'bamenda',
    neighbourhood: 'Commercial Avenue',
    condition: 'GOOD',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Location véhicule avec chauffeur, Douala',
    description:
      "Mise à disposition d'une berline climatisée avec chauffeur pour déplacements professionnels dans Douala et environs. Carburant inclus dans la limite de 80 km par jour. Tarif dégressif au-delà de cinq jours.",
    price: 35000,
    priceUnit: 'PER_DAY',
    category: 'vehicules',
    city: 'douala',
    neighbourhood: 'Akwa',
    condition: 'NOT_APPLICABLE',
    owner: 'pro',
    images: 3,
  },
  {
    title: 'Appartement meublé 2 chambres à Bonapriso',
    description:
      'Appartement meublé de deux chambres au deuxième étage, salon spacieux, cuisine équipée, eau et électricité à la charge du locataire. Résidence sécurisée avec gardien. Caution de deux mois demandée. Disponible immédiatement.',
    price: 350000,
    priceUnit: 'PER_MONTH',
    category: 'immobilier',
    city: 'douala',
    neighbourhood: 'Bonapriso',
    condition: 'NOT_APPLICABLE',
    owner: 'pro',
    images: 6,
  },
  {
    title: 'Studio non meublé à Melen, proche université',
    description:
      "Studio de 25 m² avec douche interne, compteur d'électricité individuel, à dix minutes à pied de l'université. Quartier calme. Caution de deux mois plus un mois d'avance.",
    price: 45000,
    priceUnit: 'PER_MONTH',
    category: 'immobilier',
    city: 'yaounde',
    neighbourhood: 'Melen',
    condition: 'NOT_APPLICABLE',
    owner: 'user',
    images: 4,
  },
  {
    title: 'Terrain titré 500 m² à Buea',
    description:
      'Terrain de 500 m² entièrement titré, bornes posées, accès par route praticable en toute saison. Vue dégagée sur la plaine. Titre foncier consultable chez le notaire avant toute transaction.',
    price: 12000000,
    category: 'immobilier',
    city: 'buea',
    neighbourhood: 'Molyko',
    condition: 'NOT_APPLICABLE',
    owner: 'user',
    images: 4,
  },
  {
    title: 'Maison de 4 chambres à Bafoussam',
    description:
      "Maison individuelle de quatre chambres sur un terrain clôturé de 400 m², salon, salle à manger, deux douches, cuisine intérieure, forage et château d'eau. Quartier résidentiel calme.",
    price: 28000000,
    category: 'immobilier',
    city: 'bafoussam',
    neighbourhood: 'Tamdja',
    condition: 'NOT_APPLICABLE',
    owner: 'pro',
    images: 6,
  },
  {
    title: 'Chambre en colocation à Limbé, bord de mer',
    description:
      'Chambre meublée dans une maison partagée à dix minutes de la plage. Cuisine et salon communs, internet inclus. Convient à un étudiant ou à un jeune actif. Non-fumeur de préférence.',
    price: 60000,
    priceUnit: 'PER_MONTH',
    category: 'immobilier',
    city: 'limbe',
    neighbourhood: 'Down Beach',
    condition: 'NOT_APPLICABLE',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Robe en tissu pagne, taille 40, sur mesure',
    description:
      'Robe confectionnée en tissu pagne de qualité, coupe ajustée, taille 40. Réalisation sur mesure possible sous cinq jours ouvrés dans la taille de votre choix. Retouches offertes.',
    price: 28000,
    category: 'mode',
    city: 'douala',
    neighbourhood: 'New Bell',
    condition: 'NEW',
    owner: 'pro',
    images: 4,
  },
  {
    title: 'Chaussures de ville en cuir, pointure 43',
    description:
      "Chaussures de ville en cuir véritable, pointure 43, portées trois fois. Semelle intacte, cuir souple. Boîte d'origine conservée.",
    price: 25000,
    category: 'mode',
    city: 'yaounde',
    neighbourhood: 'Nlongkak',
    condition: 'LIKE_NEW',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Lot de 10 tissus pagne wax, vente en gros',
    description:
      'Lot de dix pagnes wax six yards, motifs variés, qualité hollandaise. Vente en gros uniquement, lot non divisible. Remise supplémentaire à partir de trois lots.',
    price: 145000,
    category: 'mode',
    city: 'douala',
    neighbourhood: 'Marché Congo',
    condition: 'NEW',
    owner: 'pro',
    images: 3,
  },
  {
    title: 'Sac à main en cuir, artisanat local',
    description:
      'Sac à main confectionné à la main en cuir de chèvre tanné localement. Doublure en coton, deux poches intérieures, bandoulière amovible. Pièce unique.',
    price: 32000,
    category: 'mode',
    city: 'ngaoundere',
    neighbourhood: 'Baladji',
    condition: 'NEW',
    owner: 'pro',
    images: 3,
  },
  {
    title: 'Salon six places en bois massif',
    description:
      'Salon six places, structure en bois massif et coussins en tissu épais. Acheté il y a trois ans, tissu propre, aucune déchirure. Démontable pour le transport. À enlever sur place.',
    price: 280000,
    category: 'maison',
    city: 'yaounde',
    neighbourhood: 'Emana',
    condition: 'GOOD',
    owner: 'user',
    images: 5,
  },
  {
    title: 'Réfrigérateur combiné 300 litres',
    description:
      'Réfrigérateur combiné deux portes, 300 litres, classe A+. Fonctionne parfaitement, joints en bon état. Vendu pour cause de déménagement.',
    price: 165000,
    category: 'maison',
    city: 'douala',
    neighbourhood: 'Logpom',
    condition: 'GOOD',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Matelas orthopédique 160 x 200, neuf',
    description:
      'Matelas orthopédique 160 x 200 cm, épaisseur 25 cm, mousse haute densité. Neuf, encore emballé. Livraison possible dans Yaoundé moyennant supplément.',
    price: 135000,
    category: 'maison',
    city: 'yaounde',
    neighbourhood: 'Mvan',
    condition: 'NEW',
    owner: 'pro',
    images: 2,
  },
  {
    title: 'Cuisinière à gaz quatre feux avec four',
    description:
      "Cuisinière à gaz quatre feux avec four intégré, allumage électronique. Deux ans d'usage, entretenue régulièrement. Bouteille non incluse.",
    price: 95000,
    category: 'maison',
    city: 'bertoua',
    neighbourhood: 'Nkolbikon',
    condition: 'GOOD',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Table à manger six places en bois',
    description:
      "Table à manger en bois avec six chaises assorties, vernis refait l'année dernière. Quelques traces d'usage sur le plateau, sans impact sur la solidité.",
    price: 175000,
    category: 'maison',
    city: 'ebolowa',
    neighbourhood: 'Angalé',
    condition: 'GOOD',
    owner: 'user',
    images: 4,
  },
  {
    title: 'Développeur web freelance, sites vitrines',
    description:
      'Création de sites vitrines et boutiques en ligne pour commerçants et associations. Livraison en deux à quatre semaines selon le projet, formation à la prise en main incluse. Devis gratuit après un premier échange.',
    price: 250000,
    category: 'emploi-services',
    city: 'douala',
    neighbourhood: 'Bonanjo',
    condition: 'NOT_APPLICABLE',
    owner: 'pro',
    images: 2,
  },
  {
    title: 'Cours particuliers de mathématiques, lycée',
    description:
      "Professeur de mathématiques propose des cours particuliers du second cycle au baccalauréat. Séances d'une heure et demie au domicile de l'élève dans Yaoundé. Suivi régulier et bilan mensuel aux parents.",
    price: 5000,
    priceUnit: 'PER_SESSION',
    category: 'emploi-services',
    city: 'yaounde',
    neighbourhood: 'Essos',
    condition: 'NOT_APPLICABLE',
    owner: 'user',
    images: 1,
  },
  {
    title: 'Plombier expérimenté, interventions rapides',
    description:
      'Plombier avec douze ans de métier : installation sanitaire, recherche de fuite, débouchage, pose de chauffe-eau. Intervention dans Douala sous 24 heures. Devis avant travaux.',
    price: 10000,
    priceUnit: 'PER_HOUR',
    category: 'emploi-services',
    city: 'douala',
    neighbourhood: 'Ndokoti',
    condition: 'NOT_APPLICABLE',
    owner: 'pro',
    images: 2,
  },
  {
    title: 'Recherche serveuse pour restaurant à Kribi',
    description:
      "Restaurant en bord de mer recherche une serveuse à temps plein, expérience d'un an minimum en salle. Horaires en coupure, un jour de repos par semaine. Rémunération mensuelle, logement non fourni.",
    price: 85000,
    priceUnit: 'PER_MONTH',
    category: 'emploi-services',
    city: 'kribi',
    neighbourhood: 'Mboa-Manga',
    condition: 'NOT_APPLICABLE',
    owner: 'pro',
    images: 1,
  },
  {
    title: 'Traduction français-anglais, documents officiels',
    description:
      "Traductrice diplômée propose la traduction de documents administratifs, universitaires et commerciaux entre le français et l'anglais. Délai habituel de 48 heures. Tarif indiqué par page.",
    price: 3500,
    category: 'emploi-services',
    city: 'bamenda',
    neighbourhood: 'Up Station',
    condition: 'NOT_APPLICABLE',
    owner: 'pro',
    images: 1,
  },
  {
    title: 'Guitare acoustique avec housse',
    description:
      'Guitare acoustique format dreadnought, cordes changées le mois dernier, manche droit. Housse rembourrée et jeu de cordes de rechange inclus. Convient à un débutant sérieux.',
    price: 55000,
    category: 'loisirs',
    city: 'yaounde',
    neighbourhood: 'Mokolo',
    condition: 'GOOD',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Vélo tout terrain 26 pouces, 21 vitesses',
    description:
      'VTT 26 pouces, 21 vitesses, freins à disque avant. Pneus et chaîne remplacés récemment. Quelques rayures sur le cadre, mécanique saine.',
    price: 68000,
    category: 'loisirs',
    city: 'douala',
    neighbourhood: 'Makepe',
    condition: 'GOOD',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Console PlayStation 4 Slim avec deux manettes',
    description:
      "PS4 Slim 1 To en bon état de marche, deux manettes officielles dont une avec le grip légèrement usé. Trois jeux inclus. Câbles d'origine fournis.",
    price: 155000,
    category: 'loisirs',
    city: 'douala',
    neighbourhood: 'Bali',
    condition: 'GOOD',
    owner: 'user',
    images: 4,
  },
  {
    title: 'Tente de camping quatre places',
    description:
      'Tente quatre places avec double toit et tapis de sol, utilisée deux fois. Montage en dix minutes, sardines et piquets complets. Sac de transport inclus.',
    price: 42000,
    category: 'loisirs',
    city: 'buea',
    neighbourhood: 'Bokwaongo',
    condition: 'LIKE_NEW',
    owner: 'user',
    images: 3,
  },
  {
    title: 'Ballon de football officiel taille 5',
    description:
      'Ballon de football taille 5 cousu main, utilisé pour quelques entraînements seulement. Pression et rebond corrects. Pompe non incluse.',
    price: 12000,
    category: 'loisirs',
    city: 'maroua',
    neighbourhood: 'Domayo',
    condition: 'GOOD',
    owner: 'user',
    images: 2,
  },
  {
    title: 'Appareil photo reflex Canon EOS 250D',
    description:
      'Reflex Canon EOS 250D avec objectif 18-55 mm, environ 8 000 déclenchements. Deux batteries, carte mémoire 32 Go et sacoche inclus. Capteur propre.',
    price: 320000,
    category: 'electronique',
    city: 'kribi',
    neighbourhood: 'Centre-ville',
    condition: 'GOOD',
    owner: 'pro',
    images: 5,
  },
  {
    title: 'Machine à coudre industrielle, révisée',
    description:
      'Machine à coudre industrielle piqueuse plate, moteur révisé, pédale et table incluses. Convient à un atelier de couture. Démonstration possible sur place.',
    price: 245000,
    category: 'maison',
    city: 'bafoussam',
    neighbourhood: 'Kouékong',
    condition: 'GOOD',
    owner: 'pro',
    images: 4,
  },
  {
    title: 'Casque audio sans fil à réduction de bruit',
    description:
      "Casque circum-aural sans fil avec réduction de bruit active, autonomie d'environ trente heures. Coussinets en bon état, étui rigide fourni.",
    price: 78000,
    category: 'electronique',
    city: 'yaounde',
    neighbourhood: 'Bastos',
    condition: 'LIKE_NEW',
    owner: 'user',
    images: 3,
  },
];

/**
 * Annonces laissées en attente de modération, dont deux manifestement
 * frauduleuses : elles servent à vérifier que le repérage automatique les
 * remonte en tête de file sans pour autant décider à la place d'un humain.
 */
export const PENDING_LISTINGS: (ListingSeed & { fraudulent: boolean })[] = [
  {
    title: 'Ordinateur portable Dell Latitude 7490',
    description:
      "Dell Latitude 7490, processeur i5 de huitième génération, 16 Go de mémoire, disque SSD de 512 Go. Batterie tenant environ quatre heures. Chargeur d'origine fourni.",
    price: 275000,
    category: 'electronique',
    city: 'douala',
    neighbourhood: 'Akwa',
    condition: 'GOOD',
    owner: 'user',
    images: 3,
    fraudulent: false,
  },
  {
    title: 'Climatiseur split 12000 BTU, installation incluse',
    description:
      'Climatiseur split 12000 BTU neuf avec installation comprise dans Yaoundé. Garantie de douze mois sur le compresseur. Devis sur mesure pour plusieurs pièces.',
    price: 235000,
    category: 'maison',
    city: 'yaounde',
    neighbourhood: 'Biyem-Assi',
    condition: 'NEW',
    owner: 'pro',
    images: 3,
    fraudulent: false,
  },
  {
    title: 'Placement sûr : votre argent doublé en 15 jours',
    description:
      "Opportunité exceptionnelle et 100 % garantie. Vous versez un acompte par Mobile Money et vous recevez le double sous quinze jours, sans aucun risque. Places limitées, réservez la vôtre dès aujourd'hui. Aucun justificatif demandé, transfert immédiat.",
    price: 50000,
    category: 'emploi-services',
    city: 'douala',
    neighbourhood: 'Akwa',
    condition: 'NOT_APPLICABLE',
    owner: 'user',
    images: 1,
    fraudulent: true,
  },
  {
    title: 'iPhone 15 Pro Max neuf — 60 000 FCFA, envoi immédiat',
    description:
      "Lot d'iPhone 15 Pro Max neufs venant de l'étranger, prix imbattable car dédouanement non effectué. Paiement d'un acompte obligatoire par transfert avant l'envoi. Pas de rencontre possible, pas de test avant paiement. Je ne réponds pas aux appels.",
    price: 60000,
    category: 'telephones',
    city: 'yaounde',
    neighbourhood: 'Mvog-Ada',
    condition: 'NEW',
    owner: 'user',
    images: 1,
    fraudulent: true,
  },
];
