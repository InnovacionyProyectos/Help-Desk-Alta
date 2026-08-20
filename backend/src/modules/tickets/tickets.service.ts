import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository, SelectQueryBuilder } from 'typeorm';
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
import { TicketPriority } from './enums/ticket-priority.enum';
import { ClassificationService } from '@modules/classification/classification.service';
import { AuditService } from '@modules/audit/audit.service';
import { AuthenticatedUser } from '@modules/auth/types/authenticated-user.type';
import { PaginatedResultDto } from '@common/dto/paginated-result.dto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

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
    // El Usuario Final solo diligencia asunto/descripción; la clasificación
    // (si viene) es un caso de uso de Admin/Técnico creando en nombre de
    // alguien. No se aceptan combinaciones parciales (ej. solo categoryId).
    const hasAnyClassification = dto.categoryId || dto.subcategoryId || dto.typificationId;
    const hasFullClassification = dto.categoryId && dto.subcategoryId && dto.typificationId;
    if (hasAnyClassification && !hasFullClassification) {
      throw new BadRequestException(
        'Debe indicar categoría, subcategoría y tipificación juntas, o ninguna',
      );
    }

    const typification = hasFullClassification
      ? await this.classificationService.validateChain(
          dto.categoryId!,
          dto.subcategoryId!,
          dto.typificationId!,
        )
      : undefined;

    const openStatus = await this.statusRepo.findOneOrFail({
      where: { code: TicketStatusCode.OPEN },
    });

    const ticket = this.ticketsRepo.create({
      ticketNumber: await this.generateTicketNumber(),
      subject: dto.subject,
      description: dto.description,
      category: dto.categoryId ? ({ id: dto.categoryId } as any) : undefined,
      subcategory: dto.subcategoryId ? ({ id: dto.subcategoryId } as any) : undefined,
      typification: dto.typificationId ? ({ id: dto.typificationId } as any) : undefined,
      status: openStatus,
      priority: dto.priority ?? typification?.defaultPriority ?? TicketPriority.MEDIUM,
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
   *
   * CLOSED es terminal de verdad: ni Admin ni Técnico pueden reabrirlo o
   * cambiar su estado una vez cerrado (a propósito, sin excepción de rol).
   */
  async changeStatus(
    id: string,
    dto: ChangeTicketStatusDto,
    actor: AuthenticatedUser,
  ): Promise<Ticket> {
    const ticket = await this.findOneOrFail(id, actor);
    const fromStatus = ticket.status;

    if (fromStatus.code === TicketStatusCode.CLOSED) {
      throw new ForbiddenException(
        'El ticket está cerrado; no puede reabrirse ni cambiar de estado',
      );
    }

    const toStatus = await this.statusRepo.findOneOrFail({ where: { code: dto.toStatus } });

    if (actor.role === 'END_USER') {
      if (dto.toStatus !== TicketStatusCode.REOPENED || fromStatus.code !== TicketStatusCode.RESOLVED) {
        throw new ForbiddenException('Un Usuario Final solo puede reabrir tickets resueltos');
      }
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

    // El motivo también queda como comentario (además del historial) porque
    // el timeline es compacto y difícil de leer; el hilo de comentarios da
    // más espacio para revisar la traza de qué pasó con el ticket.
    await this.commentsRepo.save(
      this.commentsRepo.create({
        ticket: { id } as any,
        author: { id: actor.id } as any,
        body: `Cambio de estado: ${fromStatus.name} → ${toStatus.name}\nMotivo: ${dto.reason}`,
        isInternal: false,
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
   * Cierre automático: todo ticket que lleve 24 horas en estado Resuelto
   * pasa a Cerrado sin intervención humana. Corre cada 10 minutos; el
   * margen de hasta 10 min de retraso frente a las 24h exactas es
   * aceptable para este caso de uso.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCloseResolvedTickets(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const dueTickets = await this.ticketsRepo.find({
      where: { status: { code: TicketStatusCode.RESOLVED }, resolvedAt: LessThanOrEqual(cutoff) },
    });

    if (dueTickets.length === 0) return;

    const closedStatus = await this.statusRepo.findOneOrFail({
      where: { code: TicketStatusCode.CLOSED },
    });
    const reason = 'Cierre automático: 24 horas en estado Resuelto sin actividad';

    for (const ticket of dueTickets) {
      const fromStatusId = ticket.status.id;
      ticket.status = closedStatus;
      ticket.closedAt = new Date();
      await this.ticketsRepo.save(ticket);

      await this.statusHistoryRepo.save(
        this.statusHistoryRepo.create({
          ticket: { id: ticket.id } as any,
          fromStatus: { id: fromStatusId } as any,
          toStatus: { id: closedStatus.id } as any,
          changedBy: undefined, // null = acción del sistema
          reason,
        }),
      );

      await this.auditService.record({
        userId: undefined,
        action: 'CHANGE_STATUS',
        entity: 'Ticket',
        entityId: ticket.id,
        oldValues: { status: TicketStatusCode.RESOLVED },
        newValues: { status: TicketStatusCode.CLOSED, reason },
      });
    }

    this.logger.log(`Cierre automático aplicado a ${dueTickets.length} ticket(s) resuelto(s) hace 24h+`);
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
        by: e.changedBy?.fullName ?? 'Sistema',
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
