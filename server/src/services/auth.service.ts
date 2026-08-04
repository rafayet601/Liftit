import { prisma } from '../../prisma/lib.js';
import { generateToken } from '../middleware/auth.js';
import jwt, { Secret } from 'jsonwebtoken';
import config from '../config/env.js';

interface OAuthProfile {
  email: string;
  name?: string;
  picture?: string;
  provider: 'google' | 'github';
  providerId: string;
}

export const authService = {
  async findOrCreateUser(profile: OAuthProfile) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: profile.email },
          { provider: profile.provider, providerId: profile.providerId },
        ],
      },
    });

    if (existingUser) {
      if (!existingUser.image && profile.picture) {
        return prisma.user.update({
          where: { id: existingUser.id },
          data: { image: profile.picture },
        });
      }
      return existingUser;
    }

    const user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        image: profile.picture,
        provider: profile.provider,
        providerId: profile.providerId,
      },
      include: {
        profile: true,
      },
    });

    await prisma.profile.create({
      data: {
        userId: user.id,
      },
    });

    return user;
  },

  async createSession(userId: string, email: string) {
    const token = generateToken({ userId, email });
    return token;
  },

  async validateSession(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret as Secret) as { userId: string; email: string; iat: number };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (!user) return null;
      if (user.tokensInvalidatedAt) {
        const tokenIssuedAt = new Date(decoded.iat * 1000);
        if (tokenIssuedAt <= user.tokensInvalidatedAt) return null;
      }
      return user;
    } catch {
      return null;
    }
  },

  async deleteSession(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret as Secret) as { userId: string; email: string };
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { tokensInvalidatedAt: new Date() },
      });
    } catch {
      // Token already expired or invalid — nothing to revoke
    }
  },

  async deleteAllUserSessions(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { tokensInvalidatedAt: new Date() },
    });
  },
};
