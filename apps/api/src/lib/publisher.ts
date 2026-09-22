import { env } from '../config/env.js';

/**
 * Identité de l'éditeur et de l'hébergeur, telle qu'elle apparaît dans les
 * mentions légales, les CGU, les CGV et les reçus. Aucune de ces valeurs n'est
 * écrite en dur : elles viennent de l'environnement, et un reçu en conserve
 * une copie figée à la date d'émission.
 */
export interface PublisherIdentity {
  kind: 'INDIVIDUAL' | 'COMPANY';
  name: string;
  legalForm?: string;
  capital?: string;
  rccm?: string;
  niu?: string;
  address: string;
  email: string;
  phone?: string;
  publicationDirector: string;
  privacyEmail: string;
  abuseEmail: string;
  dpoName?: string;
  dpoEmail?: string;
}

export interface HostIdentity {
  name: string;
  address: string;
  country: string;
  website?: string;
}

export function publisherIdentity(): PublisherIdentity {
  const e = env();
  return {
    kind: e.PUBLISHER_KIND,
    name: e.PUBLISHER_NAME,
    legalForm: e.PUBLISHER_LEGAL_FORM,
    capital: e.PUBLISHER_CAPITAL,
    rccm: e.PUBLISHER_RCCM,
    niu: e.PUBLISHER_NIU,
    address: e.PUBLISHER_ADDRESS,
    email: e.PUBLISHER_EMAIL,
    phone: e.PUBLISHER_PHONE,
    publicationDirector: e.PUBLICATION_DIRECTOR,
    privacyEmail: e.PRIVACY_CONTACT_EMAIL,
    abuseEmail: e.ABUSE_CONTACT_EMAIL,
    dpoName: e.DPO_NAME,
    dpoEmail: e.DPO_EMAIL,
  };
}

export function hostIdentity(): HostIdentity {
  const e = env();
  return {
    name: e.HOST_NAME,
    address: e.HOST_ADDRESS,
    country: e.HOST_COUNTRY,
    website: e.HOST_WEBSITE,
  };
}
