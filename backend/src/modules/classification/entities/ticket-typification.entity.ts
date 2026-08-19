import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TicketSubcategory } from './ticket-subcategory.entity';
import { TicketPriority } from '@modules/tickets/enums/ticket-priority.enum';

@Entity('ticket_typifications')
export class TicketTypification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TicketSubcategory, (sub) => sub.typifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: TicketSubcategory;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  code?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({
    name: 'default_priority',
    type: 'varchar',
    length: 10,
    default: TicketPriority.MEDIUM,
  })
  defaultPriority: TicketPriority;

  @Column({ name: 'display_order', type: 'smallint', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
