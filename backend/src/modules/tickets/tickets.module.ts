import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { Ticket } from './entities/ticket.entity';
import { TicketStatus } from './entities/ticket-status.entity';
import { TicketComment } from './entities/ticket-comment.entity';
import { TicketAttachment } from './entities/ticket-attachment.entity';
import { TicketStatusHistory } from './entities/ticket-status-history.entity';
import { TicketAssignmentHistory } from './entities/ticket-assignment-history.entity';
import { ClassificationModule } from '@modules/classification/classification.module';
import { AuditModule } from '@modules/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketStatus,
      TicketComment,
      TicketAttachment,
      TicketStatusHistory,
      TicketAssignmentHistory,
    ]),
    ClassificationModule,
    AuditModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
