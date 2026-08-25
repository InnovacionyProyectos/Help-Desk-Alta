from datetime import datetime


class InvalidCredentialsError(Exception):
    """Correo no existe, cuenta eliminada, o password incorrecta — mensaje
    generico a proposito, no filtra cual de las dos cosas paso."""


class AccountLockedError(Exception):
    def __init__(self, locked_until: datetime):
        self.locked_until = locked_until


class AccountInactiveError(Exception):
    pass
