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
    // orderBy(displayOrder) para que el donut mantenga siempre el mismo
    // orden de gajos (Abierto→Asignado→...) en vez del orden arbitrario
    // que devuelve el GROUP BY.
    const byStatus = await this.ticketsRepo
      .createQueryBuilder('t')
      .innerJoin('t.status', 'status')
      .select('status.code', 'status')
      .addSelect('COUNT(*)', 'total')
      .groupBy('status.code')
      .addGroupBy('status.displayOrder')
      .orderBy('status.displayOrder', 'ASC')
      .getRawMany();

    const byPriority = await this.ticketsRepo
      .createQueryBuilder('t')
      .select('t.priority', 'priority')
      .addSelect('COUNT(*)', 'total')
      .groupBy('t.priority')
      .getRawMany();

    const byType = await this.ticketsRepo
      .createQueryBuilder('t')
      .select('t.ticketType', 'ticketType')
      .addSelect('COUNT(*)', 'total')
      .groupBy('t.ticketType')
      .orderBy('t.ticketType', 'ASC')
      .getRawMany();

    // LEFT JOIN porque la clasificación es opcional (ver Ticket.category);
    // se agrupa por el nombre real (no por el COALESCE) para que los NULL
    // caigan en un solo grupo "Sin clasificar".
    const byCategory = await this.ticketsRepo
      .createQueryBuilder('t')
      .leftJoin('t.category', 'category')
      .select("COALESCE(category.name, 'Sin clasificar')", 'category')
      .addSelect('COUNT(*)', 'total')
      .groupBy('category.name')
      .orderBy('total', 'DESC')
      .getRawMany();

    // Igual que category: assignedArea es opcional (se hereda del solicitante
    // solo si este ya tiene área asignada), así que hoy la mayoría cae en
    // "Sin área" hasta que se asignen áreas a los usuarios.
    const byArea = await this.ticketsRepo
      .createQueryBuilder('t')
      .leftJoin('t.assignedArea', 'area')
      .select("COALESCE(area.name, 'Sin área')", 'area')
      .addSelect('COUNT(*)', 'total')
      .groupBy('area.name')
      .orderBy('total', 'DESC')
      .getRawMany();

    // resolvedAt >= createdAt descarta datos inconsistentes (p.ej. resolved_at
    // editado manualmente para pruebas) que arrastrarían el promedio a negativo.
    const avgResolutionHours = await this.ticketsRepo
      .createQueryBuilder('t')
      .select('AVG(EXTRACT(EPOCH FROM (t.resolvedAt - t.createdAt)) / 3600)', 'avgHours')
      .where('t.resolvedAt IS NOT NULL')
      .andWhere('t.resolvedAt >= t.createdAt')
      .getRawOne();

    return {
      byStatus,
      byPriority,
      byType,
      byCategory,
      byArea,
      avgResolutionHours: avgResolutionHours?.avgHours ?? null,
    };
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
