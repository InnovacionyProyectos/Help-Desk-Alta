import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './entities/audit-log.entity';

export interface RecordAuditInput {
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(input: RecordAuditInput): Promise<void> {
    await this.auditRepo.save(this.auditRepo.create(input));
  }

  findByEntity(entity: string, entityId: string): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { entity, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
