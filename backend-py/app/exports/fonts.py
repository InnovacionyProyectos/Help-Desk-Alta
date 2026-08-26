"""Registra la tipografía de marca (DM Sans) en reportlab. Sin esto, los
PDF generados usan el Helvetica por defecto de reportlab en vez de la
tipografía del manual de marca (ver app/static/css/app.css, que ya la
aplica en toda la interfaz web vía Google Fonts) — inconsistencia
detectada al revisar el manual de marca y corregida aquí.

Los .ttf vienen de la fuente variable oficial de Google Fonts
(github.com/google/fonts, licencia SIL Open Font License — copia en
app/static/fonts/OFL.txt), instanciados a 3 pesos estáticos (Regular/
Medium/Bold, óptico 14pt) con `fonttools varLib.instancer`: reportlab no
soporta ejes de fuente variable, necesita un .ttf estático por peso."""

from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_FONTS_DIR = Path(__file__).resolve().parent.parent / "static" / "fonts"
_registered = False


def register_fonts() -> None:
    """Idempotente — puede llamarse al principio de cada build_*_pdf() sin
    riesgo de registrar la fuente dos veces."""
    global _registered
    if _registered:
        return
    pdfmetrics.registerFont(TTFont("DMSans", str(_FONTS_DIR / "DMSans-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("DMSans-Medium", str(_FONTS_DIR / "DMSans-Medium.ttf")))
    pdfmetrics.registerFont(TTFont("DMSans-Bold", str(_FONTS_DIR / "DMSans-Bold.ttf")))
    # bold=DMSans-Bold: para que <b>...</b> dentro de un Paragraph con
    # fontName="DMSans" resuelva al peso Bold real en vez de un falso
    # negrita sintético.
    pdfmetrics.registerFontFamily(
        "DMSans", normal="DMSans", bold="DMSans-Bold", italic="DMSans", boldItalic="DMSans-Bold"
    )
    _registered = True
