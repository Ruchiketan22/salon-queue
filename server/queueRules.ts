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
    const isOnlineQueueOpen = onlineSetting ? onlineSetting.value === 'true' : true;

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
  }
};
