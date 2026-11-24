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

// GET /api/queue/:id - Entry details
app.get('/api/queue/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(req.params.id) as any;
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const waitInfo = queueRules.calculateWaitTime(entry.id);
  const serviceIds = JSON.parse(entry.service_ids || '[]');
  
  res.json({
    id: entry.id,
    token: entry.token,
    customerName: entry.customer_name,
    phone: entry.phone,
    serviceIds,
    preferredBarberId: entry.preferred_barber_id,
    assignedBarberId: entry.assigned_barber_id,
    status: entry.status,
    createdAt: entry.created_at,
    estimatedWaitMinutes: waitInfo.estimatedMinutes,
    position: waitInfo.position,
  });
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
