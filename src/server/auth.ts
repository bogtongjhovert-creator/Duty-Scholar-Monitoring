import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AdminUser } from '../types/index.ts';

// In-memory active session tokens map (Token -> { admin: AdminUser, expiresAt: number })
const activeSessions = new Map<string, { admin: AdminUser; expiresAt: number }>();

// Simple login rate-limiting map (IP -> { attempts: number, lockUntil: number })
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export function createSessionToken(admin: AdminUser): string {
  const token = 'OSC-SESS-' + crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    admin,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function revokeSessionToken(token: string): void {
  activeSessions.delete(token);
}

export function verifySessionToken(token?: string): AdminUser | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session.admin;
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };

  if (Date.now() < record.lockUntil) {
    const waitSeconds = Math.ceil((record.lockUntil - Date.now()) / 1000);
    return { allowed: false, waitSeconds };
  }

  if (Date.now() > record.lockUntil) {
    loginAttempts.delete(ip);
  }
  return { allowed: true };
}

export function recordFailedLogin(ip: string): void {
  const record = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(ip, record);
}

export function resetLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export interface AuthenticatedRequest extends Request {
  adminUser?: AdminUser;
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' });
  }

  const token = authHeader.substring(7);
  const admin = verifySessionToken(token);
  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }

  req.adminUser = admin;
  next();
}
