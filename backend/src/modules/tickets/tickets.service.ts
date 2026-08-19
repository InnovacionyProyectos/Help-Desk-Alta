import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketStatus } from './entities/ticket-status.entity';
import { TicketComment } from './entities/ticket-comment.entity';
import { TicketStatusHistory } from './entities/ticket-status-history.entity';
import { TicketAssignmentHistory } from './entities/ticket-assignment-history.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { ChangeTicketStatusDto } from './dto/change-status.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { FindTicketsQueryDto } from './dto/find-tickets-query.dto';
import { TicketStatusCode } from './enums/ticket-status.enum';
import { ClassificationService } from '@modules/classification/classification.service';
import { AuditService } from '@modules/audit/audit.service';
import { AuthenticatedUser } from '@modules/auth/types/authenticated-user.type';
import { PaginatedResultDto } from '@common/dto/paginated-result.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketsRepo: Repository<Ticket>,
    @InjectRepository(TicketStatus) private readonly statusRepo: Repository<TicketStatus>,
    @InjectRepository(TicketComment) private readonly commentsRepo: Repository<TicketComment>,
    @InjectRepository(TicketStatusHistory)
    private readonly statusHistoryRepo: Repository<TicketStatusHistory>,
    @InjectRepository(TicketAssignmentHistory)
    private readonly assignmentHistoryRepo: Repository<TicketAssignmentHistory>,
    private readonly classificationService: ClassificationService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateTicketDto, requester: AuthenticatedUser): Promise<Ticket> {
    const typification = await this.classificationService.validateChain(
      dto.categoryId,
      dto.subcategoryId,
      dto.typificationId,
    );

    const openStatus = await this.statusRepo.findOneOrFail({
      where: { code: TicketStatusCode.OPEN },
    });

    const ticket = this.ticketsRepo.create({
      ticketNumber: await this.generateTicketNumber(),
      subject: dto.subject,
      description: dto.description,
      category: { id: dto.categoryId } as any,
      subcategory: { id: dto.subcategoryId } as any,
      typification: { id: dto.typificationId } as any,
      status: openStatus,
      priority: dto.priority ?? typification.defaultPriority,
      requester: { id: requester.id } as any,
      // El ticket hereda el área del solicitante por defecto; se usa como
      // dimensión de filtrado en reportes (Excel por área).
      assignedArea: requester.areaId ? ({ id: requester.areaId } as any) : undefined,
      assetId: dto.assetId,
    });

    return this.ticketsRepo.save(ticket);
  }

  /**
   * Consecutivo simple basado en el conteo de tickets del año actual.
   * En producción se recomienda usar la secuencia `ticket_number_seq` del
   * DDL (nextval) dentro de una transacción para garantizar atomicidad
   * bajo concurrencia; aquí se mantiene simplificado para el scaffold.
   */
  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.ticketsRepo.count();
    return `HD-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  findMine(requesterId: string, query: FindTicketsQueryDto): Promise<PaginatedResultDto<Ticket>> {
    return this.findPaginated(query, (qb) =>
      qb.andWhere('requester.id = :requesterId', { requesterId }),
    );
  }

  findAssignedTo(
    technicianId: string,
    query: FindTicketsQueryDto,
  ): Promise<PaginatedResultDto<Ticket>> {
    return this.findPaginated(query, (qb) =>
      qb.andWhere('assignedTo.id = :technicianId', { technicianId }),
    );
  }

  findAll(query: FindTicketsQueryDto): Promise<PaginatedResultDto<Ticket>> {
    return this.findPaginated(query);
  }

  private async findPaginated(
    query: FindTicketsQueryDto,
    scope?: (qb: SelectQueryBuilder<Ticket>) => void,
  ): Promise<PaginatedResultDto<Ticket>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.ticketsRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.category', 'category')
      .leftJoinAndSelect('ticket.subcategory', 'subcategory')
      .leftJoinAndSelect('ticket.typification', 'typification')
      .leftJoinAndSelect('ticket.status', 'status')
      .leftJoinAndSelect('ticket.requester', 'requester')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .orderBy('ticket.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) qb.andWhere('status.code = :statusCode', { statusCode: query.status });
    if (query.priority) qb.andWhere('ticket.priority = :priority', { priority: query.priority });
    scope?.(qb);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * `actor` es opcional a propósito: los métodos internos que ya están
   * protegidos por @Roles('ADMIN','TECHNICIAN') a nivel de controlador
   * (assign, update) no necesitan repetir el chequeo de propiedad, porque
   * un Usuario Final nunca llega a ejecutarlos. Los métodos alcanzables por
   * Usuario Final (detalle, historial, comentarios, reapertura) SIEMPRE
   * deben pasar el actor para que se valide `requester_id === actor.id`.
   */
  async findOneOrFail(id: string, actor?: AuthenticatedUser): Promise<Ticket> {
    // category/subcategory/typification/status son eager en la entidad;
    // requester/assignedTo deben pedirse explícitamente.
    const ticket = await this.ticketsRepo.findOne({
      where: { id },
      relations: ['requester', 'assignedTo', 'assignedArea'],
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} no encontrado`);
    if (actor) this.assertCanAccessTicket(ticket, actor);
    return ticket;
  }

  private assertCanAccessTicket(ticket: Ticket, actor: AuthenticatedUser): void {
    if (actor.role === 'END_USER' && ticket.requester.id !== actor.id) {
      throw new ForbiddenException('No tiene acceso a este ticket');
    }
  }

  async update(id: string, dto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.findOneOrFail(id);

    if (dto.categoryId && dto.subcategoryId && dto.typificationId) {
      await this.classificationService.validateChain(
        dto.categoryId,
        dto.subcategoryId,
        dto.typificationId,
      );
      ticket.category = { id: dto.categoryId } as any;
      ticket.subcategory = { id: dto.subcategoryId } as any;
      ticket.typification = { id: dto.typificationId } as any;
    }

    if (dto.subject) ticket.subject = dto.subject;
    if (dto.description) ticket.description = dto.description;
    if (dto.priority) ticket.priority = dto.priority;

    return this.ticketsRepo.save(ticket);
  }

  async assign(id: string, dto: AssignTicketDto, assignedBy: AuthenticatedUser): Promise<Ticket> {
    const ticket = await this.findOneOrFail(id);
    const assignedStatus = await this.statusRepo.findOneOrFail({
      where: { code: TicketStatusCode.ASSIGNED },
    });

    const previousAssignee = ticket.assignedTo?.id;
    ticket.assignedTo = { id: dto.technicianId } as any;
    ticket.status = assignedStatus;
    const saved = await this.ticketsRepo.save(ticket);

    await this.assignmentHistoryRepo.save(
      this.assignmentHistoryRepo.create({
        ticket: { id } as any,
        fromUser: previousAssignee ? ({ id: previousAssignee } as any) : undefined,
        toUser: { id: dto.technicianId } as any,
        assignedBy: { id: assignedBy.id } as any,
        reason: dto.reason,
      }),
    );

    await this.auditService.record({
      userId: assignedBy.id,
      action: 'ASSIGN',
      entity: 'Ticket',
      entityId: id,
      oldValues: { assignedTo: previousAssignee ?? null },
      newValues: { assignedTo: dto.technicianId, reason: dto.reason },
    });

    return saved;
  }

  /**
   * Cambia el estado del ticket. La validez de la transición (qué estados
   * pueden seguir a cuáles, y qué roles pueden ejecutarla) se controla en
   * la tabla `ticket_status_transitions`, no en código, para que el Admin
   * pueda ajustar el flujo sin desplegar una nueva versión del backend.
   *
   * Este endpoint es alcanzable por Usuario Final (a diferencia de assign/
   * update) porque es la única vía para que reabra SU PROPIO ticket; por
   * eso siempre se resuelve el ticket con `actor` para aplicar el chequeo
   * de propiedad, y se restringe explícitamente qué transición puede pedir.
   */
  async changeStatus(
    id: string,
    dto: ChangeTicketStatusDto,
    actor: AuthenticatedUser,
  ): Promise<Ticket> {
    const ticket = await this.findOneOrFail(id, actor);
    const fromStatus = ticket.status;
    const toStatus = await this.statusRepo.findOneOrFail({ where: { code: dto.toStatus } });

    if (actor.role === 'END_USER') {
      const canReopen = fromStatus.isFinal || fromStatus.code === TicketStatusCode.RESOLVED;
      if (dto.toStatus !== TicketStatusCode.REOPENED || !canReopen) {
        throw new ForbiddenException(
          'Un Usuario Final solo puede reabrir tickets resueltos o cerrados',
        );
      }
    } else if (fromStatus.isFinal && actor.role !== 'ADMIN' && dto.toStatus !== TicketStatusCode.REOPENED) {
      throw new ForbiddenException('El ticket está cerrado; solo puede reabrirse');
    }

    ticket.status = toStatus;
    if (dto.toStatus === TicketStatusCode.RESOLVED) ticket.resolvedAt = new Date();
    if (dto.toStatus === TicketStatusCode.CLOSED) ticket.closedAt = new Date();
    if (dto.toStatus === TicketStatusCode.REOPENED) ticket.reopenedCount += 1;

    const saved = await this.ticketsRepo.save(ticket);

    await this.statusHistoryRepo.save(
      this.statusHistoryRepo.create({
        ticket: { id } as any,
        fromStatus: { id: fromStatus.id } as any,
        toStatus: { id: toStatus.id } as any,
        changedBy: { id: actor.id } as any,
        reason: dto.reason,
      }),
    );

    await this.auditService.record({
      userId: actor.id,
      action: 'CHANGE_STATUS',
      entity: 'Ticket',
      entityId: id,
      oldValues: { status: fromStatus.code },
      newValues: { status: toStatus.code, reason: dto.reason },
    });

    return saved;
  }

  /**
   * Línea de tiempo combinada (cambios de estado + reasignaciones) para la
   * vista de detalle del ticket, ordenada cronológicamente.
   */
  async getHistory(ticketId: string, actor: AuthenticatedUser) {
    await this.findOneOrFail(ticketId, actor);

    const [statusEvents, assignmentEvents] = await Promise.all([
      this.statusHistoryRepo.find({
        where: { ticket: { id: ticketId } },
        relations: ['fromStatus', 'toStatus', 'changedBy'],
        order: { createdAt: 'ASC' },
      }),
      this.assignmentHistoryRepo.find({
        where: { ticket: { id: ticketId } },
        relations: ['fromUser', 'toUser', 'assignedBy'],
        order: { createdAt: 'ASC' },
      }),
    ]);

    const timeline = [
      ...statusEvents.map((e) => ({
        type: 'STATUS_CHANGE' as const,
        createdAt: e.createdAt,
        from: e.fromStatus?.name,
        to: e.toStatus.name,
        by: e.changedBy.fullName,
        reason: e.reason,
      })),
      ...assignmentEvents.map((e) => ({
        type: 'ASSIGNMENT' as const,
        createdAt: e.createdAt,
        from: e.fromUser?.fullName,
        to: e.toUser.fullName,
        by: e.assignedBy.fullName,
        reason: e.reason,
      })),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return timeline;
  }

  async addComment(
    ticketId: string,
    dto: CreateCommentDto,
    author: AuthenticatedUser,
  ): Promise<TicketComment> {
    await this.findOneOrFail(ticketId, author);

    // Un Usuario Final nunca puede publicar comentarios internos.
    const isInternal = author.role === 'END_USER' ? false : (dto.isInternal ?? false);

    const comment = this.commentsRepo.create({
      ticket: { id: ticketId } as any,
      author: { id: author.id } as any,
      body: dto.body,
      isInternal,
    });

    return this.commentsRepo.save(comment);
  }

  async findComments(ticketId: string, requester: AuthenticatedUser): Promise<TicketComment[]> {
    await this.findOneOrFail(ticketId, requester);

    const visibleToRequester = requester.role === 'END_USER';
    return this.commentsRepo.find({
      where: visibleToRequester
        ? { ticket: { id: ticketId }, isInternal: false }
        : { ticket: { id: ticketId } },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });
  }
}
