import type { UserRole } from '@inbox/shared';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
        emailVerified: boolean;
      };
    }
  }
}

export {};
