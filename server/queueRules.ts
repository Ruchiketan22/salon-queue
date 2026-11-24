import { db } from './db.js';
import crypto from 'crypto';

export interface WaitTimeResult {
  estimatedMinutes: number;
  position: number;
}

export interface QueueOverview {
  waitingCount: number;
  nextEstimatedWaitMinutes: number;
  isOnlineQueueOpen: boolean;
  activeBarbersCount: number;
}

export interface JoinRequest {
  customerName: string;
  phone: string;
  serviceIds: string[];
  preferredBarberId?: string | null;
}


/**
 * Online joining hours (docs/03-flows-rules.md): salon open 10:00-21:00,
 * online joining closes 30 minutes before closing (20:30).
 * Uses Indian time so it also works on a UTC server such as Render.
 * Off by default so the live demo can always be tested; set ENFORCE_ONLINE_HOURS=true to turn it on.
 */
const ONLINE_OPEN_MINUTE = 10 * 60;        // 10:00
const ONLINE_CLOSE_MINUTE = 20 * 60 + 30;  // 20:30

function isWithinOnlineHours(): boolean {
  if (process.env.ENFORCE_ONLINE_HOURS !== 'true') return true;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((x) => x.type === 'hour')?.value || '0', 10) % 24;
  const minute = parseInt(parts.find((x) => x.type === 'minute')?.value || '0', 10);
  const minutes = hour * 60 + minute;
  return minutes >= ONLINE_OPEN_MINUTE && minutes < ONLINE_CLOSE_MINUTE;
}

/**
 * Centralized Queue Rules Module
 * - All queue ordering, wait times, token generation, and state transitions live here.
 */
export const queueRules = {
  /**
   * Generates next daily token format S-1, S-2... resetting each calendar day.
   */
  getNextToken(todayDateStr: string): string {
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM queue_entries WHERE date = ?
    `).get(todayDateStr) as { count: number };
    const nextNum = (row?.count || 0) + 1;
    return `S-${nextNum}`;
  },

  /**
   * Check if a phone number already has an active queue spot
   */
  hasActiveSpot(phone: string): { active: boolean; entryId?: string } {
    const row = db.prepare(`
      SELECT id FROM queue_entries 
      WHERE phone = ? AND status IN ('Waiting', 'Called', 'In chair')
      LIMIT 1
    `).get(phone) as { id: string } | undefined;

    return {
      active: !!row,
      entryId: row?.id,
    };
  },

  /**
   * Validate lifecycle transitions
   * Allowed:
   * Waiting -> Called -> In chair -> Done
   * Waiting -> Cancelled
   * Called -> No-show
   */
  isValidStatusTransition(from: string, to: string): boolean {
    const allowed: Record<string, string[]> = {
      'Waiting': ['Called', 'Cancelled'],
      'Called': ['In chair', 'No-show'],
      'In chair': ['Done'],
      'Done': [],
      'Cancelled': [],
      'No-show': [],
    };
    return (allowed[from] || []).includes(to);
  },

  /**
   * Number of barbers on duty and not on break
   */
  getActiveBarbersCount(): number {
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM barbers WHERE is_on_duty = 1 AND status != 'On break'
    `).get() as { count: number };
    return Math.max(1, row?.count || 1);
  },

  /**
   * Queue overview for Home and Join screens:
   * - Count of customers currently waiting
   * - Estimated wait time for someone joining right now
   * - Online queue open status
   */
  getQueueOverview(): QueueOverview {
    const waitingEntries = db.prepare(`
      SELECT service_ids FROM queue_entries 
      WHERE status = 'Waiting'
      ORDER BY created_at ASC
    `).all() as { service_ids: string }[];

    const waitingCount = waitingEntries.length;
    const numBarbers = this.getActiveBarbersCount();

    // Check if any barber is free
    const freeBarbers = db.prepare(`
      SELECT COUNT(*) as count FROM barbers WHERE is_on_duty = 1 AND status = 'Available'
    `).get() as { count: number };

    let nextEstimatedWaitMinutes = 0;
    if (waitingCount === 0 && (freeBarbers?.count || 0) > 0) {
      nextEstimatedWaitMinutes = 0;
    } else {
      const allServices = db.prepare('SELECT id, duration_minutes FROM services').all() as any[];
      const serviceDurationMap = new Map(allServices.map(s => [s.id, s.duration_minutes]));

      let totalMinutes = 0;
      for (const entry of waitingEntries) {
        const srvIds: string[] = JSON.parse(entry.service_ids || '[]');
        for (const sid of srvIds) {
          totalMinutes += serviceDurationMap.get(sid) || 15;
        }
      }

      const rawWait = totalMinutes / numBarbers;
      nextEstimatedWaitMinutes = Math.ceil(rawWait / 5) * 5;
    }

    const onlineSetting = db.prepare(`SELECT value FROM settings WHERE key = 'online_queue_open'`).get() as { value: string } | undefined;
    const ownerOpen = onlineSetting ? onlineSetting.value === 'true' : true;
    const isOnlineQueueOpen = ownerOpen && isWithinOnlineHours();

    return {
      waitingCount,
      nextEstimatedWaitMinutes,
      isOnlineQueueOpen,
      activeBarbersCount: numBarbers,
    };
  },

  /**
   * Wait time formula from docs/03-flows-rules.md:
   * Estimated wait ≈ (total duration of services of everyone ahead) / (on-duty & not-on-break barbers),
   * rounded up to nearest 5 minutes.
   */
  calculateWaitTime(entryId: string): WaitTimeResult {
    const target = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!target || target.status !== 'Waiting') {
      return { estimatedMinutes: 0, position: 0 };
    }

    const waitingAhead = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE status = 'Waiting' AND created_at < ?
      ORDER BY created_at ASC
    `).all(target.created_at) as any[];

    const position = waitingAhead.length + 1;
    const numBarbers = this.getActiveBarbersCount();

    if (waitingAhead.length === 0) {
      const freeBarbers = db.prepare(`
        SELECT COUNT(*) as count FROM barbers WHERE is_on_duty = 1 AND status = 'Available'
      `).get() as { count: number };
      if ((freeBarbers?.count || 0) > 0) {
        return { estimatedMinutes: 0, position: 1 };
      }
    }

    let totalMinutes = 0;
    const allServices = db.prepare('SELECT id, duration_minutes FROM services').all() as any[];
    const serviceDurationMap = new Map(allServices.map(s => [s.id, s.duration_minutes]));

    for (const entry of waitingAhead) {
      const srvIds: string[] = JSON.parse(entry.service_ids || '[]');
      for (const sid of srvIds) {
        totalMinutes += serviceDurationMap.get(sid) || 15;
      }
    }

    const rawWait = totalMinutes / numBarbers;
    const roundedWait = Math.ceil(rawWait / 5) * 5;

    return {
      estimatedMinutes: roundedWait,
      position,
    };
  },

  /**
   * Join Queue Logic with strict validation
   */
  joinQueue(data: JoinRequest): { success: boolean; code?: string; message?: string; entry?: any; entryId?: string } {
    const trimmedName = (data.customerName || '').trim();
    if (!trimmedName) {
      return { success: false, code: 'INVALID_NAME', message: 'Name is required' };
    }

    const cleanedPhone = (data.phone || '').trim().replace(/\D/g, '');
    if (!/^\d{10}$/.test(cleanedPhone)) {
      return { success: false, code: 'INVALID_PHONE', message: 'Phone must be exactly 10 digits' };
    }

    if (!Array.isArray(data.serviceIds) || data.serviceIds.length < 1 || data.serviceIds.length > 3) {
      return { success: false, code: 'INVALID_SERVICES', message: 'Must select between 1 and 3 services' };
    }

    // Verify all services exist and are active
    const placeholders = data.serviceIds.map(() => '?').join(',');
    const validServices = db.prepare(`
      SELECT id FROM services WHERE id IN (${placeholders}) AND is_active = 1
    `).all(...data.serviceIds) as { id: string }[];

    if (validServices.length !== data.serviceIds.length) {
      return { success: false, code: 'SERVICE_UNAVAILABLE', message: 'One or more selected services are inactive' };
    }

    // Verify barber if specific barber selected
    let preferredBarberId: string | null = null;
    if (data.preferredBarberId) {
      const barber = db.prepare('SELECT id FROM barbers WHERE id = ? AND is_on_duty = 1').get(data.preferredBarberId) as { id: string } | undefined;
      if (!barber) {
        return { success: false, code: 'INVALID_BARBER', message: 'Selected barber is not on duty' };
      }
      preferredBarberId = barber.id;
    }

    // Check active spot
    const activeCheck = this.hasActiveSpot(cleanedPhone);
    if (activeCheck.active) {
      return {
        success: false,
        code: 'ALREADY_IN_QUEUE',
        entryId: activeCheck.entryId,
        message: 'You are already in the queue',
      };
    }

    // Check if online queue is open
    const overview = this.getQueueOverview();
    if (!overview.isOnlineQueueOpen) {
      return {
        success: false,
        code: 'QUEUE_CLOSED',
        message: 'Online queue is closed. Walk-ins are welcome at the salon.',
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const token = this.getNextToken(todayStr);
    const id = `entry-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const createdAt = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO queue_entries (
        id, token, customer_name, phone, service_ids, preferred_barber_id,
        status, date, created_at, estimated_wait_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, 'Waiting', ?, ?, ?)
    `);

    insert.run(
      id,
      token,
      trimmedName,
      cleanedPhone,
      JSON.stringify(data.serviceIds),
      preferredBarberId,
      todayStr,
      createdAt,
      overview.nextEstimatedWaitMinutes
    );

    const waitInfo = this.calculateWaitTime(id);

    return {
      success: true,
      entry: {
        id,
        token,
        customerName: trimmedName,
        phone: cleanedPhone,
        serviceIds: data.serviceIds,
        preferredBarberId,
        status: 'Waiting',
        createdAt,
        estimatedWaitMinutes: waitInfo.estimatedMinutes,
        position: waitInfo.position,
      },
    };
  },

  /**
   * Cancel an entry only while Waiting
   */
  cancelEntry(entryId: string): { success: boolean; message?: string } {
    const entry = db.prepare('SELECT status FROM queue_entries WHERE id = ?').get(entryId) as { status: string } | undefined;
    if (!entry) {
      return { success: false, message: 'Entry not found' };
    }
    if (entry.status !== 'Waiting') {
      return { success: false, message: 'Can only cancel while waiting' };
    }
    db.prepare("UPDATE queue_entries SET status = 'Cancelled' WHERE id = ?").run(entryId);
    return { success: true };
  },

  /**
   * Update status enforcing strict lifecycle rules
   */
  updateStatus(entryId: string, newStatus: string, assignedBarberId?: string): { success: boolean; message?: string; entry?: any } {
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!entry) {
      return { success: false, message: 'Entry not found' };
    }

    if (!this.isValidStatusTransition(entry.status, newStatus)) {
      return { success: false, message: `Invalid status transition from ${entry.status} to ${newStatus}` };
    }

    const now = new Date().toISOString();
    let calledAt = entry.called_at;
    let startedAt = entry.started_at;
    let completedAt = entry.completed_at;
    let finalBarberId = entry.assigned_barber_id;

    if (newStatus === 'Called') {
      calledAt = now;
      if (assignedBarberId) finalBarberId = assignedBarberId;
    } else if (newStatus === 'In chair') {
      startedAt = now;
      if (assignedBarberId) finalBarberId = assignedBarberId;
    } else if (newStatus === 'Done') {
      completedAt = now;
    }

    db.prepare(`
      UPDATE queue_entries
      SET status = ?, called_at = ?, started_at = ?, completed_at = ?, assigned_barber_id = ?
      WHERE id = ?
    `).run(newStatus, calledAt, startedAt, completedAt, finalBarberId, entryId);

    return {
      success: true,
      entry: this.getEntryDetails(entryId)
    };
  },

  /**
   * Get enriched entry details
   */
  getEntryDetails(entryId: string): any | null {
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!entry) return null;

    const waitInfo = this.calculateWaitTime(entry.id);
    const serviceIds: string[] = JSON.parse(entry.service_ids || '[]');

    let services: any[] = [];
    if (serviceIds.length > 0) {
      const placeholders = serviceIds.map(() => '?').join(',');
      services = db.prepare(`
        SELECT id, name_en as nameEn, name_gu as nameGu, duration_minutes as durationMinutes, price
        FROM services WHERE id IN (${placeholders})
      `).all(...serviceIds);
    }

    let preferredBarber = null;
    if (entry.preferred_barber_id) {
      preferredBarber = db.prepare(`
        SELECT id, name, status, is_on_duty as isOnDuty
        FROM barbers WHERE id = ?
      `).get(entry.preferred_barber_id) || null;
    }

    let assignedBarber = null;
    if (entry.assigned_barber_id) {
      assignedBarber = db.prepare(`
        SELECT id, name, status, is_on_duty as isOnDuty
        FROM barbers WHERE id = ?
      `).get(entry.assigned_barber_id) || null;
    }

    const totalDurationMinutes = services.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const totalPrice = services.reduce((sum, s) => sum + (s.price || 0), 0);

    return {
      id: entry.id,
      token: entry.token,
      customerName: entry.customer_name,
      phone: entry.phone,
      serviceIds,
      services,
      preferredBarber,
      assignedBarber,
      status: entry.status,
      createdAt: entry.created_at,
      calledAt: entry.called_at,
      startedAt: entry.started_at,
      completedAt: entry.completed_at,
      estimatedWaitMinutes: waitInfo.estimatedMinutes,
      position: waitInfo.position,
      totalDurationMinutes,
      totalPrice,
    };
  },

  /**
   * Call Next Customer for Barber X
   * - Picks the earliest Waiting customer who chose X or 'Any barber'
   * - Never gives a customer who chose another barber to X
   * - Barber must be Available and have no active Called or In chair customer
   */
  callNext(barberId: string): { success: boolean; code?: string; message?: string; entry?: any } {
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId) as any;
    if (!barber || barber.is_on_duty !== 1) {
      return { success: false, code: 'NOT_ON_DUTY', message: 'Barber is not on duty' };
    }

    if (barber.status === 'On break') {
      return { success: false, code: 'ON_BREAK', message: `${barber.name} is on break` };
    }

    const activeCust = db.prepare(`
      SELECT id FROM queue_entries 
      WHERE assigned_barber_id = ? AND status IN ('Called', 'In chair')
      LIMIT 1
    `).get(barberId) as { id: string } | undefined;

    if (activeCust) {
      return { success: false, code: 'BARBER_BUSY', message: `${barber.name} already has an active customer` };
    }

    // Earliest Waiting customer who chose this barber OR 'Any barber' (preferred_barber_id IS NULL)
    const candidate = db.prepare(`
      SELECT id FROM queue_entries
      WHERE status = 'Waiting'
        AND (preferred_barber_id IS NULL OR preferred_barber_id = ?)
      ORDER BY created_at ASC
      LIMIT 1
    `).get(barberId) as { id: string } | undefined;

    if (!candidate) {
      return {
        success: false,
        code: 'NO_MATCHING_CUSTOMER',
        message: 'No matching customer for this barber',
      };
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE queue_entries
      SET status = 'Called', assigned_barber_id = ?, called_at = ?
      WHERE id = ?
    `).run(barberId, now, candidate.id);

    return {
      success: true,
      entry: this.getEntryDetails(candidate.id),
    };
  },

  /**
   * Add Walk-in customer from Reception
   * - Can still be added after online joining closes
   */
  addWalkIn(data: JoinRequest): { success: boolean; code?: string; message?: string; entry?: any } {
    const trimmedName = (data.customerName || '').trim();
    if (!trimmedName) {
      return { success: false, code: 'INVALID_NAME', message: 'Name is required' };
    }

    const cleanedPhone = (data.phone || '').trim().replace(/\D/g, '');
    if (!/^\d{10}$/.test(cleanedPhone)) {
      return { success: false, code: 'INVALID_PHONE', message: 'Phone must be exactly 10 digits' };
    }

    if (!Array.isArray(data.serviceIds) || data.serviceIds.length < 1 || data.serviceIds.length > 3) {
      return { success: false, code: 'INVALID_SERVICES', message: 'Must select between 1 and 3 services' };
    }

    const placeholders = data.serviceIds.map(() => '?').join(',');
    const validServices = db.prepare(`
      SELECT id FROM services WHERE id IN (${placeholders}) AND is_active = 1
    `).all(...data.serviceIds) as { id: string }[];

    if (validServices.length !== data.serviceIds.length) {
      return { success: false, code: 'SERVICE_UNAVAILABLE', message: 'One or more selected services are inactive' };
    }

    let preferredBarberId: string | null = null;
    if (data.preferredBarberId) {
      const barber = db.prepare('SELECT id FROM barbers WHERE id = ? AND is_on_duty = 1').get(data.preferredBarberId) as { id: string } | undefined;
      if (barber) {
        preferredBarberId = barber.id;
      }
    }

    const activeCheck = this.hasActiveSpot(cleanedPhone);
    if (activeCheck.active) {
      return {
        success: false,
        code: 'ALREADY_IN_QUEUE',
        message: 'Customer already has an active spot in the queue',
        entry: this.getEntryDetails(activeCheck.entryId!),
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const token = this.getNextToken(todayStr);
    const id = `entry-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const createdAt = new Date().toISOString();
    const overview = this.getQueueOverview();

    db.prepare(`
      INSERT INTO queue_entries (
        id, token, customer_name, phone, service_ids, preferred_barber_id,
        status, date, created_at, estimated_wait_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, 'Waiting', ?, ?, ?)
    `).run(
      id,
      token,
      trimmedName,
      cleanedPhone,
      JSON.stringify(data.serviceIds),
      preferredBarberId,
      todayStr,
      createdAt,
      overview.nextEstimatedWaitMinutes
    );

    return {
      success: true,
      entry: this.getEntryDetails(id),
    };
  },

  /**
   * Mark customer as No-show
   * - Only allowed for Called customers
   */
  markNoShow(entryId: string): { success: boolean; message?: string } {
    const entry = db.prepare('SELECT status FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!entry) {
      return { success: false, message: 'Entry not found' };
    }

    if (entry.status !== 'Called') {
      return { success: false, message: 'Only Called customers can be marked as No-show' };
    }

    db.prepare("UPDATE queue_entries SET status = 'No-show' WHERE id = ?").run(entryId);
    return { success: true };
  },

  /**
   * Full Reception Dashboard Data Aggregator
   */
  getReceptionDashboard(): any {
    const now = Date.now();
    const barbers = db.prepare(`
      SELECT id, name, status, is_on_duty as isOnDuty
      FROM barbers
      WHERE is_on_duty = 1
      ORDER BY id ASC
    `).all() as any[];

    const enrichedBarbers = barbers.map((b) => {
      const activeEntry = db.prepare(`
        SELECT * FROM queue_entries
        WHERE assigned_barber_id = ? AND status IN ('Called', 'In chair')
        ORDER BY created_at DESC
        LIMIT 1
      `).get(b.id) as any;

      let currentCustomer = null;
      if (activeEntry) {
        const srvIds: string[] = JSON.parse(activeEntry.service_ids || '[]');
        const placeholders = srvIds.map(() => '?').join(',');
        const services = srvIds.length > 0 ? db.prepare(`
          SELECT id, name_en as nameEn, name_gu as nameGu, duration_minutes as durationMinutes, price
          FROM services WHERE id IN (${placeholders})
        `).all(...srvIds) : [];

        const totalMinutes = services.reduce((sum: number, s: any) => sum + (s.durationMinutes || 0), 0);

        let elapsedMinutes = 0;
        let remainingMinutes = totalMinutes;

        if (activeEntry.status === 'In chair' && activeEntry.started_at) {
          elapsedMinutes = Math.floor((now - new Date(activeEntry.started_at).getTime()) / 60000);
          remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes);
        }

        currentCustomer = {
          id: activeEntry.id,
          token: activeEntry.token,
          customerName: activeEntry.customer_name,
          phone: activeEntry.phone,
          status: activeEntry.status,
          services,
          totalMinutes,
          elapsedMinutes,
          remainingMinutes,
          calledAt: activeEntry.called_at,
          startedAt: activeEntry.started_at,
        };
      }

      const isBusy = b.status === 'Busy' || currentCustomer !== null;
      const canCallNext = b.status === 'Available' && currentCustomer === null;

      return {
        id: b.id,
        name: b.name,
        status: b.status,
        isOnDuty: !!b.isOnDuty,
        currentCustomer,
        isBusy,
        canCallNext,
      };
    });

    const entries = db.prepare(`
      SELECT * FROM queue_entries
      WHERE status IN ('Waiting', 'Called')
      ORDER BY (CASE WHEN status = 'Called' THEN 0 ELSE 1 END), created_at ASC
    `).all() as any[];

    const enrichedQueueList = entries.map((entry) => {
      const srvIds: string[] = JSON.parse(entry.service_ids || '[]');
      const placeholders = srvIds.map(() => '?').join(',');
      const services = srvIds.length > 0 ? db.prepare(`
        SELECT id, name_en as nameEn, name_gu as nameGu, duration_minutes as durationMinutes, price
        FROM services WHERE id IN (${placeholders})
      `).all(...srvIds) : [];

      let preferredBarber = null;
      if (entry.preferred_barber_id) {
        preferredBarber = db.prepare('SELECT id, name FROM barbers WHERE id = ?').get(entry.preferred_barber_id) || null;
      }

      let assignedBarber = null;
      if (entry.assigned_barber_id) {
        assignedBarber = db.prepare('SELECT id, name FROM barbers WHERE id = ?').get(entry.assigned_barber_id) || null;
      }

      const createdTime = new Date(entry.created_at).getTime();
      const waitedMinutes = Math.floor((now - createdTime) / 60000);
      const isOver60 = waitedMinutes >= 60;

      let calledSecondsRemaining = 0;
      let isCountdownZero = false;

      if (entry.status === 'Called' && entry.called_at) {
        const calledTime = new Date(entry.called_at).getTime();
        const elapsedSec = Math.floor((now - calledTime) / 1000);
        calledSecondsRemaining = Math.max(0, 600 - elapsedSec); // 10 minutes = 600 seconds
        isCountdownZero = calledSecondsRemaining <= 0;
      }

      return {
        id: entry.id,
        token: entry.token,
        customerName: entry.customer_name,
        phone: entry.phone,
        status: entry.status,
        services,
        preferredBarber,
        assignedBarber,
        createdAt: entry.created_at,
        calledAt: entry.called_at,
        waitedMinutes,
        isOver60,
        calledSecondsRemaining,
        isCountdownZero,
      };
    });

    const queueCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM queue_entries WHERE status IN ('Waiting', 'Called')
    `).get() as { count: number };

    return {
      barbers: enrichedBarbers,
      queueList: enrichedQueueList,
      queueCount: queueCountRow?.count || 0,
    };
  },

  /**
   * Barber View details for /barber/:name
   */
  getBarberView(nameOrSlug: string): any {
    const barber = db.prepare(`
      SELECT id, name, status, is_on_duty as isOnDuty
      FROM barbers
      WHERE LOWER(name) = LOWER(?)
      LIMIT 1
    `).get(nameOrSlug.trim()) as any;

    if (!barber) return null;

    // Current Customer (Called or In chair)
    const activeEntry = db.prepare(`
      SELECT * FROM queue_entries
      WHERE assigned_barber_id = ? AND status IN ('Called', 'In chair')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(barber.id) as any;

    let currentCustomer = null;
    if (activeEntry) {
      currentCustomer = this.getEntryDetails(activeEntry.id);
    }

    // "Next for you" Preview: earliest Waiting customer who chose this barber or Any barber
    const nextEntry = db.prepare(`
      SELECT id FROM queue_entries
      WHERE status = 'Waiting'
        AND (preferred_barber_id IS NULL OR preferred_barber_id = ?)
      ORDER BY created_at ASC
      LIMIT 1
    `).get(barber.id) as { id: string } | undefined;

    let nextCustomer = null;
    if (nextEntry) {
      nextCustomer = this.getEntryDetails(nextEntry.id);
    }

    return {
      barber,
      currentCustomer,
      nextCustomer,
    };
  },

  /**
   * Barber taps [ Start ]
   * - Transition: Called -> In chair
   */
  startService(entryId: string, barberId: string): { success: boolean; message?: string; entry?: any } {
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!entry) {
      return { success: false, message: 'Customer entry not found' };
    }

    if (entry.status !== 'Called') {
      return { success: false, message: 'Can only start service for a Called customer' };
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE queue_entries
      SET status = 'In chair', started_at = ?, assigned_barber_id = ?
      WHERE id = ?
    `).run(now, barberId, entryId);

    // Update barber status to Busy if they were Available
    db.prepare(`
      UPDATE barbers
      SET status = 'Busy'
      WHERE id = ? AND status = 'Available'
    `).run(barberId);

    return {
      success: true,
      entry: this.getEntryDetails(entryId),
    };
  },

  /**
   * Barber taps [ Done ]
   * - Transition: In chair -> Done
   */
  completeService(entryId: string, barberId: string): { success: boolean; message?: string } {
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId) as any;
    if (!entry) {
      return { success: false, message: 'Customer entry not found' };
    }

    if (entry.status !== 'In chair') {
      return { success: false, message: 'Can only complete service for a customer In chair' };
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE queue_entries
      SET status = 'Done', completed_at = ?
      WHERE id = ?
    `).run(now, entryId);

    // Reset barber status to Available if they were Busy
    db.prepare(`
      UPDATE barbers
      SET status = 'Available'
      WHERE id = ? AND status = 'Busy'
    `).run(barberId);

    return { success: true };
  },

  /**
   * Toggle Barber Break
   */
  toggleBarberBreak(barberId: string): { success: boolean; newStatus?: string; message?: string } {
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId) as any;
    if (!barber) {
      return { success: false, message: 'Barber not found' };
    }

    const newStatus = barber.status === 'On break' ? 'Available' : 'On break';
    db.prepare('UPDATE barbers SET status = ? WHERE id = ?').run(newStatus, barberId);

    return { success: true, newStatus };
  },

  // ─── Admin / Owner Settings Methods ────────────────────────────────────────

  /**
   * Get all services (including inactive) for admin view.
   */
  adminGetServices(): any[] {
    return db.prepare(`
      SELECT id, name_en as nameEn, name_gu as nameGu,
             duration_minutes as durationMinutes, price,
             is_active as isActive
      FROM services
      ORDER BY duration_minutes ASC
    `).all() as any[];
  },

  /**
   * Toggle a service's active state.
   * Inactive services are hidden from /join but kept in the DB.
   */
  adminToggleService(serviceId: string): { success: boolean; newIsActive?: boolean; message?: string } {
    const svc = db.prepare('SELECT is_active FROM services WHERE id = ?').get(serviceId) as { is_active: number } | undefined;
    if (!svc) return { success: false, message: 'Service not found' };
    const newVal = svc.is_active ? 0 : 1;
    db.prepare('UPDATE services SET is_active = ? WHERE id = ?').run(newVal, serviceId);
    return { success: true, newIsActive: newVal === 1 };
  },

  /**
   * Update a service's details (name EN, name GU, duration, price).
   */
  adminUpdateService(
    serviceId: string,
    data: { nameEn: string; nameGu: string; durationMinutes: number; price: number }
  ): { success: boolean; message?: string } {
    const svc = db.prepare('SELECT id FROM services WHERE id = ?').get(serviceId);
    if (!svc) return { success: false, message: 'Service not found' };
    if (!data.nameEn?.trim() || !data.nameGu?.trim()) return { success: false, message: 'Names are required' };
    if (!Number.isInteger(data.durationMinutes) || data.durationMinutes < 1) return { success: false, message: 'Invalid duration' };
    if (!Number.isInteger(data.price) || data.price < 0) return { success: false, message: 'Invalid price' };
    db.prepare(`
      UPDATE services SET name_en = ?, name_gu = ?, duration_minutes = ?, price = ? WHERE id = ?
    `).run(data.nameEn.trim(), data.nameGu.trim(), data.durationMinutes, data.price, serviceId);
    return { success: true };
  },

  /**
   * Add a new service.
   */
  adminAddService(
    data: { nameEn: string; nameGu: string; durationMinutes: number; price: number }
  ): { success: boolean; service?: any; message?: string } {
    if (!data.nameEn?.trim() || !data.nameGu?.trim()) return { success: false, message: 'Names are required' };
    if (!Number.isInteger(data.durationMinutes) || data.durationMinutes < 1) return { success: false, message: 'Invalid duration' };
    if (!Number.isInteger(data.price) || data.price < 0) return { success: false, message: 'Invalid price' };
    const id = `srv-${Date.now()}`;
    db.prepare(`
      INSERT INTO services (id, name_en, name_gu, duration_minutes, price, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, data.nameEn.trim(), data.nameGu.trim(), data.durationMinutes, data.price);
    return {
      success: true,
      service: { id, nameEn: data.nameEn.trim(), nameGu: data.nameGu.trim(), durationMinutes: data.durationMinutes, price: data.price, isActive: true },
    };
  },

  /**
   * Get all barbers (including off-duty) for admin view.
   */
  adminGetBarbers(): any[] {
    return db.prepare(`
      SELECT id, name, status, is_on_duty as isOnDuty
      FROM barbers ORDER BY id ASC
    `).all() as any[];
  },

  /**
   * Toggle a barber's on-duty state for today.
   * Off-duty barbers are excluded from the barber picker and from wait-time calculations.
   */
  adminToggleBarberDuty(barberId: string): { success: boolean; newIsOnDuty?: boolean; message?: string } {
    const barber = db.prepare('SELECT is_on_duty FROM barbers WHERE id = ?').get(barberId) as { is_on_duty: number } | undefined;
    if (!barber) return { success: false, message: 'Barber not found' };
    const newVal = barber.is_on_duty ? 0 : 1;
    db.prepare('UPDATE barbers SET is_on_duty = ? WHERE id = ?').run(newVal, barberId);
    return { success: true, newIsOnDuty: newVal === 1 };
  },

  /**
   * Set online queue open/closed.
   * When closed, joinQueue() already rejects with QUEUE_CLOSED.
   * Walk-in (addWalkIn) is unaffected.
   */
  adminSetQueueOpen(open: boolean): { success: boolean } {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('online_queue_open', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(open ? 'true' : 'false');
    return { success: true };
  },

  /**
   * Today's stats for the admin stats cards.
   */
  adminGetTodayStats(): { served: number; avgWaitMinutes: number | null; noShows: number } {
    const todayStr = new Date().toISOString().split('T')[0];

    const served = (db.prepare(`
      SELECT COUNT(*) as count FROM queue_entries WHERE date = ? AND status = 'Done'
    `).get(todayStr) as { count: number }).count;

    const noShows = (db.prepare(`
      SELECT COUNT(*) as count FROM queue_entries WHERE date = ? AND status = 'No-show'
    `).get(todayStr) as { count: number }).count;

    // Average wait: time from created_at to called_at for Done entries today
    const avgRow = db.prepare(`
      SELECT AVG(
        CAST((julianday(called_at) - julianday(created_at)) * 1440 AS INTEGER)
      ) as avg_wait
      FROM queue_entries
      WHERE date = ? AND status = 'Done' AND called_at IS NOT NULL
    `).get(todayStr) as { avg_wait: number | null };

    const avgWaitMinutes = avgRow?.avg_wait != null ? Math.round(avgRow.avg_wait) : null;

    return { served, avgWaitMinutes, noShows };
  },

  /**
   * Full admin dashboard data in one call.
   */
  adminGetDashboard(): any {
    const isOpenRow = db.prepare(`SELECT value FROM settings WHERE key = 'online_queue_open'`).get() as { value: string } | undefined;
    return {
      services: this.adminGetServices(),
      barbers: this.adminGetBarbers(),
      isOnlineQueueOpen: isOpenRow ? isOpenRow.value === 'true' : true,
      todayStats: this.adminGetTodayStats(),
    };
  },

  /**
   * Waiting Area TV Display Data (/display)
   */
  getDisplayData(): any {
    const now = Date.now();
    const barbers = db.prepare(`
      SELECT id, name, status, is_on_duty as isOnDuty
      FROM barbers
      WHERE is_on_duty = 1
      ORDER BY id ASC
    `).all() as any[];

    const barberRows = barbers.map((b) => {
      const activeEntry = db.prepare(`
        SELECT * FROM queue_entries
        WHERE assigned_barber_id = ? AND status IN ('Called', 'In chair')
        ORDER BY created_at DESC
        LIMIT 1
      `).get(b.id) as any;

      let currentToken = null;
      let isNewlyCalled = false;
      let customerStatus = null;

      if (activeEntry) {
        currentToken = activeEntry.token;
        customerStatus = activeEntry.status;

        if (activeEntry.status === 'Called' && activeEntry.called_at) {
          const calledAgeSec = (now - new Date(activeEntry.called_at).getTime()) / 1000;
          isNewlyCalled = calledAgeSec <= 8; // Flash for recent calls
        }
      }

      return {
        id: b.id,
        name: b.name,
        status: b.status,
        currentToken,
        customerStatus,
        isNewlyCalled,
      };
    });

    // Next 5 waiting tokens
    const upNextEntries = db.prepare(`
      SELECT id, token, created_at, service_ids FROM queue_entries
      WHERE status = 'Waiting'
      ORDER BY created_at ASC
      LIMIT 5
    `).all() as any[];

    const upNext = upNextEntries.map((entry) => {
      const waitInfo = this.calculateWaitTime(entry.id);
      return {
        id: entry.id,
        token: entry.token,
        estimatedWaitMinutes: waitInfo.estimatedMinutes,
      };
    });

    const onlineSetting = db.prepare(`SELECT value FROM settings WHERE key = 'online_queue_open'`).get() as { value: string } | undefined;
    const isOnlineQueueOpen = onlineSetting ? onlineSetting.value === 'true' : true;

    return {
      barbers: barberRows,
      upNext,
      isOnlineQueueOpen,
    };
  }
};
