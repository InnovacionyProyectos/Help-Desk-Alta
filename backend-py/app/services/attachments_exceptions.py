class AttachmentNotFoundError(Exception):
    def __init__(self, attachment_id):
        self.attachment_id = attachment_id
        super().__init__(f"Adjunto {attachment_id} no encontrado")


class FileTooLargeError(Exception):
    """El archivo excede `max_attachment_size_mb` de system_config (leido en
    caliente en cada subida, no hardcodeado)."""

    def __init__(self, max_size_mb: int):
        self.max_size_mb = max_size_mb
        super().__init__(f"El archivo excede el tamaño máximo permitido ({max_size_mb} MB)")


class InvalidExtensionError(Exception):
    """La extension del archivo no esta en `allowed_extensions` de
    system_config (leido en caliente en cada subida, no hardcodeado)."""

    def __init__(self, allowed_extensions: list[str]):
        self.allowed_extensions = allowed_extensions
        allowed = ", ".join(allowed_extensions)
        super().__init__(f"Extensión no permitida. Extensiones válidas: {allowed}")
