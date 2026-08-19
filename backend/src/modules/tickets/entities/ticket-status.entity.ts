import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TicketStatusCode } from '../enums/ticket-status.enum';

@Entity('ticket_statuses')
export class TicketStatus {
  @PrimaryGeneratedColumn('increment', { type: 'smallint' })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: TicketStatusCode;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ name: 'display_order', type: 'smallint', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_final', default: false })
  isFinal: boolean;
}
