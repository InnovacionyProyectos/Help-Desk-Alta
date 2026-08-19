import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Ticket } from './ticket.entity';

@Entity('ticket_assignment_history')
export class TicketAssignmentHistory {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'from_user_id' })
  fromUser?: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'to_user_id' })
  toUser: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_by' })
  assignedBy: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
