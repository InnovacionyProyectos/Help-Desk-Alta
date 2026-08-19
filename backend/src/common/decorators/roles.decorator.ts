import { SetMetadata } from '@nestjs/common';
import { RoleCode } from '@modules/users/entities/role.entity';

export const ROLES_KEY = 'roles';

/**
 * Restringe el endpoint a los roles indicados.
 * Debe usarse junto con JwtAuthGuard + RolesGuard (aplicados globalmente).
 * Ej: @Roles('ADMIN', 'TECHNICIAN')
 */
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
