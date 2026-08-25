class NotAuthenticatedException(Exception):
    """Sin sesion valida — el handler global redirige a /login."""


class ForbiddenException(Exception):
    """Sesion valida pero el rol no tiene permiso — el handler global
    renderiza la pagina 403."""
