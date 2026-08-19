import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

export type RoleCode = 'ADMIN' | 'TECHNICIAN' | 'END_USER';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('increment', { type: 'smallint' })
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: RoleCode;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => User, (user) => user.role)
  users: User[];
}
