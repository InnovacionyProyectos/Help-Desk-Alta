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
import { Exclude, Expose } from 'class-transformer';
import { Role } from './role.entity';
import { Area } from './area.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'citext' })
  email: string;

  @Exclude({ toPlainOnly: true }) // nunca se serializa hacia el cliente
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'first_name', type: 'varchar', length: 80 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 80 })
  lastName: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string;

  @ManyToOne(() => Role, (role) => role.users, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Area, { nullable: true, eager: true })
  @JoinColumn({ name: 'area_id' })
  area?: Area;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'must_change_password', default: true })
  mustChangePassword: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'failed_login_attempts', type: 'smallint', default: 0 })
  failedLoginAttempts: number;

  // Tipado explícito como `Date | null` (no `undefined`): TypeORM solo emite
  // `SET locked_until = NULL` cuando el valor asignado es `null`; con
  // `undefined` la columna se omite del UPDATE y el bloqueo nunca se limpia.
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  // @Expose() es necesario porque ClassSerializerInterceptor no incluye
  // getters por defecto; el frontend consume `fullName` directamente.
  @Expose()
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
