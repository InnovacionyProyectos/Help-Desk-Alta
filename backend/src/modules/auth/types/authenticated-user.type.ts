import { RoleCode } from '@modules/users/entities/role.entity';

/** Forma del objeto adjuntado a request.user tras validar el JWT de acceso. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  areaId?: number;
}
