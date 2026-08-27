from pathlib import Path

from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory=Path(__file__).parent / "templates")

# Cache-busting para /static/css/app.css: sin esto, el navegador guarda el
# CSS en caché indefinidamente porque la URL nunca cambia — un cambio real
# de estilos (ej. quitar el subrayado de los botones-enlace) no le llega a
# quien ya lo tenía cacheado hasta que limpie caché a mano. Se calcula una
# sola vez al arrancar (con la fecha de modificación del archivo), así que
# cualquier despliegue que reinicie el servidor (ya es el paso normal para
# aplicar cambios de código) también fuerza la descarga del CSS más reciente.
_css_path = Path(__file__).parent / "static" / "css" / "app.css"
templates.env.globals["asset_v"] = int(_css_path.stat().st_mtime) if _css_path.exists() else 0

# Mismo cache-busting para htmx.js — se dejó de cargar desde el CDN
# unpkg.com (ver static/js/htmx.js) y se sirve local, así que también
# necesita esto para que un futuro upgrade de versión le llegue a todo el
# mundo sin depender de que alguien limpie caché a mano.
_htmx_path = Path(__file__).parent / "static" / "js" / "htmx.js"
templates.env.globals["htmx_v"] = int(_htmx_path.stat().st_mtime) if _htmx_path.exists() else 0
