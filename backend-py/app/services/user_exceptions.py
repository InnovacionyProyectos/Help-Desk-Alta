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
