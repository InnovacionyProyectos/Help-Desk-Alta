import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CHANGE_STATUS'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ASSIGN';

@Entity('audit_logs')
@Index(['entity', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  // null = acción ejecutada por el sistema (job, seed, etc.)
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 20 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 60 })
  entity: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 60 })
  entityId: string;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: Record<string, unknown>;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: Record<string, unknown>;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
