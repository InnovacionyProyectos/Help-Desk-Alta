import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AUDIT_ENTITY_KEY } from '@common/decorators/audit.decorator';
import { AuditAction } from '../entities/audit-log.entity';
import { AuditService } from '../audit.service';
import { AuthenticatedUser } from '@modules/auth/types/authenticated-user.type';

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/**
 * Interceptor global: cualquier controlador anotado con @Audit('Entity')
 * queda auditado sin código repetido. Captura automáticamente
 * usuario, acción (según verbo HTTP), entidad, entityId y new_values
 * (el body de la respuesta).
 *
 * Limitación conocida: old_values requiere el estado previo del registro,
 * que este interceptor no puede conocer de forma genérica. Para flujos
 * donde el "antes" importa (ej. cambios de estado de un ticket), el
 * servicio de negocio debe llamar a AuditService.record() explícitamente
 * con oldValues/newValues (ver TicketsService.changeStatus).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entity = this.reflector.get<string>(AUDIT_ENTITY_KEY, context.getHandler());
    if (!entity) return next.handle();

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const action = METHOD_TO_ACTION[request.method];
    if (!action) return next.handle();

    return next.handle().pipe(
      tap((result: Record<string, unknown> | undefined) => {
        const entityId = (result?.id ?? request.params?.id ?? 'unknown').toString();

        void this.auditService.record({
          userId: request.user?.id,
          action,
          entity,
          entityId,
          newValues: action !== 'DELETE' ? (result as Record<string, unknown>) : undefined,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }),
    );
  }
}
