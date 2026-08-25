"""Punto de arranque para desarrollo en Windows.

psycopg en modo async solo funciona con un SelectorEventLoop; el
ProactorEventLoop que asyncio usa por defecto en Windows no es compatible.
Hay que fijar la politica ANTES de que uvicorn cree el loop, por eso este
script (y no `uvicorn app.main:app` directo) es el punto de entrada aqui.
"""

import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
