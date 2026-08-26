"""Puerto de frontend/src/shared/components/HorizontalBarChart.tsx."""


def build_horizontal_bar(items: list[dict], color: str) -> list[dict]:
    """`items`: [{"label": str, "value": number}, ...]. Devuelve la lista
    lista para iterar en la plantilla, con el porcentaje de ancho de cada
    barra ya calculado contra el máximo (mínimo visual de la barra se
    aplica en CSS con `min-width`, igual que en el original — no se toca
    `pct` aquí)."""
    max_value = max([1] + [item["value"] for item in items])
    return [
        {
            "label": item["label"],
            "value": item["value"],
            "pct": (item["value"] / max_value) * 100,
            "color": color,
        }
        for item in items
    ]
