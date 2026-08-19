import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { Roles } from '@common/decorators/roles.decorator';

// Todo el módulo de reportes es exclusivo de Administrador.
@Controller('reports')
@Roles('ADMIN')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('tickets.xlsx')
  async ticketsExcel(@Query() query: ReportsQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.generateTicketsExcel(query);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tickets-${dateStamp()}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('tickets/:id/pdf')
  async ticketPdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const buffer = await this.reportsService.generateTicketPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ticket-${id}.pdf"`,
    });
    res.send(buffer);
  }

  @Get('summary.pdf')
  async summaryPdf(@Query() query: ReportsQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.generateSummaryPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="resumen-gerencial-${dateStamp()}.pdf"`,
    });
    res.send(buffer);
  }
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
