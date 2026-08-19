import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import PdfPrinter = require('pdfmake/src/printer');
import { join } from 'path';
import { Ticket } from '@modules/tickets/entities/ticket.entity';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { TicketPriority } from '@modules/tickets/enums/ticket-priority.enum';
import { TicketStatusCode } from '@modules/tickets/enums/ticket-status.enum';

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'Baja',
  [TicketPriority.MEDIUM]: 'Media',
  [TicketPriority.HIGH]: 'Alta',
  [TicketPriority.CRITICAL]: 'Crítica',
};

const STATUS_LABELS: Record<TicketStatusCode, string> = {
  [TicketStatusCode.OPEN]: 'Abierto',
  [TicketStatusCode.ASSIGNED]: 'Asignado',
  [TicketStatusCode.IN_PROGRESS]: 'En Proceso',
  [TicketStatusCode.ON_HOLD]: 'En Espera',
  [TicketStatusCode.RESOLVED]: 'Resuelto',
  [TicketStatusCode.CLOSED]: 'Cerrado',
  [TicketStatusCode.REOPENED]: 'Reabierto',
};

const FONTS_DIR = join(process.cwd(), 'assets', 'fonts');

@Injectable()
export class ReportsService {
  // Ver assets/fonts/README.md: pdfmake requiere archivos .ttf reales en disco.
  private readonly printer = new PdfPrinter({
    Roboto: {
      normal: join(FONTS_DIR, 'Roboto-Regular.ttf'),
      bold: join(FONTS_DIR, 'Roboto-Medium.ttf'),
      italics: join(FONTS_DIR, 'Roboto-Italic.ttf'),
      bolditalics: join(FONTS_DIR, 'Roboto-MediumItalic.ttf'),
    },
  });

  constructor(@InjectRepository(Ticket) private readonly ticketsRepo: Repository<Ticket>) {}

  private queryTickets(filters: ReportsQueryDto) {
    const qb = this.ticketsRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.category', 'category')
      .leftJoinAndSelect('ticket.subcategory', 'subcategory')
      .leftJoinAndSelect('ticket.typification', 'typification')
      .leftJoinAndSelect('ticket.status', 'status')
      .leftJoinAndSelect('ticket.requester', 'requester')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .leftJoinAndSelect('ticket.assignedArea', 'assignedArea')
      .orderBy('ticket.createdAt', 'DESC');

    if (filters.dateFrom) qb.andWhere('ticket.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    if (filters.dateTo) qb.andWhere('ticket.createdAt <= :dateTo', { dateTo: filters.dateTo });
    if (filters.status) qb.andWhere('status.code = :status', { status: filters.status });
    if (filters.areaId) qb.andWhere('assignedArea.id = :areaId', { areaId: filters.areaId });

    return qb.getMany();
  }

  // ===================================================================
  // Excel — bandeja de tickets filtrada por fecha / área / estado
  // ===================================================================

  async generateTicketsExcel(filters: ReportsQueryDto): Promise<Buffer> {
    const tickets = await this.queryTickets(filters);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Help Desk';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Tickets');
    sheet.columns = [
      { header: 'Ticket #', key: 'ticketNumber', width: 16 },
      { header: 'Asunto', key: 'subject', width: 40 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Subcategoría', key: 'subcategory', width: 20 },
      { header: 'Tipificación', key: 'typification', width: 22 },
      { header: 'Prioridad', key: 'priority', width: 12 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Solicitante', key: 'requester', width: 24 },
      { header: 'Asignado a', key: 'assignedTo', width: 24 },
      { header: 'Área', key: 'area', width: 18 },
      { header: 'Creado', key: 'createdAt', width: 20 },
      { header: 'Resuelto', key: 'resolvedAt', width: 20 },
      { header: 'Cerrado', key: 'closedAt', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: 'A1', to: 'M1' };

    for (const t of tickets) {
      sheet.addRow({
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        category: t.category?.name,
        subcategory: t.subcategory?.name,
        typification: t.typification?.name,
        priority: PRIORITY_LABELS[t.priority] ?? t.priority,
        status: t.status?.name,
        requester: t.requester?.fullName,
        assignedTo: t.assignedTo?.fullName ?? '',
        area: t.assignedArea?.name ?? '',
        createdAt: formatDate(t.createdAt),
        resolvedAt: formatDate(t.resolvedAt),
        closedAt: formatDate(t.closedAt),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ===================================================================
  // PDF — ficha individual de ticket
  // ===================================================================

  async generateTicketPdf(ticketId: string): Promise<Buffer> {
    const ticket = await this.ticketsRepo.findOne({
      where: { id: ticketId },
      relations: ['requester', 'assignedTo', 'assignedArea'],
    });
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} no encontrado`);

    const docDefinition = {
      content: [
        { text: 'Help Desk · Ficha de Ticket', style: 'eyebrow' },
        { text: `${ticket.ticketNumber} — ${ticket.subject}`, style: 'header' },
        {
          columns: [
            { text: [{ text: 'Estado: ', bold: true }, STATUS_LABELS[ticket.status.code]] },
            { text: [{ text: 'Prioridad: ', bold: true }, PRIORITY_LABELS[ticket.priority]] },
          ],
          margin: [0, 6, 0, 14] as [number, number, number, number],
        },
        { text: 'Descripción', style: 'sectionTitle' },
        { text: ticket.description, margin: [0, 0, 0, 14] as [number, number, number, number] },
        { text: 'Detalle', style: 'sectionTitle' },
        {
          table: {
            widths: ['30%', '70%'],
            body: [
              ['Categoría', ticket.category?.name ?? 'Sin clasificar'],
              ['Subcategoría', ticket.subcategory?.name ?? '—'],
              ['Tipificación', ticket.typification?.name ?? '—'],
              ['Solicitante', ticket.requester.fullName],
              ['Área', ticket.assignedArea?.name ?? '—'],
              ['Asignado a', ticket.assignedTo?.fullName ?? 'Sin asignar'],
              ['Creado', formatDate(ticket.createdAt)],
              ['Resuelto', formatDate(ticket.resolvedAt) || '—'],
              ['Cerrado', formatDate(ticket.closedAt) || '—'],
              ['Reaperturas', String(ticket.reopenedCount)],
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
      styles: {
        eyebrow: { fontSize: 9, color: '#626b78', margin: [0, 0, 0, 2] },
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
        sectionTitle: { fontSize: 12, bold: true, margin: [0, 10, 0, 6] },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10 },
    };

    return this.renderPdf(docDefinition);
  }

  // ===================================================================
  // PDF — resumen gerencial (rango de fechas)
  // ===================================================================

  async generateSummaryPdf(filters: ReportsQueryDto): Promise<Buffer> {
    const tickets = await this.queryTickets(filters);

    const byStatus = groupAndCount(tickets, (t) => STATUS_LABELS[t.status.code]);
    const byPriority = groupAndCount(tickets, (t) => PRIORITY_LABELS[t.priority]);
    const resolved = tickets.filter((t) => t.resolvedAt);
    const avgResolutionHours = resolved.length
      ? resolved.reduce((sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()), 0) /
        resolved.length /
        3_600_000
      : null;

    const rangeLabel = `${filters.dateFrom ?? 'inicio'} — ${filters.dateTo ?? 'hoy'}`;

    const docDefinition = {
      content: [
        { text: 'Help Desk · Resumen Gerencial', style: 'eyebrow' },
        { text: `Periodo: ${rangeLabel}`, style: 'header' },
        {
          columns: [
            statCard('Total de tickets', String(tickets.length)),
            statCard(
              'Tiempo prom. de resolución',
              avgResolutionHours !== null ? `${avgResolutionHours.toFixed(1)}h` : '—',
            ),
          ],
          margin: [0, 10, 0, 16] as [number, number, number, number],
        },
        { text: 'Distribución por estado', style: 'sectionTitle' },
        breakdownTable(byStatus),
        { text: 'Distribución por prioridad', style: 'sectionTitle' },
        breakdownTable(byPriority),
        { text: 'Detalle de tickets', style: 'sectionTitle' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto'],
            body: [
              [
                { text: 'Ticket #', bold: true },
                { text: 'Asunto', bold: true },
                { text: 'Prioridad', bold: true },
                { text: 'Estado', bold: true },
              ],
              ...tickets.map((t) => [
                t.ticketNumber,
                t.subject,
                PRIORITY_LABELS[t.priority],
                STATUS_LABELS[t.status.code],
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          fontSize: 8,
        },
      ],
      styles: {
        eyebrow: { fontSize: 9, color: '#626b78', margin: [0, 0, 0, 2] },
        header: { fontSize: 16, bold: true },
        sectionTitle: { fontSize: 12, bold: true, margin: [0, 12, 0, 6] },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10 },
    };

    return this.renderPdf(docDefinition);
  }

  private renderPdf(docDefinition: Record<string, unknown>): Promise<Buffer> {
    const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}

function formatDate(date?: Date): string {
  return date ? new Date(date).toLocaleString('es-CO') : '';
}

function groupAndCount<T>(items: T[], keyFn: (item: T) => string): { label: string; total: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, total]) => ({ label, total }));
}

function statCard(label: string, value: string) {
  return {
    stack: [
      { text: label, fontSize: 9, color: '#626b78' },
      { text: value, fontSize: 18, bold: true },
    ],
  };
}

function breakdownTable(rows: { label: string; total: number }[]) {
  return {
    table: {
      widths: ['*', 'auto'],
      body: [
        [{ text: 'Categoría', bold: true }, { text: 'Total', bold: true }],
        ...rows.map((r) => [r.label, String(r.total)]),
      ],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 10] as [number, number, number, number],
  };
}
