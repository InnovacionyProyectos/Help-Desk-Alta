import { SetMetadata } from '@nestjs/common';

export const AUDIT_ENTITY_KEY = 'auditEntity';

/**
 * Marca un método de controlador para que AuditInterceptor registre
 * automáticamente la acción en audit_logs. Ej: @Audit('Ticket')
 */
export const Audit = (entity: string) => SetMetadata(AUDIT_ENTITY_KEY, entity);
