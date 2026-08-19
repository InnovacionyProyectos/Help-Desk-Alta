export type TicketStatusCode =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const TICKET_STATUS_LABELS: Record<TicketStatusCode, string> = {
  OPEN: 'Abierto',
  ASSIGNED: 'Asignado',
  IN_PROGRESS: 'En Proceso',
  ON_HOLD: 'En Espera',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
  REOPENED: 'Reabierto',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: { id: number; name: string };
  subcategory: { id: number; name: string };
  typification: { id: number; name: string };
  status: { id: number; code: TicketStatusCode; name: string; isFinal: boolean };
  priority: TicketPriority;
  requester: UserSummary;
  assignedTo?: UserSummary;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TicketComment {
  id: string;
  body: string;
  isInternal: boolean;
  author: UserSummary;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: UserSummary;
  createdAt: string;
}

export interface TicketHistoryEvent {
  type: 'STATUS_CHANGE' | 'ASSIGNMENT';
  createdAt: string;
  from?: string;
  to: string;
  by: string;
  reason?: string;
}
