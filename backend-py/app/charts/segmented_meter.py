"""Puerto de frontend/src/shared/components/SegmentedMeter.tsx."""


def build_segmented_meter(items: list[dict]) -> dict | None:
    """`items`: [{"label": str, "value": number, "color": str}, ...].
    Devuelve `None` si el total es 0, igual que el original. `flex` se pasa
    crudo (no en %): en la plantilla cada segmento usa
    `style="flex: {{ flex }}"` y es flexbox quien reparte proporcionalmente
    el ancho — el `gap` entre segmentos deja ver el fondo y actúa de
    separador, tal como en el componente React."""
    total = sum(item["value"] for item in items)
    if total == 0:
        return None

    segments = [
        {"label": item["label"], "value": item["value"], "color": item["color"], "flex": item["value"]}
        for item in items
    ]
    legend = [
        {
            "label": item["label"],
            "value": item["value"],
            "color": item["color"],
            "pct": int((item["value"] / total) * 100 + 0.5),
        }
        for item in items
    ]
    return {"segments": segments, "legend": legend}
