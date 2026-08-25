from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.routers import classification as classification_api
from app.security.exceptions import ForbiddenException, NotAuthenticatedException
from app.templating import templates
from app.web.pages import admin_classification, auth, dashboard

app = FastAPI(title="Alta Help Desk")

app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.exception_handler(NotAuthenticatedException)
async def not_authenticated_handler(request: Request, exc: NotAuthenticatedException):
    return RedirectResponse(url="/login", status_code=303)


@app.exception_handler(ForbiddenException)
async def forbidden_handler(request: Request, exc: ForbiddenException):
    return templates.TemplateResponse(request, "errors/403.html", {}, status_code=403)


@app.get("/")
async def root():
    return RedirectResponse(url="/dashboard", status_code=303)


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(classification_api.router)
app.include_router(admin_classification.router)
