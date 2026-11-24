export type Language = 'en' | 'gu';

export type QueueStatus = 'Waiting' | 'Called' | 'In chair' | 'Done' | 'Cancelled' | 'No-show';

export type BarberStatus = 'Available' | 'Busy' | 'On break';

export interface ServiceItem {
  id: string;
  nameEn: string;
  nameGu: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface Barber {
  id: string;
  name: string;
  status: BarberStatus;
  isOnDuty: boolean;
  currentEntryId?: string | null;
}

export interface QueueEntry {
  id: string;
  token: string;
  customerName: string;
  phone: string;
  serviceIds: string[];
  preferredBarberId?: string | null; // null means 'Any barber'
  assignedBarberId?: string | null;
  status: QueueStatus;
  createdAt: string;
  calledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  estimatedWaitMinutes: number;
}
