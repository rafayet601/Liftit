import { Request, Response, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  const match = req.headers.cookie?.match(/(?:^|;\s*)token=([^;]*)/);
  return match ? match[1] : null;
};

export const authenticate = (req: Request, res: Response, next: Function): void => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = (req: Request, res: Response, next: Function): void => {
  const token = extractToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      (req as AuthenticatedRequest).user = decoded;
    } catch {
      // Token invalid, but continue without user
    }
  }
  next();
};

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
};
