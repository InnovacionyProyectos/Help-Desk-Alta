"""Rate limiting, equivalente a ThrottlerGuard de NestJS. Instancia única de
`Limiter` compartida entre app/main.py (límite global 100/min por IP,
registrado como middleware) y app/web/pages/auth.py (límite específico y más
agresivo de 5/min en POST /login, decorado ruta por ruta).

`key_func=get_remote_address` usa la IP del cliente (request.client.host) —
mismo criterio "por IP" que el original."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
