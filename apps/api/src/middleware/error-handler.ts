import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(HttpError.notFound('ROUTE_NOT_FOUND', 'Route inconnue'));
};

/**
 * Point de sortie unique des erreurs. La forme de la réponse est toujours
 * `{ error: { code, message, details? } }` : le client n'a qu'un cas à gérer.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const log = req.log ?? console;

  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      (details[key] ??= []).push(issue.message);
    }
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Données invalides', details },
    });
    return;
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) log.error({ err }, 'erreur applicative');
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
    return;
  }

  // Erreur inattendue : rien du détail interne ne sort vers le client.
  log.error({ err }, 'erreur non gérée');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  });
};
