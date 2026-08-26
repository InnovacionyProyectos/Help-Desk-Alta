"""Puerto de frontend/src/shared/components/Treemap.tsx — layout
slice-and-dice recursivo: en cada nivel corta la lista de items donde se
acumula la mitad del valor total y reparte el rectángulo en esa
proporción, alternando eje horizontal/vertical en cada nivel de
recursión."""

from app.charts.color import readable_text_color

# Alto fijo del contenedor en píxeles (eje Y/H de todo el layout se mide en
# píxeles; el eje X/W se mide en porcentaje 0-100 — las dos unidades nunca
# se mezclan entre sí a través de la recursión, igual que en el original).
HEIGHT = 280


def _layout(items: list[dict], x: float, y: float, w: float, h: float, horizontal: bool) -> list[dict]:
    if not items:
        return []
    if len(items) == 1:
        return [{**items[0], "x": x, "y": y, "w": w, "h": h}]

    total = sum(item["value"] for item in items)
    acc = 0
    split_index = 1
    for i, item in enumerate(items):
        acc += item["value"]
        if acc >= total / 2:
            split_index = i + 1
            break
    split_index = min(max(split_index, 1), len(items) - 1)

    left = items[:split_index]
    right = items[split_index:]
    left_fraction = sum(item["value"] for item in left) / total

    if horizontal:
        w_left = w * left_fraction
        return _layout(left, x, y, w_left, h, False) + _layout(right, x + w_left, y, w - w_left, h, False)

    h_top = h * left_fraction
    return _layout(left, x, y, w, h_top, True) + _layout(right, x, y + h_top, w, h - h_top, True)


def build_treemap(items: list[dict]) -> list[dict] | None:
    """`items`: [{"label": str, "value": number, "color": str}, ...] (color
    siempre hex — la paleta cíclica de categorías es fija). Devuelve `None`
    si el total es 0, igual que el original. Cada rect resultante trae ya
    resuelto `text_color` (luminancia WCAG) y `show_label`/`show_value`
    (los mismos umbrales del original, incluida la comparación a propósito
    "incorrecta" de `w`, en porcentaje, contra umbrales pensados en
    píxeles — así es en el React original, se replica tal cual)."""
    total = sum(item["value"] for item in items)
    if total == 0:
        return None

    rects = _layout(items, 0, 0, 100, HEIGHT, True)
    for rect in rects:
        rect["text_color"] = readable_text_color(rect["color"])
        rect["show_label"] = rect["w"] > 12 and rect["h"] > 30
        # Pedido explícito del usuario: toda celda que alcanza a mostrar la
        # etiqueta también debe mostrar el número — antes el original usaba
        # un umbral más estricto solo para el número (w>30 y h>50), dejando
        # celdas visibles con etiqueta pero sin valor. Deviación deliberada
        # del puerto literal del Treemap.tsx original.
        rect["show_value"] = rect["show_label"]
    return rects
