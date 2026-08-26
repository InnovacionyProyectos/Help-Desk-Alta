"""Headers de seguridad, equivalente a helmet() de NestJS. Middleware simple
(no hace falta una librería dedicada para 4 headers estáticos)."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings


def apply_security_headers(response: Response) -> Response:
    """Compartido entre el middleware (cubre el camino normal de
    request->response) y app/main.py's unhandled_exception_handler.

    Detalle no obvio de Starlette: un exception_handler registrado para la
    clase base `Exception` (o status 500) NO se ejecuta dentro de
    ExceptionMiddleware como los demás handlers — Starlette lo extrae y lo
    usa como `error_handler` de `ServerErrorMiddleware`, que es SIEMPRE la
    capa más externa de todo el stack (por fuera de cualquier middleware de
    usuario agregado con `add_middleware`, sin importar el orden). Cuando una
    ruta lanza una excepción no capturada, esta nunca vuelve a pasar por el
    `call_next()` de SecurityHeadersMiddleware — la excepción se propaga por
    encima de él — así que ese middleware nunca llega a añadir los headers a
    la respuesta 500 final. Confirmado en vivo durante la verificación de
    esta fase (headers presentes en un 404 pero ausentes en un 500 antes de
    este fix). Por eso el handler de Exception en app/main.py llama a esta
    función directamente sobre la respuesta que construye, en vez de confiar
    en que el middleware la intercepte."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # HSTS solo tiene sentido bajo HTTPS real (producción) — en HTTP plano de
    # desarrollo el header no aplica y podría confundir a un navegador si
    # algún día development sirviera por HTTPS con cert autofirmado.
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        return apply_security_headers(response)
