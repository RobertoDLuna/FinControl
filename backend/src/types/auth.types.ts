export type PlanTier = 'FREE' | 'PRO';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  planTier: PlanTier;
}

export interface PublicUser extends AuthenticatedUser {
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithPasswordRow extends PublicUser {
  passwordHash: string;
}

export interface JwtPayloadData {
  sub: string;
  planTier: PlanTier;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
