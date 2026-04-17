import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Profile as PassportProfile } from 'passport';
import config from './env.js';
import { authService } from '../services/auth.service.js';

export function setupPassport() {
  if (config.google.clientId && config.google.clientSecret) {
    passport.use(new GoogleStrategy({
      clientID: config.google.clientId,
      clientSecret: config.google.clientSecret,
      callbackURL: config.google.callbackUrl,
    }, async (accessToken: string, refreshToken: string, profile: PassportProfile, done: (err: Error | null, user?: { userId: string; email: string }) => void) => {
      try {
        const user = await authService.findOrCreateUser({
          email: profile.emails![0].value,
          name: profile.displayName,
          picture: profile.photos?.[0]?.value,
          provider: 'google',
          providerId: profile.id,
        });
        done(null, { userId: user.id, email: user.email });
      } catch (error) {
        done(error as Error);
      }
    }));
  }

  if (config.github.clientId && config.github.clientSecret) {
    passport.use(new GitHubStrategy({
      clientID: config.github.clientId,
      clientSecret: config.github.clientSecret,
      callbackURL: config.github.callbackUrl,
      scope: ['user:email'],
    }, async (accessToken: string, refreshToken: string, profile: passport.Profile, done: (err: Error | null, user?: { userId: string; email: string }) => void) => {
      try {
        const email = (profile.emails && profile.emails[0]?.value) || 
                      `${profile.username}@github.local`;
        const user = await authService.findOrCreateUser({
          email,
          name: profile.displayName || profile.username,
          picture: profile.photos?.[0]?.value,
          provider: 'github',
          providerId: profile.id,
        });
        done(null, { userId: user.id, email: user.email });
      } catch (error) {
        done(error as Error);
      }
    }));
  }

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: Express.User, done) => {
    done(null, user);
  });
}
