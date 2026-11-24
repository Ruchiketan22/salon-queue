import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../salon.db');

export const db = new Database(dbPath);

// Enable WAL mode for performance & concurrent reads
db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_gu TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS barbers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Available', -- 'Available', 'Busy', 'On break'
      is_on_duty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS queue_entries (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service_ids TEXT NOT NULL, -- JSON array of service IDs
      preferred_barber_id TEXT, -- NULL for 'Any barber'
      assigned_barber_id TEXT,
      status TEXT NOT NULL DEFAULT 'Waiting', -- 'Waiting', 'Called', 'In chair', 'Done', 'Cancelled', 'No-show'
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      called_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      estimated_wait_minutes INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default services if empty
  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get() as { count: number };
  if (serviceCount.count === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (id, name_en, name_gu, duration_minutes, price, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const defaultServices = [
      { id: 'srv-1', en: 'Haircut', gu: 'હેરકટ', duration: 30, price: 150 },
      { id: 'srv-2', en: 'Beard trim', gu: 'દાઢી ટ્રીમ', duration: 15, price: 80 },
      { id: 'srv-3', en: 'Hair spa', gu: 'હેર સ્પા', duration: 45, price: 400 },
      { id: 'srv-4', en: 'Head massage', gu: 'હેડ મસાજ', duration: 20, price: 120 },
      { id: 'srv-5', en: 'Facial', gu: 'ફેસિયલ', duration: 40, price: 350 },
    ];

    for (const s of defaultServices) {
      insertService.run(s.id, s.en, s.gu, s.duration, s.price);
    }
  }

  // Seed default barbers if empty
  const barberCount = db.prepare('SELECT COUNT(*) as count FROM barbers').get() as { count: number };
  if (barberCount.count === 0) {
    const insertBarber = db.prepare(`
      INSERT INTO barbers (id, name, status, is_on_duty)
      VALUES (?, ?, 'Available', 1)
    `);

    const defaultBarbers = [
      { id: 'barber-ravi', name: 'Ravi' },
      { id: 'barber-amit', name: 'Amit' },
      { id: 'barber-imran', name: 'Imran' },
    ];

    for (const b of defaultBarbers) {
      insertBarber.run(b.id, b.name);
    }
  }

  // Seed online queue open setting if not set
  const onlineQueueSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('online_queue_open');
  if (!onlineQueueSetting) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('online_queue_open', 'true');
  }
}
