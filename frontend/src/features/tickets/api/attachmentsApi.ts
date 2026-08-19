import { httpClient } from '@shared/api/httpClient';
import { downloadFile } from '@shared/api/downloadFile';
import { TicketAttachment } from '@shared/types/ticket';

export const attachmentsApi = {
  listByTicket: (ticketId: string) =>
    httpClient
      .get<TicketAttachment[]>(`/tickets/${ticketId}/attachments`)
      .then((r) => r.data),

  upload: (ticketId: string, file: File, commentId?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (commentId) form.append('commentId', commentId);
    // No se fija Content-Type manualmente: el navegador/axios deben calcular
    // el boundary del multipart automáticamente.
    return httpClient
      .post<TicketAttachment>(`/tickets/${ticketId}/attachments`, form)
      .then((r) => r.data);
  },

  download: (attachment: TicketAttachment) =>
    downloadFile(`/attachments/${attachment.id}/download`, attachment.fileName),
};
