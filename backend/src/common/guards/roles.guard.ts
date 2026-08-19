import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleCode } from '@modules/users/entities/role.entity';
import { AuthenticatedUser } from '@modules/auth/types/authenticated-user.type';

/**
 * Guard global (registrado tras JwtAuthGuard). Si el handler no tiene
 * @Roles(...), el endpoint queda accesible para cualquier usuario
 * autenticado; si lo tiene, exige que request.user.role esté incluido.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('No tiene permisos para realizar esta acción');
    }

    return true;
  }
}
