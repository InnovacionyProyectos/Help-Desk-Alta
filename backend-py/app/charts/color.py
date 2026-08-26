"""Puerto literal de `readableTextColor` en
frontend/src/shared/components/Treemap.tsx: decide si el texto de una celda
debe ser blanco o casi-negro según la luminancia relativa WCAG del color de
fondo (calculada dinámicamente, no fija por celda)."""


def readable_text_color(hex_color: str) -> str:
    """`hex_color` en formato "#rrggbb" (la paleta de categorías del
    treemap siempre es hex). Aplica la curva de linealización sRGB (umbral
    0.03928, gamma 2.4) y la fórmula de luminancia relativa WCAG
    (0.2126 R + 0.7152 G + 0.0722 B); > 0.5 de luminancia => fondo claro =>
    texto oscuro, si no => texto blanco."""
    value = hex_color.lstrip("#")
    r, g, b = (int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))

    def _linearize(channel: float) -> float:
        return channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4

    rl, gl, bl = _linearize(r), _linearize(g), _linearize(b)
    luminance = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
    return "#0b0b0b" if luminance > 0.5 else "#ffffff"
