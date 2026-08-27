// Config de PM2 para mantener backend y frontend corriendo de forma
// permanente en este equipo (sobreviven a cerrar la terminal; con
// `pm2-startup install` también sobreviven a reiniciar Windows).
//
// Uso:
//   pm2 start ecosystem.config.js   -> arranca ambos
//   pm2 restart all                 -> reinicia ambos (ej. tras cambiar .env)
//   pm2 logs                        -> ver logs en vivo
//   pm2 status                      -> ver si están arriba
//   pm2 stop all                    -> detenerlos
const path = require('path');

module.exports = {
  apps: [
    {
      // Corre el build compilado (dist/main.js), NO "nest start --watch":
      // el modo watch de Nest lanza sub-procesos propios para recompilar,
      // y eso choca con cómo PM2 vigila el proceso en Windows (el puerto
      // dejaba de responder aunque PM2 lo veía "online"). Un proceso plano
      // de Node es mucho más estable para dejarlo corriendo permanente.
      //
      // Importante: tras editar código del backend hay que reconstruir y
      // reiniciar → `npm run build` (en backend/) y luego `pm2 restart helpdesk-backend`.
      name: 'helpdesk-backend',
      cwd: './backend',
      script: 'dist/main.js',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'helpdesk-frontend',
      cwd: './frontend',
      script: 'node_modules/vite/bin/vite.js',
      autorestart: true,
      watch: false, // vite ya tiene su propio HMR
      max_restarts: 10,
      restart_delay: 3000,
    },
    // Reescritura en Python (FastAPI+Jinja2+HTMX) — reemplaza a
    // helpdesk-backend Y helpdesk-frontend a la vez (server-rendered, un
    // solo proceso sirve páginas y fragmentos HTMX, ya no hay SPA aparte).
    // Corte a producción: 2026-08-26.
    //
    // IMPORTANTE: `instances` debe quedarse en 1 (el default) — el job de
    // auto-cierre corre con APScheduler en memoria de proceso (ver
    // app/main.py, lifespan); con más de una instancia el job se
    // duplicaría y cerraría tickets varias veces por ciclo.
    //
    // `run.py` (no `uvicorn app.main:app` directo) fija la política de
    // event loop de Windows antes de que uvicorn arranque — psycopg async
    // no funciona con el ProactorEventLoop que Windows usa por defecto.
    //
    // Tras editar código de backend-py: `pm2 restart helpdesk-py` (no hace
    // falta build, es Python interpretado).
    {
      name: 'helpdesk-py',
      cwd: './backend-py',
      script: 'run.py',
      // Ruta absoluta: PM2 no resuelve `interpreter` relativo a `cwd`, solo
      // busca en PATH o exige ruta completa (confirmado en vivo: con
      // './venv/Scripts/python.exe' fallaba con "NOT AVAILABLE in PATH").
      //
      // pythonw.exe, NO python.exe: es la variante de Python que no asigna
      // consola al sistema operativo en absoluto (viene con todo CPython,
      // pensada para apps sin ventana). `windowsHide: true` en PM2 no fue
      // suficiente para evitar la consola visible en este Windows/versión
      // de PM2 (confirmado en vivo: seguía abriéndose una ventana negra que,
      // al cerrarla, mataba el proceso y PM2 lo reiniciaba de inmediato con
      // otra ventana — bucle infinito). Con pythonw.exe no hay consola que
      // cerrar. stdout/stderr los sigue capturando PM2 igual (llegan
      // redirigidos a un pipe, no dependen de que exista una consola real).
      interpreter: path.resolve(__dirname, 'backend-py', 'venv', 'Scripts', 'pythonw.exe'),
      windowsHide: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
