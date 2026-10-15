import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbManager } from './src/server/db.ts';
import {
  createSessionToken,
  revokeSessionToken,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  requireAdminAuth,
  type AuthenticatedRequest,
} from './src/server/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // -------------------------------------------------------------
  // REAL-TIME SYNCHRONIZATION VIA SERVER-SENT EVENTS (SSE)
  // -------------------------------------------------------------
  const sseClients = new Set<Response>();

  // Broadcast to all active browsers and devices whenever data changes
  dbManager.on('change', (payload: any) => {
    const sseMessage = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(sseMessage);
      } catch (err) {
        sseClients.delete(client);
      }
    }
  });

  // Heartbeat to keep connection alive through proxies
  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(': keepalive\n\n');
      } catch (err) {
        sseClients.delete(client);
      }
    }
  }, 15000);

  app.get('/api/realtime/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // -------------------------------------------------------------
  // PUBLIC SCANNER ENDPOINTS (Zero administrative exposure)
  // -------------------------------------------------------------

  app.get('/api/public/config', (_req: Request, res: Response) => {
    const settings = dbManager.getSettings();
    res.json({
      allowManualIdEntry: settings.allowManualIdEntry,
      academicYear: settings.academicYear,
      cooldownSeconds: settings.cooldownSeconds,
    });
  });

  app.post('/api/attendance/scan', (req: Request, res: Response) => {
    try {
      const { qrToken, scholarIdInput, recordingMethod } = req.body;
      if (!qrToken && !scholarIdInput) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid QR code or Scholar ID number.',
        });
      }

      const result = dbManager.processAttendanceScan({
        qrToken,
        scholarIdInput,
        recordingMethod: recordingMethod || 'QR_SCAN',
      });

      return res.json(result);
    } catch (err: any) {
      console.error('Error processing attendance scan:', err);
      return res.status(500).json({
        success: false,
        message: 'Server error processing attendance. Please try again.',
      });
    }
  });

  // -------------------------------------------------------------
  // ADMIN AUTHENTICATION
  // -------------------------------------------------------------

  app.post('/api/admin/login', (req: Request, res: Response) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const rateCheck = checkLoginRateLimit(ip);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: `Too many failed login attempts. Please wait ${rateCheck.waitSeconds} seconds.`,
        });
      }

      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const admin = dbManager.authenticateAdmin(email, password);
      if (!admin) {
        recordFailedLogin(ip);
        return res.status(401).json({ error: 'Invalid administrator credentials. Please check your email and password.' });
      }

      resetLoginAttempts(ip);
      const token = createSessionToken(admin);
      return res.json({
        token,
        user: admin,
      });
    } catch (err: any) {
      console.error('Error during admin login:', err);
      return res.status(500).json({ error: 'Server authentication error. Please try again.' });
    }
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      revokeSessionToken(authHeader.substring(7));
    }
    res.json({ success: true });
  });

  app.get('/api/admin/me', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.adminUser });
  });

  // -------------------------------------------------------------
  // ADMIN DASHBOARD & STATS
  // -------------------------------------------------------------

  app.get('/api/admin/dashboard-stats', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const dateFilter = (req.query.date as string) || undefined;
      const stats = dbManager.getDashboardStats(dateFilter);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve dashboard stats' });
    }
  });

  // -------------------------------------------------------------
  // ADMIN SCHOLARS MANAGEMENT
  // -------------------------------------------------------------

  app.get('/api/admin/scholars', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const search = req.query.search as string | undefined;
    const department = req.query.department as string | undefined;
    const status = req.query.status as string | undefined;
    const scholars = dbManager.getScholars(search, department, status);
    res.json(scholars);
  });

  app.get('/api/admin/scholars/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const scholar = dbManager.getScholarById(req.params.id);
    if (!scholar) return res.status(404).json({ error: 'Scholar not found' });
    res.json(scholar);
  });

  app.post('/api/admin/scholars', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const created = dbManager.createScholar(req.body, req.adminUser!);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create scholar' });
    }
  });

  app.put('/api/admin/scholars/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = dbManager.updateScholar(req.params.id, req.body, req.adminUser!);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update scholar' });
    }
  });

  app.delete('/api/admin/scholars/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const removed = dbManager.deleteScholar(req.params.id, req.adminUser!);
      res.json({ success: true, removed });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete scholar' });
    }
  });

  app.post('/api/admin/scholars/:id/regenerate-qr', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reason } = req.body;
      const updated = dbManager.revokeAndRegenerateQR(
        req.params.id,
        reason || 'Administrative QR code reset',
        req.adminUser!
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to regenerate QR code' });
    }
  });

  // -------------------------------------------------------------
  // ADMIN ATTENDANCE MANAGEMENT
  // -------------------------------------------------------------

  app.get('/api/admin/attendance', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const records = dbManager.getAttendanceRecords({
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        department: req.query.department as string,
        status: req.query.status as string,
        search: req.query.search as string,
        scholarId: req.query.scholarId as string,
      });
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve attendance records' });
    }
  });

  app.post('/api/admin/attendance/manual', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { scholarId, sessionDate, timeIn, timeOut, reason, remarks } = req.body;
      if (!scholarId || !sessionDate || !timeIn || !reason) {
        return res.status(400).json({ error: 'Scholar, date, time-in, and audit reason are required.' });
      }

      const record = dbManager.manualAttendanceEntry(
        { scholarId, sessionDate, timeIn, timeOut, reason, remarks },
        req.adminUser!
      );
      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to add manual attendance' });
    }
  });

  app.put('/api/admin/attendance/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { timeIn, timeOut, status, remarks, reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: 'A justification reason is required for administrative corrections.' });
      }

      const updated = dbManager.correctAttendanceRecord(
        req.params.id,
        { timeIn, timeOut, status, remarks, reason },
        req.adminUser!
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to correct attendance record' });
    }
  });

  app.delete('/api/admin/attendance/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const reason = (req.body?.reason || req.query?.reason || 'Administrative removal') as string;
      const removed = dbManager.deleteAttendanceRecord(req.params.id, req.adminUser!, reason);
      res.json({ success: true, removed });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete attendance record' });
    }
  });

  // -------------------------------------------------------------
  // REPORTS, SETTINGS & AUDIT LOGS
  // -------------------------------------------------------------

  app.get('/api/admin/reports', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
    try {
      const analytics = dbManager.getAnalytics();
      res.json(analytics);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to compile reports' });
    }
  });

  app.get('/api/admin/audit-logs', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const search = req.query.search as string | undefined;
    const logs = dbManager.getAuditLogs(search);
    res.json(logs);
  });

  app.get('/api/admin/settings', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
    res.json(dbManager.getSettings());
  });

  app.put('/api/admin/settings', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = dbManager.updateSettings(req.body, req.adminUser!);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: 'Failed to update settings' });
    }
  });

  app.post('/api/admin/reset-sample-data', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      dbManager.resetSampleData(req.adminUser);
      res.json({ success: true, message: 'Database reset to sample dataset successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to reset sample data' });
    }
  });

  // Global API error handling to ensure all errors return clean JSON
  app.use((err: any, _req: Request, res: Response, next: any) => {
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({ error: message });
  });

  // -------------------------------------------------------------
  // VITE DEV SERVER OR STATIC PRODUCTION SERVING
  // -------------------------------------------------------------

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`OSC Attendance Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});
