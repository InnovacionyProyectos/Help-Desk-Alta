class TicketNotFoundError(Exception):
    def __init__(self, ticket_id):
        self.ticket_id = ticket_id
        super().__init__(f"Ticket {ticket_id} no encontrado")


class TicketClosedError(Exception):
    """CLOSED es terminal absoluto: bloquea reclasificar, reasignar,
    comentar y cualquier cambio de estado, sin excepcion de rol."""

    def __init__(self):
        super().__init__("El ticket está cerrado y no se puede modificar")


class ForbiddenTicketAccessError(Exception):
    """Usuario Final intentando ver/actuar sobre un ticket que no es suyo."""

    def __init__(self):
        super().__init__("No tiene acceso a este ticket")


class InvalidStatusTransitionError(Exception):
    """END_USER pidiendo una transicion distinta a RESOLVED -> REOPENED
    sobre su propio ticket."""

    def __init__(self, message: str = "Un Usuario Final solo puede reabrir tickets resueltos"):
        super().__init__(message)


class IncompleteClassificationError(Exception):
    """Si viene alguno de categoria/subcategoria/tipificacion, deben venir
    los tres juntos."""

    def __init__(self):
        super().__init__("Debe indicar categoría, subcategoría y tipificación juntas, o ninguna")
