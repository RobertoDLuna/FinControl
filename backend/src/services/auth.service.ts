import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { usersRepository } from '../repositories/users.repository.js';
import { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import { AuthenticatedUser, PublicUser } from '../types/auth.types.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/errors.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

export interface AuthSessionResult {
  user: AuthenticatedUser;
  accessToken: string;
}

// Hash fictício para equalizar o tempo de verificação quando o e-mail não existe (anti-enumeração)
const DUMMY_PASSWORD_HASH =
  'scrypt$16384$8$1$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

function toAuthenticatedUser(user: PublicUser): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    planTier: user.planTier,
  };
}

function signAccessToken(user: AuthenticatedUser): string {
  return jwt.sign({ planTier: user.planTier }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export const authService = {
  /**
   * Registra um novo usuário com senha derivada via scrypt e categorias iniciais padrão.
   */
  async register(input: RegisterInput): Promise<AuthSessionResult> {
    const emailInUse = await usersRepository.existsByEmail(input.email);
    if (emailInUse) {
      throw new ConflictError('Este e-mail já está cadastrado.');
    }

    const passwordHash = await hashPassword(input.password);
    const createdUser = await usersRepository.createWithDefaultCategories({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    const user = toAuthenticatedUser(createdUser);
    const accessToken = signAccessToken(user);

    return { user, accessToken };
  },

  /**
   * Autentica um usuário existente com proteção contra enumeração de e-mail e timing attack.
   */
  async login(input: LoginInput): Promise<AuthSessionResult> {
    const foundUser = await usersRepository.findAuthByEmail(input.email);

    if (!foundUser) {
      await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedError('E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await verifyPassword(input.password, foundUser.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');
    }

    if (!foundUser.isActive) {
      throw new ForbiddenError('Conta desativada. Entre em contato com o suporte.', 'ACCOUNT_INACTIVE');
    }

    const user = toAuthenticatedUser(foundUser);
    const accessToken = signAccessToken(user);

    return { user, accessToken };
  },

  /**
   * Retorna os dados públicos do usuário autenticado.
   */
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await usersRepository.findPublicById(userId);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    return user;
  },
};
