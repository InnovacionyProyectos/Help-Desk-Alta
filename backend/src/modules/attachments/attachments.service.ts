import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID, createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { TicketAttachment } from '@modules/tickets/entities/ticket-attachment.entity';
import { TicketsService } from '@modules/tickets/tickets.service';
import { TicketStatusCode } from '@modules/tickets/enums/ticket-status.enum';
import { AuthenticatedUser } from '@modules/auth/types/authenticated-user.type';

@Injectable()
export class AttachmentsService {
  private readonly storageRoot: string;

  constructor(
    @InjectRepository(TicketAttachment)
    private readonly attachmentsRepo: Repository<TicketAttachment>,
    private readonly ticketsService: TicketsService,
    private readonly configService: ConfigService,
  ) {
    this.storageRoot = this.configService.get<string>('STORAGE_LOCAL_PATH') ?? './uploads';
  }

  async upload(
    ticketId: string,
    file: Express.Multer.File,
    commentId: string | undefined,
    uploader: AuthenticatedUser,
  ): Promise<TicketAttachment> {
    // findOneOrFail ya lanza 403 si un Usuario Final intenta subir a un
    // ticket que no es suyo (mismo chequeo centralizado que usa TicketsService).
    const ticket = await this.ticketsService.findOneOrFail(ticketId, uploader);
    if (ticket.status.code === TicketStatusCode.CLOSED) {
      throw new ForbiddenException('El ticket está cerrado y no se puede modificar');
    }

    const ticketDir = join(this.storageRoot, 'tickets', ticketId);
    await mkdir(ticketDir, { recursive: true });

    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    const storageKey = join('tickets', ticketId, `${randomUUID()}__${safeName}`);
    await writeFile(join(this.storageRoot, storageKey), file.buffer);

    const attachment = this.attachmentsRepo.create({
      ticket: { id: ticketId } as any,
      comment: commentId ? ({ id: commentId } as any) : undefined,
      uploadedBy: { id: uploader.id } as any,
      fileName: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
    });

    return this.attachmentsRepo.save(attachment);
  }

  async findByTicket(ticketId: string, requester: AuthenticatedUser): Promise<TicketAttachment[]> {
    await this.ticketsService.findOneOrFail(ticketId, requester);

    return this.attachmentsRepo.find({
      where: { ticket: { id: ticketId }, deletedAt: IsNull() },
      relations: ['uploadedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getForDownload(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<{ attachment: TicketAttachment; absolutePath: string }> {
    const attachment = await this.attachmentsRepo.findOne({
      where: { id },
      relations: ['ticket', 'ticket.requester'],
    });

    if (!attachment || attachment.deletedAt) {
      throw new NotFoundException(`Adjunto ${id} no encontrado`);
    }

    this.assertCanAccessTicket(attachment.ticket.requester.id, requester);

    return { attachment, absolutePath: join(this.storageRoot, attachment.storageKey) };
  }

  // Usuario Final solo accede a adjuntos de sus propios tickets; Admin/Técnico, a todos.
  private assertCanAccessTicket(ticketRequesterId: string, actor: AuthenticatedUser): void {
    const isOwner = ticketRequesterId === actor.id;
    if (actor.role === 'END_USER' && !isOwner) {
      throw new ForbiddenException('No tiene acceso a los adjuntos de este ticket');
    }
  }
}
