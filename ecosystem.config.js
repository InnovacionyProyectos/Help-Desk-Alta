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
  ],
};
