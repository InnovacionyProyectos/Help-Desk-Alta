import logging
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.jobs.close_resolved_tickets import close_resolved_tickets
from app.middleware.security_headers import SecurityHeadersMiddleware, apply_security_headers
from app.routers import classification as classification_api
from app.security.exceptions import ForbiddenException, NotAuthenticatedException
from app.security.rate_limit import limiter
from app.templating import templates
from app.web.pages import admin_classification, admin_users, attachments, auth, dashboard, reports, tickets

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # APScheduler vive en memoria del proceso: si esto se escala alguna vez
    # a varios workers de uvicorn (ej. `--workers N` o varias instancias
    # detrás de un balanceador), CADA worker arrancaría su propio
    # AsyncIOScheduler y el job de auto-cierre correría N veces en paralelo
    # cada 10 minutos (duplicando el historial/auditoría, aunque el cierre
    # en sí sea idempotente). Mientras exista este job, correr siempre con
    # un solo worker/proceso — o mover el scheduler a un proceso aparte si
    # se necesita escalar el servidor web.
    scheduler = AsyncIOScheduler()
    scheduler.add_job(close_resolved_tickets, IntervalTrigger(minutes=10))
    scheduler.start()
    logger.info("Scheduler iniciado: close_resolved_tickets cada 10 minutos")
    try:
        yield
    finally:
        scheduler.shutdown()


app = FastAPI(title="Alta Help Desk", lifespan=lifespan)

# Rate limiting (equivalente a ThrottlerGuard): límite global 100/min por IP
# vía middleware (app.state.limiter + SlowAPIMiddleware); el límite más
# agresivo de 5/min en POST /login se declara aparte, en auth.py, con
# @limiter.limit("5/minute") sobre esa ruta puntual.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Headers de seguridad (equivalente a helmet()).
app.add_middleware(SecurityHeadersMiddleware)

app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.exception_handler(NotAuthenticatedException)
async def not_authenticated_handler(request: Request, exc: NotAuthenticatedException):
    return RedirectResponse(url="/login", status_code=303)


@app.exception_handler(ForbiddenException)
async def forbidden_handler(request: Request, exc: ForbiddenException):
    return templates.TemplateResponse(request, "errors/403.html", {}, status_code=403)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Normaliza cualquier HTTPException genérica (404 de ticket no
    encontrado, 409 de ticket cerrado, 413 de adjunto muy grande, etc.) a una
    página HTML de marca, en vez del `{"detail": "..."}` plano por defecto de
    FastAPI/Starlette — equivalente al HttpExceptionFilter normalizado del
    NestJS original. NotAuthenticatedException/ForbiddenException no pasan
    por aquí: son Exception propias, no HTTPException, y ya tienen sus
    propios handlers arriba."""
    return templates.TemplateResponse(
        request,
        "errors/generic.html",
        {"status_code": exc.status_code, "detail": exc.detail},
        status_code=exc.status_code,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Cualquier excepción no capturada en una ruta (bug, error de datos no
    previsto, etc.) — se registra completa en el log del servidor pero al
    cliente solo se le muestra una página genérica, sin traceback ni
    detalles internos.

    Llama a apply_security_headers() explícitamente (no basta con
    SecurityHeadersMiddleware): Starlette convierte un handler de `Exception`
    en el `error_handler` de ServerErrorMiddleware, la capa MÁS externa de
    todo el stack — por fuera de cualquier middleware de usuario — así que
    una excepción real nunca vuelve a pasar por el `call_next()` del
    middleware de headers. Ver docstring de apply_security_headers()."""
    logger.exception("Error no controlado en %s %s", request.method, request.url.path)
    response = templates.TemplateResponse(request, "errors/500.html", {}, status_code=500)
    return apply_security_headers(response)


@app.get("/")
async def root():
    return RedirectResponse(url="/dashboard", status_code=303)


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(classification_api.router)
app.include_router(admin_classification.router)
app.include_router(admin_users.router)
app.include_router(tickets.router)
app.include_router(attachments.router)
app.include_router(reports.router)
