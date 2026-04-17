import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import config from '../config/env.js';
import { authService } from '../services/auth.service.js';
import { authenticate, JwtPayload } from '../middleware/auth.js';

const router = Router();

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${config.frontendUrl}/login?error=oauth_failed` }),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as Request & { user?: JwtPayload };
      const user = authReq.user;
      if (!user) {
        res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
        return;
      }
      const token = await authService.createSession(user.userId, user.email);
      res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${config.frontendUrl}/login?error=server_error`);
    }
  }
);

router.get('/github', passport.authenticate('github', {
  scope: ['user:email'],
  session: false,
}));

router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${config.frontendUrl}/login?error=oauth_failed` }),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as Request & { user?: JwtPayload };
      const user = authReq.user;
      if (!user) {
        res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
        return;
      }
      const token = await authService.createSession(user.userId, user.email);
      res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('GitHub callback error:', error);
      res.redirect(`${config.frontendUrl}/login?error=server_error`);
    }
  }
);

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as Request & { user?: JwtPayload };
    const userPayload = authReq.user;
    if (!userPayload) {
      res.status(401).json({ error: 'Session expired' });
      return;
    }
    const user = await authService.validateSession(
      req.headers.authorization!.split(' ')[1]
    );
    if (!user) {
      res.status(401).json({ error: 'Session expired' });
      return;
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization!.split(' ')[1];
    await authService.deleteSession(token);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;
