import type { Locale } from '@inbox/shared';

/**
 * Modèles d'e-mails transactionnels, en français et en anglais.
 *
 * Deux règles tenues partout : aucun emoji, et aucun contenu de message privé.
 * La notification de nouveau message annonce qu'il y en a un, jamais ce qu'il
 * dit — le serveur ne peut d'ailleurs pas le lire.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

interface Layout {
  title: string;
  intro: string;
  action?: { label: string; url: string };
  body?: string[];
  outro?: string;
}

const STRINGS = {
  fr: {
    greeting: (name: string) => `Bonjour ${name},`,
    fallbackLink: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    signature: 'L’équipe Inbox',
    footer: 'Vous recevez ce message parce que vous avez un compte sur Inbox.',
    preferences: 'Gérer mes notifications',
  },
  en: {
    greeting: (name: string) => `Hello ${name},`,
    fallbackLink: 'If the button does not work, copy this link into your browser:',
    signature: 'The Inbox team',
    footer: 'You are receiving this message because you have an Inbox account.',
    preferences: 'Manage my notifications',
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function render(locale: Locale, name: string, layout: Layout, appUrl: string): RenderedEmail {
  const s = STRINGS[locale];
  const lines = [
    s.greeting(name),
    '',
    layout.intro,
    ...(layout.body?.length ? ['', ...layout.body] : []),
    ...(layout.action ? ['', layout.action.label, layout.action.url] : []),
    ...(layout.outro ? ['', layout.outro] : []),
    '',
    s.signature,
  ];

  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><title>${escapeHtml(layout.title)}</title></head>
<body style="margin:0;padding:24px;background:#F6F6F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#171A1F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E6E8;border-radius:12px;">
    <tr><td style="padding:24px 24px 8px;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#FF6E14;">Inbox</p>
    </td></tr>
    <tr><td style="padding:8px 24px 24px;">
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;">${escapeHtml(layout.title)}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(s.greeting(name))}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(layout.intro)}</p>
      ${(layout.body ?? [])
        .map(
          (p) =>
            `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A5159;">${escapeHtml(p)}</p>`,
        )
        .join('')}
      ${
        layout.action
          ? `<p style="margin:24px 0;">
               <a href="${escapeHtml(layout.action.url)}"
                  style="display:inline-block;background:#FF6E14;color:#FFFFFF;text-decoration:none;
                         padding:12px 20px;border-radius:9999px;font-weight:600;font-size:15px;">
                 ${escapeHtml(layout.action.label)}
               </a>
             </p>
             <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#7C848D;">${escapeHtml(s.fallbackLink)}</p>
             <p style="margin:0 0 16px;font-size:13px;line-height:1.6;word-break:break-all;color:#4A5159;">${escapeHtml(layout.action.url)}</p>`
          : ''
      }
      ${layout.outro ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A5159;">${escapeHtml(layout.outro)}</p>` : ''}
      <p style="margin:24px 0 0;font-size:15px;line-height:1.6;">${escapeHtml(s.signature)}</p>
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #E5E6E8;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#7C848D;">${escapeHtml(s.footer)}</p>
      <p style="margin:8px 0 0;font-size:12px;">
        <a href="${escapeHtml(appUrl)}/parametres/notifications" style="color:#7C848D;">${escapeHtml(s.preferences)}</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: layout.title, text: lines.join('\n'), html };
}

export interface TemplateContext {
  locale: Locale;
  name: string;
  appUrl: string;
}

export function verifyEmailTemplate(ctx: TemplateContext, url: string): RenderedEmail {
  const fr: Layout = {
    title: 'Confirmez votre adresse e-mail',
    intro:
      'Pour publier une annonce ou contacter un vendeur, confirmez d’abord votre adresse e-mail.',
    action: { label: 'Confirmer mon adresse', url },
    body: ['Ce lien est valable 24 heures et ne peut servir qu’une fois.'],
    outro: 'Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message.',
  };
  const en: Layout = {
    title: 'Confirm your email address',
    intro: 'Before posting an ad or contacting a seller, please confirm your email address.',
    action: { label: 'Confirm my address', url },
    body: ['This link is valid for 24 hours and can only be used once.'],
    outro: 'If you did not create this account, you can ignore this message.',
  };
  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}

export function passwordResetTemplate(ctx: TemplateContext, url: string): RenderedEmail {
  const fr: Layout = {
    title: 'Réinitialiser votre mot de passe',
    intro: 'Vous avez demandé à réinitialiser le mot de passe de votre compte Inbox.',
    action: { label: 'Choisir un nouveau mot de passe', url },
    body: ['Ce lien est valable 30 minutes et ne peut servir qu’une fois.'],
    outro:
      'Si vous n’avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable.',
  };
  const en: Layout = {
    title: 'Reset your password',
    intro: 'You asked to reset the password for your Inbox account.',
    action: { label: 'Choose a new password', url },
    body: ['This link is valid for 30 minutes and can only be used once.'],
    outro: 'If you did not ask for this, ignore this message: your current password still works.',
  };
  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}

export function emailChangeTemplate(ctx: TemplateContext, url: string): RenderedEmail {
  const fr: Layout = {
    title: 'Confirmez votre nouvelle adresse e-mail',
    intro: 'Vous avez demandé à remplacer l’adresse e-mail associée à votre compte Inbox.',
    action: { label: 'Confirmer la nouvelle adresse', url },
    body: [
      'Ce lien est valable une heure. Tant qu’il n’est pas utilisé, votre ancienne adresse reste active.',
    ],
  };
  const en: Layout = {
    title: 'Confirm your new email address',
    intro: 'You asked to change the email address linked to your Inbox account.',
    action: { label: 'Confirm the new address', url },
    body: [
      'This link is valid for one hour. Until you use it, your previous address stays active.',
    ],
  };
  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}

export function passwordChangedTemplate(ctx: TemplateContext): RenderedEmail {
  const fr: Layout = {
    title: 'Votre mot de passe a été modifié',
    intro: 'Le mot de passe de votre compte Inbox vient d’être changé.',
    body: ['Toutes vos autres sessions ont été fermées par précaution.'],
    outro:
      'Si vous n’êtes pas à l’origine de ce changement, réinitialisez votre mot de passe immédiatement et écrivez-nous.',
  };
  const en: Layout = {
    title: 'Your password has been changed',
    intro: 'The password for your Inbox account has just been changed.',
    body: ['All your other sessions have been signed out as a precaution.'],
    outro:
      'If you did not make this change, reset your password immediately and get in touch with us.',
  };
  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}

export function paymentConfirmedTemplate(
  ctx: TemplateContext,
  details: { planName: string; amountLabel: string; receiptNumber: string; endsAt: string },
): RenderedEmail {
  const fr: Layout = {
    title: 'Votre abonnement Inbox Pro est actif',
    intro: `Votre paiement a bien été confirmé. Votre abonnement ${details.planName} est actif jusqu'au ${details.endsAt}.`,
    body: [
      `Montant réglé : ${details.amountLabel}`,
      `Numéro de reçu : ${details.receiptNumber}`,
      'Votre reçu est téléchargeable depuis votre espace abonnement.',
    ],
    action: { label: 'Voir mon abonnement', url: `${ctx.appUrl}/compte/abonnement` },
  };
  const en: Layout = {
    title: 'Your Inbox Pro subscription is active',
    intro: `Your payment has been confirmed. Your ${details.planName} subscription is active until ${details.endsAt}.`,
    body: [
      `Amount paid: ${details.amountLabel}`,
      `Receipt number: ${details.receiptNumber}`,
      'Your receipt can be downloaded from your subscription area.',
    ],
    action: { label: 'View my subscription', url: `${ctx.appUrl}/compte/abonnement` },
  };
  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}

export function paymentFailedTemplate(
  ctx: TemplateContext,
  details: { amountLabel: string },
): RenderedEmail {
  const fr: Layout = {
    title: 'Votre paiement n’a pas abouti',
    intro: `Le paiement de ${details.amountLabel} pour votre abonnement Inbox Pro n'a pas pu être confirmé.`,
    body: ['Aucun montant n’a été prélevé. Vous pouvez réessayer quand vous le souhaitez.'],
    action: { label: 'Réessayer', url: `${ctx.appUrl}/pro` },
  };
  const en: Layout = {
    title: 'Your payment did not go through',
    intro: `The ${details.amountLabel} payment for your Inbox Pro subscription could not be confirmed.`,
    body: ['Nothing has been charged. You can try again whenever you like.'],
    action: { label: 'Try again', url: `${ctx.appUrl}/pro` },
  };
  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}

export function renewalNoticeTemplate(
  ctx: TemplateContext,
  details: { amountLabel: string; endsAt: string; cancelled: boolean },
): RenderedEmail {
  const fr: Layout = details.cancelled
    ? {
        title: 'Votre abonnement Pro se termine bientôt',
        intro: `Votre abonnement Inbox Pro prend fin le ${details.endsAt}, comme vous l'avez demandé.`,
        body: [
          'À cette date, votre compte redeviendra un compte particulier : dix annonces par mois, sans badge vérifié.',
        ],
        action: { label: 'Reprendre un abonnement', url: `${ctx.appUrl}/pro` },
      }
    : {
        title: 'Votre abonnement Pro arrive à échéance',
        intro: `Votre abonnement Inbox Pro arrive à échéance le ${details.endsAt}.`,
        body: [
          `Pour continuer sans interruption, renouvelez-le depuis votre espace abonnement (${details.amountLabel}).`,
          'Aucun prélèvement automatique n’est effectué : le renouvellement est à votre initiative.',
        ],
        action: { label: 'Renouveler', url: `${ctx.appUrl}/compte/abonnement` },
      };

  const en: Layout = details.cancelled
    ? {
        title: 'Your Pro subscription ends soon',
        intro: `Your Inbox Pro subscription ends on ${details.endsAt}, as you requested.`,
        body: [
          'On that date your account returns to a personal account: ten ads a month, without the verified badge.',
        ],
        action: { label: 'Subscribe again', url: `${ctx.appUrl}/pro` },
      }
    : {
        title: 'Your Pro subscription is about to expire',
        intro: `Your Inbox Pro subscription expires on ${details.endsAt}.`,
        body: [
          `To continue without interruption, renew it from your subscription area (${details.amountLabel}).`,
          'Nothing is charged automatically: renewing is up to you.',
        ],
        action: { label: 'Renew', url: `${ctx.appUrl}/compte/abonnement` },
      };

  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}

/** Libellés des motifs de refus, tels que l'auteur les reçoit. */
const REJECTION_LABELS: Record<string, Record<Locale, string>> = {
  PROHIBITED_ITEM: {
    fr: 'Produit ou service interdit à la vente',
    en: 'Item or service not allowed for sale',
  },
  COUNTERFEIT: { fr: 'Contrefaçon suspectée', en: 'Suspected counterfeit' },
  MISLEADING_PRICE: { fr: 'Prix trompeur ou incohérent', en: 'Misleading or inconsistent price' },
  WRONG_CATEGORY: { fr: 'Catégorie inadaptée', en: 'Wrong category' },
  POOR_QUALITY_PHOTOS: {
    fr: 'Photos inexploitables ou sans rapport avec l’annonce',
    en: 'Photos unusable or unrelated to the ad',
  },
  DUPLICATE: { fr: 'Annonce en double', en: 'Duplicate ad' },
  CONTACT_IN_DESCRIPTION: {
    fr: 'Coordonnées dans la description',
    en: 'Contact details in the description',
  },
  SUSPECTED_SCAM: { fr: 'Tentative d’arnaque suspectée', en: 'Suspected scam' },
  ADULT_CONTENT: { fr: 'Contenu réservé aux adultes', en: 'Adult content' },
  OTHER: { fr: 'Non conforme aux règles de publication', en: 'Does not meet the posting rules' },
};

export function listingApprovedTemplate(
  ctx: TemplateContext,
  details: { title: string; url: string },
): RenderedEmail {
  const fr: Layout = {
    title: 'Votre annonce est en ligne',
    intro: `Votre annonce « ${details.title} » a été vérifiée et vient d'être publiée.`,
    body: ['Elle restera en ligne 60 jours. Vous pourrez la renouveler avant son échéance.'],
    action: { label: 'Voir mon annonce', url: details.url },
  };
  const en: Layout = {
    title: 'Your ad is online',
    intro: `Your ad "${details.title}" has been checked and is now published.`,
    body: ['It stays online for 60 days. You can renew it before it expires.'],
    action: { label: 'View my ad', url: details.url },
  };
  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}

/**
 * Refus d'annonce. Le motif est toujours présent : un refus qu'on n'explique
 * pas laisse l'auteur sans moyen de corriger, et se traduit par une nouvelle
 * soumission identique.
 */
export function listingRejectedTemplate(
  ctx: TemplateContext,
  details: { title: string; reason: string; note: string | null },
): RenderedEmail {
  const label =
    REJECTION_LABELS[details.reason]?.[ctx.locale] ?? REJECTION_LABELS.OTHER![ctx.locale];

  const fr: Layout = {
    title: 'Votre annonce n’a pas été publiée',
    intro: `Votre annonce « ${details.title} » n'a pas pu être publiée.`,
    body: [
      `Motif : ${label}`,
      ...(details.note ? [`Précision de l'équipe : ${details.note}`] : []),
      'Vous pouvez la corriger et la soumettre à nouveau depuis vos annonces.',
    ],
    action: { label: 'Mes annonces', url: `${ctx.appUrl}/compte/annonces` },
    outro: 'Les règles de publication sont consultables depuis le pied de page du site.',
  };

  const en: Layout = {
    title: 'Your ad was not published',
    intro: `Your ad "${details.title}" could not be published.`,
    body: [
      `Reason: ${label}`,
      ...(details.note ? [`Note from the team: ${details.note}`] : []),
      'You can correct it and submit it again from your ads.',
    ],
    action: { label: 'My ads', url: `${ctx.appUrl}/compte/annonces` },
    outro: 'The posting rules are linked from the footer of the site.',
  };

  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}

export function accountSuspendedTemplate(
  ctx: TemplateContext,
  details: { reason: string; until: string | null },
): RenderedEmail {
  const fr: Layout = {
    title: details.until ? 'Votre compte est suspendu' : 'Votre compte a été banni',
    intro: details.until
      ? `Votre compte Inbox est suspendu jusqu'au ${details.until}.`
      : 'Votre compte Inbox a été banni.',
    body: [`Motif : ${details.reason}`],
    outro: 'Si vous estimez qu’il s’agit d’une erreur, répondez à ce message.',
  };
  const en: Layout = {
    title: details.until ? 'Your account is suspended' : 'Your account has been banned',
    intro: details.until
      ? `Your Inbox account is suspended until ${details.until}.`
      : 'Your Inbox account has been banned.',
    body: [`Reason: ${details.reason}`],
    outro: 'If you believe this is a mistake, reply to this message.',
  };
  return render(ctx.locale, ctx.name, ctx.locale === 'en' ? en : fr, ctx.appUrl);
}
