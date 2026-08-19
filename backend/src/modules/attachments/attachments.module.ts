import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { AttachmentUploadGuard } from './guards/attachment-upload.guard';
import { TicketAttachment } from '@modules/tickets/entities/ticket-attachment.entity';
import { TicketsModule } from '@modules/tickets/tickets.module';
import { SystemConfigModule } from '@modules/system-config/system-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([TicketAttachment]), TicketsModule, SystemConfigModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentUploadGuard],
})
export class AttachmentsModule {}
