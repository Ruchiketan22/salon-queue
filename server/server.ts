import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { db, initDb } from './db.js';
import { queueRules } from './queueRules.js';

// Initialize SQLite database
initDb();

const app = express();
const httpServer = createServer(app);

// Configure Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(cors());
app.use(express.json());

// Health-check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// GET /api/services - Active services
app.get('/api/services', (_req, res) => {
  const rows = db.prepare(`
    SELECT id, name_en as nameEn, name_gu as nameGu, duration_minutes as durationMinutes, price, is_active as isActive
    FROM services
    WHERE is_active = 1
    ORDER BY duration_minutes ASC
  `).all();
  res.json(rows);
});

// GET /api/barbers - Barbers on duty
app.get('/api/barbers', (_req, res) => {
  const rows = db.prepare(`
    SELECT id, name, status, is_on_duty as isOnDuty
    FROM barbers
    WHERE is_on_duty = 1
    ORDER BY id ASC
  `).all();
  res.json(rows);
});

// GET /api/queue/overview - Home screen & summary stats
app.get('/api/queue/overview', (_req, res) => {
  const overview = queueRules.getQueueOverview();
  res.json(overview);
});

// POST /api/queue/join - Join the queue
app.post('/api/queue/join', (req, res) => {
  const result = queueRules.joinQueue(req.body);
  if (!result.success) {
    const statusCode = result.code === 'ALREADY_IN_QUEUE' ? 409 : 400;
    return res.status(statusCode).json(result);
  }

  // Notify all connected clients of queue change
  io.emit('queue:updated');

  res.status(201).json(result);
});

// GET /api/queue/:id - Enriched Entry details
app.get('/api/queue/:id', (req, res) => {
  const details = queueRules.getEntryDetails(req.params.id);
  if (!details) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  res.json(details);
});

// POST /api/queue/:id/cancel - Cancel spot while Waiting
app.post('/api/queue/:id/cancel', (req, res) => {
  const result = queueRules.cancelEntry(req.params.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  io.emit('queue:updated');
  res.json({ success: true, message: 'Spot cancelled successfully' });
});

// PATCH /api/queue/:id/status - Update queue status
app.patch('/api/queue/:id/status', (req, res) => {
  const { status, assignedBarberId } = req.body;
  const result = queueRules.updateStatus(req.params.id, status, assignedBarberId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  io.emit('queue:updated');
  res.json(result);
});

// GET /api/reception/dashboard - Reception dashboard data
app.get('/api/reception/dashboard', (_req, res) => {
  const data = queueRules.getReceptionDashboard();
  res.json(data);
});

// POST /api/reception/call-next - Call next customer for barber
app.post('/api/reception/call-next', (req, res) => {
  const { barberId } = req.body;
  if (!barberId) {
    return res.status(400).json({ success: false, message: 'barberId is required' });
  }
  const result = queueRules.callNext(barberId);
  if (!result.success) {
    const status = result.code === 'NO_MATCHING_CUSTOMER' ? 404 : 400;
    return res.status(status).json(result);
  }
  io.emit('queue:updated');
  res.json(result);
});

// POST /api/reception/walk-in - Add walk-in customer
app.post('/api/reception/walk-in', (req, res) => {
  const result = queueRules.addWalkIn(req.body);
  if (!result.success) {
    const status = result.code === 'ALREADY_IN_QUEUE' ? 409 : 400;
    return res.status(status).json(result);
  }
  io.emit('queue:updated');
  res.status(201).json(result);
});

// POST /api/reception/no-show - Mark Called customer as No-show
app.post('/api/reception/no-show', (req, res) => {
  const { entryId } = req.body;
  if (!entryId) {
    return res.status(400).json({ success: false, message: 'entryId is required' });
  }
  const result = queueRules.markNoShow(entryId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  io.emit('queue:updated');
  res.json({ success: true });
});

// GET /api/barber/:name - Barber View data
app.get('/api/barber/:name', (req, res) => {
  const data = queueRules.getBarberView(req.params.name);
  if (!data) {
    return res.status(404).json({ error: 'Barber not found' });
  }
  res.json(data);
});

// POST /api/barber/start - Start service
app.post('/api/barber/start', (req, res) => {
  const { entryId, barberId } = req.body;
  if (!entryId || !barberId) {
    return res.status(400).json({ success: false, message: 'entryId and barberId are required' });
  }
  const result = queueRules.startService(entryId, barberId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  io.emit('queue:updated');
  res.json(result);
});

// POST /api/barber/done - Complete service
app.post('/api/barber/done', (req, res) => {
  const { entryId, barberId } = req.body;
  if (!entryId || !barberId) {
    return res.status(400).json({ success: false, message: 'entryId and barberId are required' });
  }
  const result = queueRules.completeService(entryId, barberId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  io.emit('queue:updated');
  res.json(result);
});

// POST /api/barber/toggle-break - Toggle break status
app.post('/api/barber/toggle-break', (req, res) => {
  const { barberId } = req.body;
  if (!barberId) {
    return res.status(400).json({ success: false, message: 'barberId is required' });
  }
  const result = queueRules.toggleBarberBreak(barberId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  io.emit('queue:updated');
  res.json(result);
});

// GET /api/display - Waiting Area TV display data
app.get('/api/display', (_req, res) => {
  const data = queueRules.getDisplayData();
  res.json(data);
});

// ─── Admin / Owner Settings Routes ──────────────────────────────────────────

// GET /api/admin/dashboard - Full admin data in one call
app.get('/api/admin/dashboard', (_req, res) => {
  res.json(queueRules.adminGetDashboard());
});

// POST /api/admin/services/:id/toggle - Toggle service active state
app.post('/api/admin/services/:id/toggle', (req, res) => {
  const result = queueRules.adminToggleService(req.params.id);
  if (!result.success) return res.status(404).json(result);
  io.emit('queue:updated');
  res.json(result);
});

// PATCH /api/admin/services/:id - Update service details
app.patch('/api/admin/services/:id', (req, res) => {
  const { nameEn, nameGu, durationMinutes, price } = req.body;
  const result = queueRules.adminUpdateService(req.params.id, {
    nameEn, nameGu,
    durationMinutes: parseInt(durationMinutes, 10),
    price: parseInt(price, 10),
  });
  if (!result.success) return res.status(400).json(result);
  io.emit('queue:updated');
  res.json(result);
});

// POST /api/admin/services - Add a new service
app.post('/api/admin/services', (req, res) => {
  const { nameEn, nameGu, durationMinutes, price } = req.body;
  const result = queueRules.adminAddService({
    nameEn, nameGu,
    durationMinutes: parseInt(durationMinutes, 10),
    price: parseInt(price, 10),
  });
  if (!result.success) return res.status(400).json(result);
  io.emit('queue:updated');
  res.status(201).json(result);
});

// POST /api/admin/barbers/:id/toggle-duty - Toggle barber on-duty state
app.post('/api/admin/barbers/:id/toggle-duty', (req, res) => {
  const result = queueRules.adminToggleBarberDuty(req.params.id);
  if (!result.success) return res.status(404).json(result);
  io.emit('queue:updated');
  res.json(result);
});

// POST /api/admin/queue-open - Set online queue open/closed
app.post('/api/admin/queue-open', (req, res) => {
  const { open } = req.body;
  if (typeof open !== 'boolean') {
    return res.status(400).json({ success: false, message: '`open` must be a boolean' });
  }
  const result = queueRules.adminSetQueueOpen(open);
  io.emit('queue:updated');
  res.json(result);
});

// Socket.IO event handler
io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`[Server] Salon Queue Backend listening on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
});
