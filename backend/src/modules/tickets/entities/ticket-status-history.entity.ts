import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Ticket } from './ticket.entity';
import { TicketStatus } from './ticket-status.entity';

@Entity('ticket_status_history')
export class TicketStatusHistory {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @ManyToOne(() => TicketStatus, { nullable: true })
  @JoinColumn({ name: 'from_status_id' })
  fromStatus?: TicketStatus;

  @ManyToOne(() => TicketStatus)
  @JoinColumn({ name: 'to_status_id' })
  toStatus: TicketStatus;

  // Nulo = acción automática del sistema (ej. cierre a 24h de estar Resuelto).
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changedBy?: User;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
