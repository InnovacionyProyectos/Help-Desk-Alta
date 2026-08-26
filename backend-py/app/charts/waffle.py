"""Puerto de frontend/src/shared/components/WaffleChart.tsx — reparto de
100 celdas (1 celda = 1%) por el método del mayor residuo (largest
remainder), para que la suma siempre dé exactamente 100 — un `round()`
ingenuo no lo garantiza."""

import math


def build_waffle(items: list[dict]) -> dict | None:
    """`items`: [{"label": str, "value": number, "color": str}, ...].
    Devuelve `None` si el total es 0 (la plantilla debe mostrar "Sin
    datos"), igual que el componente original."""
    total = sum(item["value"] for item in items)
    if total == 0:
        return None

    raw = [(item["value"] / total) * 100 for item in items]
    counts = [math.floor(n) for n in raw]
    remainder = 100 - sum(counts)

    # Orden por parte fraccionaria descendente; Python's sorted() es
    # estable, igual que Array.prototype.sort en motores modernos — los
    # empates conservan el orden original de items, como en el TS.
    order = sorted(range(len(items)), key=lambda i: raw[i] - math.floor(raw[i]), reverse=True)
    for k in range(remainder):
        counts[order[k % len(order)]] += 1

    cells: list[str] = []
    for item, count in zip(items, counts):
        cells.extend([item["color"]] * count)

    legend = [
        {
            "label": item["label"],
            "value": item["value"],
            "color": item["color"],
            # Math.round() redondea mitad-hacia-arriba para no-negativos;
            # round() de Python usa banker's rounding, así que se replica
            # el comportamiento de JS explícitamente con floor(x + 0.5).
            "pct": int((item["value"] / total) * 100 + 0.5),
        }
        for item in items
    ]

    return {"cells": cells, "legend": legend}
