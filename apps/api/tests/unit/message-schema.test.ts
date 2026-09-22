import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * La promesse faite aux utilisateurs est que le serveur ne peut pas lire leurs
 * messages. Ce test la vérifie sur le schéma lui-même : si quelqu'un ajoute un
 * champ de texte en clair au modèle `Message`, la CI échoue.
 */

const schemaPath = fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url));

/** Noms de champs qui trahiraient du contenu en clair. */
const FORBIDDEN_FIELDS = [
  'content',
  'body',
  'text',
  'plaintext',
  'plainText',
  'message',
  'preview',
  'snippet',
  'subject',
];

const ALLOWED_MESSAGE_FIELDS = new Set([
  'id',
  'conversationId',
  'conversation',
  'senderId',
  'sender',
  'ciphertext',
  'nonce',
  'senderCiphertext',
  'senderNonce',
  'recipientKeyId',
  'senderKeyId',
  'readAt',
  'createdAt',
]);

function messageModel() {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Message');
  if (!model) throw new Error('Modèle Message introuvable dans le schéma Prisma');
  return model;
}

describe('le serveur ne peut pas lire les messages', () => {
  it('le modèle Message ne contient aucun champ de texte en clair', () => {
    const fields = messageModel().fields.map((f) => f.name);
    const offenders = fields.filter((name) =>
      FORBIDDEN_FIELDS.some((forbidden) => name.toLowerCase() === forbidden.toLowerCase()),
    );
    expect(offenders).toEqual([]);
  });

  it('aucun champ inattendu n’a été ajouté au modèle Message', () => {
    const fields = messageModel().fields.map((f) => f.name);
    const unexpected = fields.filter((name) => !ALLOWED_MESSAGE_FIELDS.has(name));
    expect(
      unexpected,
      'Tout nouveau champ sur Message doit être ajouté sciemment à cette liste, ' +
        'après avoir vérifié qu’il ne révèle rien du contenu.',
    ).toEqual([]);
  });

  it('le chiffré et le nonce sont obligatoires', () => {
    const fields = messageModel().fields;
    for (const name of ['ciphertext', 'nonce', 'senderCiphertext', 'senderNonce']) {
      const field = fields.find((f) => f.name === name);
      expect(field, `champ ${name} absent`).toBeDefined();
      expect(field?.isRequired, `${name} devrait être obligatoire`).toBe(true);
    }
  });

  it('le schéma Prisma ne déclare le texte en clair que dans DisclosedMessage', () => {
    const schema = readFileSync(schemaPath, 'utf8');
    const plaintextLines = schema
      .split('\n')
      .map((line, index) => ({ line: line.trim(), index }))
      .filter(({ line }) => /^plaintext\s/i.test(line));

    expect(plaintextLines).toHaveLength(1);

    // Ce champ unique appartient bien au signalement volontaire, où c'est
    // l'utilisateur qui déchiffre et transmet, jamais le serveur.
    const model = Prisma.dmmf.datamodel.models.find((m) =>
      m.fields.some((f) => f.name === 'plaintext'),
    );
    expect(model?.name).toBe('DisclosedMessage');
  });
});
