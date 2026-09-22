/**
 * Erreur applicative portant un statut HTTP et un code stable.
 * Le code est destiné au client (traduction des messages côté interface) ;
 * le message est un repli lisible en français.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(code: string, message: string, details?: Record<string, string[]>) {
    return new HttpError(400, code, message, details);
  }

  static unauthorized(code = 'UNAUTHENTICATED', message = 'Authentification requise') {
    return new HttpError(401, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'Action non autorisée') {
    return new HttpError(403, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Ressource introuvable') {
    return new HttpError(404, code, message);
  }

  static conflict(code: string, message: string) {
    return new HttpError(409, code, message);
  }

  static tooManyRequests(message = 'Trop de requêtes, réessayez plus tard') {
    return new HttpError(429, 'RATE_LIMITED', message);
  }
}
