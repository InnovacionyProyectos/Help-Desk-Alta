import { downloadFile } from '@shared/api/downloadFile';
import { TicketStatusCode } from '@shared/types/ticket';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: TicketStatusCode;
  areaId?: number;
}

export const reportsApi = {
  downloadTicketsExcel: (filters: ReportFilters) =>
    downloadFile('/reports/tickets.xlsx', 'tickets.xlsx', filters as Record<string, unknown>),

  downloadSummaryPdf: (filters: ReportFilters) =>
    downloadFile('/reports/summary.pdf', 'resumen-gerencial.pdf', filters as Record<string, unknown>),

  downloadTicketPdf: (ticketId: string, ticketNumber: string) =>
    downloadFile(`/reports/tickets/${ticketId}/pdf`, `${ticketNumber}.pdf`),
};
