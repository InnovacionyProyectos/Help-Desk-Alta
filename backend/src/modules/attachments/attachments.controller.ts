import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { AttachmentUploadGuard } from './guards/attachment-upload.guard';
import { RequestWithFile } from './types/request-with-file.type';
import { Audit } from '@common/decorators/audit.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@modules/auth/types/authenticated-user.type';

@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  // AttachmentUploadGuard parsea el multipart y valida tamaño/extensión
  // contra system_config antes de que este método se ejecute.
  @Post('tickets/:ticketId/attachments')
  @UseGuards(AttachmentUploadGuard)
  @Audit('TicketAttachment')
  upload(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Req() request: RequestWithFile,
    @Body('commentId') commentId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentsService.upload(ticketId, request.file!, commentId, user);
  }

  @Get('tickets/:ticketId/attachments')
  list(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentsService.findByTicket(ticketId, user);
  }

  @Get('attachments/:id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { attachment, absolutePath } = await this.attachmentsService.getForDownload(id, user);
    res.download(absolutePath, attachment.fileName);
  }
}
