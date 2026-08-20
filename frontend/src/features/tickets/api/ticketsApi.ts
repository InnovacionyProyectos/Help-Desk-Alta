import { httpClient } from '@shared/api/httpClient';
import {
  PaginatedResult,
  Ticket,
  TicketComment,
  TicketHistoryEvent,
  TicketPriority,
  TicketStatusCode,
  TicketType,
} from '@shared/types/ticket';

export interface CreateTicketPayload {
  subject: string;
  description: string;
  // Opcionales: el Usuario Final no las envía; Admin/Técnico las asigna
  // al crear o después, vía ClassificationPayload.
  categoryId?: number;
  subcategoryId?: number;
  typificationId?: number;
  priority?: TicketPriority;
}

export interface ClassificationPayload {
  categoryId: number;
  subcategoryId: number;
  typificationId: number;
}

export interface TicketListFilters {
  status?: TicketStatusCode;
  priority?: TicketPriority;
  ticketType?: TicketType;
  page?: number;
  limit?: number;
}

export type TicketListScope = 'all' | 'mine' | 'assigned-to-me';

const SCOPE_TO_PATH: Record<TicketListScope, string> = {
  all: '/tickets',
  mine: '/tickets/mine',
  'assigned-to-me': '/tickets/assigned-to-me',
};

export const ticketsApi = {
  list: (scope: TicketListScope, filters: TicketListFilters) =>
    httpClient
      .get<PaginatedResult<Ticket>>(SCOPE_TO_PATH[scope], { params: filters })
      .then((r) => r.data),

  getOne: (id: string) => httpClient.get<Ticket>(`/tickets/${id}`).then((r) => r.data),

  getHistory: (id: string) =>
    httpClient.get<TicketHistoryEvent[]>(`/tickets/${id}/history`).then((r) => r.data),

  getComments: (id: string) =>
    httpClient.get<TicketComment[]>(`/tickets/${id}/comments`).then((r) => r.data),

  create: (payload: CreateTicketPayload) =>
    httpClient.post<Ticket>('/tickets', payload).then((r) => r.data),

  classify: (id: string, payload: ClassificationPayload) =>
    httpClient.patch<Ticket>(`/tickets/${id}`, payload).then((r) => r.data),

  updatePriority: (id: string, priority: TicketPriority) =>
    httpClient.patch<Ticket>(`/tickets/${id}`, { priority }).then((r) => r.data),

  updateTicketType: (id: string, ticketType: TicketType) =>
    httpClient.patch<Ticket>(`/tickets/${id}`, { ticketType }).then((r) => r.data),

  addComment: (id: string, body: string, isInternal: boolean) =>
    httpClient
      .post<TicketComment>(`/tickets/${id}/comments`, { body, isInternal })
      .then((r) => r.data),

  changeStatus: (id: string, toStatus: TicketStatusCode, reason: string) =>
    httpClient.patch<Ticket>(`/tickets/${id}/status`, { toStatus, reason }).then((r) => r.data),

  assign: (id: string, technicianId: string, reason?: string) =>
    httpClient.patch<Ticket>(`/tickets/${id}/assign`, { technicianId, reason }).then((r) => r.data),
};
