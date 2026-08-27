"""Réplica de los DTO de class-validator del módulo users del backend
NestJS original (backend/src/modules/users/dto/*.dto.ts).

UpdateUserDto se aparta deliberadamente de UpdateUserDto.ts (que hace
`OmitType(CreateUserDto, ['password'])`, o sea SÍ conserva `email`
editable a nivel de DTO): el formulario React (`UserFormModal.tsx`)
deshabilita el campo email en modo edición y nunca lo envía, así que en la
práctica el email nunca cambia por esta vía. Replicamos esa misma
limitación de la UI quitando `email` del todo del DTO de edición en vez de
declararlo y no usarlo — ver instrucciones de la Fase 8, regla #2."""

from pydantic import BaseModel, EmailStr, Field


class CreateUserDto(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone: str | None = Field(default=None, max_length=30)
    role_code: str
    area_id: int | None = None


class UpdateUserDto(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, min_length=1, max_length=80)
    phone: str | None = Field(default=None, max_length=30)
    role_code: str | None = None
    area_id: int | None = None
    is_active: bool | None = None


class ChangePasswordDto(BaseModel):
    """Nuevo: acción explícita y separada de UpdateUserDto para que un
    Admin cambie la contraseña de un usuario — el `ChangePasswordDto`
    original en NestJS existía pero nunca tuvo un endpoint conectado
    (limitación real del sistema original, corregida aquí desde el lado
    Admin, no self-service). Misma regla mínima que CreateUserDto.password."""

    password: str = Field(min_length=8, max_length=72)


class SelfChangePasswordDto(BaseModel):
    """Panel de perfil (mejora post-corte): a diferencia de
    ChangePasswordDto (Admin cambiándole la clave a otro, sin necesidad de
    saber la actual), aquí SÍ se exige la contraseña actual — es el propio
    usuario cambiando la suya, mismo patrón de seguridad estándar de
    "cambiar mi contraseña" en cualquier sistema."""

    current_password: str
    new_password: str = Field(min_length=8, max_length=72)
