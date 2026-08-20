-- Agrega el "Tipo de ticket" (Incidente / Requerimiento / Consulta).
-- Igual que `priority`: valores fijos en código + CHECK, sin tabla catálogo
-- propia, porque solo Admin/Técnico lo modifican y el conjunto de valores
-- no necesita administración en runtime.

ALTER TABLE tickets
    ADD COLUMN ticket_type VARCHAR(20) NOT NULL DEFAULT 'INCIDENTE'
        CHECK (ticket_type IN ('INCIDENTE', 'REQUERIMIENTO', 'CONSULTA'));

CREATE INDEX idx_tickets_type ON tickets(ticket_type);
