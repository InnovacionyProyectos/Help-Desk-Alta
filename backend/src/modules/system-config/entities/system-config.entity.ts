import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Fila única (singleton, id = 1) con los parámetros globales del sistema.
@Entity('system_config')
export class SystemConfig {
  @PrimaryColumn({ type: 'smallint', default: 1 })
  id: number;

  @Column({ name: 'company_name', type: 'varchar', length: 150, default: '' })
  companyName: string;

  @Column({ name: 'company_logo_url', type: 'varchar', length: 500, nullable: true })
  companyLogoUrl?: string;

  @Column({ name: 'support_email', type: 'varchar', length: 150, nullable: true })
  supportEmail?: string;

  @Column({ name: 'max_attachment_size_mb', type: 'int', default: 10 })
  maxAttachmentSizeMb: number;

  @Column({ name: 'allowed_extensions', type: 'text', array: true })
  allowedExtensions: string[];

  @Column({ name: 'ticket_prefix', type: 'varchar', length: 10, default: 'HD' })
  ticketPrefix: string;

  @Column({ name: 'ticket_number_format', type: 'varchar', length: 50 })
  ticketNumberFormat: string;

  @Column({ name: 'smtp_host', type: 'varchar', length: 150, nullable: true })
  smtpHost?: string;

  @Column({ name: 'smtp_port', type: 'int', nullable: true })
  smtpPort?: number;

  @Column({ name: 'smtp_user', type: 'varchar', length: 150, nullable: true })
  smtpUser?: string;

  // Nunca se expone al frontend (ver system-config.controller / serialización)
  @Column({ name: 'smtp_password_encrypted', type: 'varchar', length: 255, nullable: true })
  smtpPasswordEncrypted?: string;

  @Column({ name: 'smtp_use_tls', default: true })
  smtpUseTls: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
