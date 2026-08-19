import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Area } from '@modules/users/entities/area.entity';
import { TicketCategory } from '@modules/classification/entities/ticket-category.entity';
import { TicketSubcategory } from '@modules/classification/entities/ticket-subcategory.entity';
import { TicketTypification } from '@modules/classification/entities/ticket-typification.entity';
import { TicketStatus } from './ticket-status.entity';
import { TicketPriority } from '../enums/ticket-priority.enum';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'ticket_number', type: 'varchar', length: 20 })
  ticketNumber: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @ManyToOne(() => TicketCategory, { eager: true })
  @JoinColumn({ name: 'category_id' })
  category: TicketCategory;

  @ManyToOne(() => TicketSubcategory, { eager: true })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: TicketSubcategory;

  @ManyToOne(() => TicketTypification, { eager: true })
  @JoinColumn({ name: 'typification_id' })
  typification: TicketTypification;

  @ManyToOne(() => TicketStatus, { eager: true })
  @JoinColumn({ name: 'status_id' })
  status: TicketStatus;

  @Column({ type: 'varchar', length: 10, default: TicketPriority.MEDIUM })
  priority: TicketPriority;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requester_id' })
  requester: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo?: User;

  @ManyToOne(() => Area, { nullable: true })
  @JoinColumn({ name: 'assigned_area_id' })
  assignedArea?: Area;

  // FK opcional -> integración futura con módulo ITAM (tabla `assets`)
  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId?: string;

  // FK opcional -> integración futura con módulo SLA (tabla `sla_contracts`)
  @Column({ name: 'sla_contract_id', type: 'int', nullable: true })
  slaContractId?: number;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt?: Date;

  @Column({ name: 'resolution_summary', type: 'text', nullable: true })
  resolutionSummary?: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt?: Date;

  @Column({ name: 'reopened_count', type: 'smallint', default: 0 })
  reopenedCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
