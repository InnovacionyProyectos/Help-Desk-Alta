-- Tabla de sesiones de servidor para el backend Python (FastAPI + Jinja2 +
-- HTMX). Reemplaza el flujo de JWT access+refresh de la SPA NestJS/React,
-- que solo existia por ser un cliente 100% JS con axios; con cookies de
-- sesion server-side eso deja de ser necesario. Mismo patron que la tabla
-- `refresh_tokens` original: solo se guarda el hash del token de sesion.
--
-- Aditiva: no toca ninguna tabla existente, el backend NestJS no la
-- referencia y sigue funcionando exactamente igual sin saber que existe.

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    user_agent      VARCHAR(255),
    ip_address      INET,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);
