import { httpClient } from '@shared/api/httpClient';
import { Ticket, TicketPriority, TicketStatusCode, TicketType } from '@shared/types/ticket';

export interface AdminMetrics {
  byStatus: { status: TicketStatusCode; total: string }[];
  byPriority: { priority: TicketPriority; total: string }[];
  byType: { ticketType: TicketType; total: string }[];
  byCategory: { category: string; total: string }[];
  byArea: { area: string; total: string }[];
  avgResolutionHours: string | null;
}

export interface TechnicianMetrics {
  myTickets: Ticket[];
  teamPending: Ticket[];
}

export interface EndUserMetrics {
  tickets: Ticket[];
}

export const dashboardApi = {
  getAdmin: () => httpClient.get<AdminMetrics>('/dashboard/admin').then((r) => r.data),
  getTechnician: () => httpClient.get<TechnicianMetrics>('/dashboard/technician').then((r) => r.data),
  getEndUser: () => httpClient.get<EndUserMetrics>('/dashboard/me').then((r) => r.data),
};
