import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '@modules/tickets/entities/ticket.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketsRepo: Repository<Ticket>,
  ) {}

  /** Métricas globales: volumen por estado, prioridad y tiempo promedio de resolución. */
  async getAdminMetrics() {
    const byStatus = await this.ticketsRepo
      .createQueryBuilder('t')
      .innerJoin('t.status', 'status')
      .select('status.code', 'status')
      .addSelect('COUNT(*)', 'total')
      .groupBy('status.code')
      .getRawMany();

    const byPriority = await this.ticketsRepo
      .createQueryBuilder('t')
      .select('t.priority', 'priority')
      .addSelect('COUNT(*)', 'total')
      .groupBy('t.priority')
      .getRawMany();

    // resolvedAt >= createdAt descarta datos inconsistentes (p.ej. resolved_at
    // editado manualmente para pruebas) que arrastrarían el promedio a negativo.
    const avgResolutionHours = await this.ticketsRepo
      .createQueryBuilder('t')
      .select('AVG(EXTRACT(EPOCH FROM (t.resolvedAt - t.createdAt)) / 3600)', 'avgHours')
      .where('t.resolvedAt IS NOT NULL')
      .andWhere('t.resolvedAt >= t.createdAt')
      .getRawOne();

    return { byStatus, byPriority, avgResolutionHours: avgResolutionHours?.avgHours ?? null };
  }

  /** Vista del Técnico: mis tickets asignados vs. pendientes del equipo (sin asignar). */
  async getTechnicianMetrics(technicianId: string) {
    const [myTickets, teamPending] = await Promise.all([
      this.ticketsRepo.find({
        where: { assignedTo: { id: technicianId } },
        order: { priority: 'DESC', createdAt: 'ASC' },
      }),
      this.ticketsRepo
        .createQueryBuilder('t')
        .where('t.assignedTo IS NULL')
        .orderBy('t.priority', 'DESC')
        .addOrderBy('t.createdAt', 'ASC')
        .getMany(),
    ]);

    return { myTickets, teamPending };
  }

  /** Vista del Usuario Final: estado de sus solicitudes activas. */
  async getEndUserMetrics(requesterId: string) {
    const tickets = await this.ticketsRepo.find({
      where: { requester: { id: requesterId } },
      order: { createdAt: 'DESC' },
    });

    return { tickets };
  }
}
