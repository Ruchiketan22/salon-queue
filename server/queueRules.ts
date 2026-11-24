import { db } from './db.js';

export interface WaitTimeResult {
  estimatedMinutes: number;
  position: number;
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

    // Available barbers on duty and not on break
    const activeBarbers = db.prepare(`
      SELECT COUNT(*) as count FROM barbers WHERE is_on_duty = 1 AND status != 'On break'
    `).get() as { count: number };
    const numBarbers = Math.max(1, activeBarbers?.count || 1);

    if (waitingAhead.length === 0) {
      // Check if any barber is free
      const freeBarbers = db.prepare(`
        SELECT COUNT(*) as count FROM barbers WHERE is_on_duty = 1 AND status = 'Available'
      `).get() as { count: number };
      if ((freeBarbers?.count || 0) > 0) {
        return { estimatedMinutes: 0, position: 1 };
      }
    }

    // Sum total duration of all services of entries ahead
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
  }
};
