import uuid


class UserNotFoundError(Exception):
    def __init__(self, user_id: uuid.UUID | str):
        self.user_id = user_id
        super().__init__(f"Usuario {user_id} no encontrado")


class DuplicateEmailError(Exception):
    """Equivalente al 409 ConflictException del UsersService original
    (el correo ya existe — la unicidad case-insensitive la garantiza la
    columna CITEXT en la base)."""

    def __init__(self):
        super().__init__("Ya existe un usuario con ese correo")


class RoleNotFoundError(Exception):
    def __init__(self, role_code: str):
        self.role_code = role_code
        super().__init__(f"Rol {role_code} no encontrado")


class CannotDeleteSelfError(Exception):
    """Un Admin no puede eliminar su propia cuenta (evita que se quede sin
    acceso al panel de administración)."""

    def __init__(self):
        super().__init__("No puede eliminar su propia cuenta")


class CannotDeleteAdminError(Exception):
    """Técnico tiene los mismos permisos que Admin en Usuarios (crear,
    editar, resetear contraseña, eliminar) salvo esta única excepción,
    pedida explícitamente: un Técnico no puede eliminar una cuenta con rol
    Admin. Admin sí puede eliminar cuentas Admin (salvo la propia, ver
    CannotDeleteSelfError)."""

    def __init__(self):
        super().__init__("Un Técnico no puede eliminar una cuenta de Administrador")
