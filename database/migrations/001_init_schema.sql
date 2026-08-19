-- =====================================================================
-- HELP DESK PLATFORM - DDL INICIAL (PostgreSQL 14+)
-- Módulo: Core (Usuarios/RBAC, Clasificación jerárquica, Tickets,
--          Auditoría, Configuración global)
-- Diseñado para extensión futura: ITAM (activos/licencias) y SLA/Proveedores
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- email case-insensitive

-- =====================================================================
-- 1. SEGURIDAD / RBAC
-- =====================================================================

CREATE TABLE roles (
    id              SMALLSERIAL PRIMARY KEY,
    code            VARCHAR(30)  NOT NULL UNIQUE,      -- ADMIN, TECHNICIAN, END_USER
    name            VARCHAR(60)  NOT NULL,
    description     VARCHAR(255),
    is_system       BOOLEAN      NOT NULL DEFAULT FALSE, -- roles protegidos, no editables/borrables
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id              SMALLSERIAL PRIMARY KEY,
    code            VARCHAR(80)  NOT NULL UNIQUE,      -- ticket:create, ticket:assign, user:manage...
    module          VARCHAR(40)  NOT NULL,
    description     VARCHAR(255)
);

CREATE TABLE role_permissions (
    role_id         SMALLINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   SMALLINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE areas (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,      -- ej. Sistemas, Contabilidad, Cartera
    description     VARCHAR(255),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT       NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,             -- argon2id
    first_name      VARCHAR(80)  NOT NULL,
    last_name       VARCHAR(80)  NOT NULL,
    phone           VARCHAR(30),
    role_id         SMALLINT     NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    area_id         INTEGER      REFERENCES areas(id) ON DELETE SET NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ                         -- soft delete
);

CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_area ON users(area_id);
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,       -- se guarda el hash, nunca el token plano
    user_agent      VARCHAR(255),
    ip_address      INET,
    expires_at      TIMESTAMPTZ  NOT NULL,
    revoked_at      TIMESTAMPTZ,
    replaced_by     UUID REFERENCES refresh_tokens(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expiry ON refresh_tokens(expires_at);

-- =====================================================================
-- 2. CLASIFICACIÓN JERÁRQUICA DINÁMICA (3 niveles, gestionable por Admin)
-- =====================================================================

CREATE TABLE ticket_categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    code            VARCHAR(20)  UNIQUE,                -- opcional, para integraciones
    description     VARCHAR(255),
    display_order   SMALLINT     NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (name)
);

CREATE TABLE ticket_subcategories (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER      NOT NULL REFERENCES ticket_categories(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    code            VARCHAR(20),
    description     VARCHAR(255),
    display_order   SMALLINT     NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (category_id, name)
);

CREATE INDEX idx_subcategories_category ON ticket_subcategories(category_id) WHERE is_active = TRUE;

CREATE TABLE ticket_typifications (
    id              SERIAL PRIMARY KEY,
    subcategory_id  INTEGER      NOT NULL REFERENCES ticket_subcategories(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    code            VARCHAR(20),
    description     VARCHAR(255),
    default_priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
                        CHECK (default_priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    -- SLA se maneja fuera de la clasificación (módulo SLA futuro, tabla
    -- sla_contracts); se retiró de aquí a propósito.
    display_order   SMALLINT     NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (subcategory_id, name)
);

CREATE INDEX idx_typifications_subcategory ON ticket_typifications(subcategory_id) WHERE is_active = TRUE;

-- =====================================================================
-- 3. PREPARACIÓN ITAM / SLA / PROVEEDORES (esqueleto para módulos futuros)
-- =====================================================================

CREATE TABLE providers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL UNIQUE,
    tax_id          VARCHAR(30),
    contact_name    VARCHAR(120),
    contact_email   VARCHAR(150),
    contact_phone   VARCHAR(30),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE sla_contracts (
    id                  SERIAL PRIMARY KEY,
    provider_id         INTEGER REFERENCES providers(id) ON DELETE SET NULL,
    name                VARCHAR(150) NOT NULL,
    priority            VARCHAR(10) NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    response_time_mins  INTEGER NOT NULL,               -- tiempo máx. de primera respuesta
    resolution_time_mins INTEGER NOT NULL,               -- tiempo máx. de resolución
    business_hours_only BOOLEAN NOT NULL DEFAULT TRUE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE asset_categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE       -- Hardware, Software, Licencia, Periférico...
);

CREATE TABLE assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag       VARCHAR(50) NOT NULL UNIQUE,        -- código de inventario
    asset_category_id INTEGER REFERENCES asset_categories(id) ON DELETE SET NULL,
    name            VARCHAR(150) NOT NULL,
    serial_number   VARCHAR(100),
    provider_id     INTEGER REFERENCES providers(id) ON DELETE SET NULL,
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    area_id         INTEGER REFERENCES areas(id) ON DELETE SET NULL,
    purchase_date   DATE,
    warranty_expires DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','IN_REPAIR','RETIRED','LOST')),
    metadata        JSONB NOT NULL DEFAULT '{}',        -- specs libres (RAM, licencia, etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_assigned_to ON assets(assigned_to);
CREATE INDEX idx_assets_area ON assets(area_id);

-- =====================================================================
-- 4. TICKETS
-- =====================================================================

CREATE TABLE ticket_statuses (
    id              SMALLSERIAL PRIMARY KEY,
    code            VARCHAR(20) NOT NULL UNIQUE,        -- OPEN, ASSIGNED, IN_PROGRESS, ON_HOLD, RESOLVED, CLOSED, REOPENED
    name            VARCHAR(50) NOT NULL,
    display_order   SMALLINT NOT NULL DEFAULT 0,
    is_final        BOOLEAN NOT NULL DEFAULT FALSE      -- CLOSED se marca is_final = true
);

-- Transiciones válidas del flujo de estados (permite modificar el flujo sin tocar código)
CREATE TABLE ticket_status_transitions (
    id                  SERIAL PRIMARY KEY,
    from_status_id      SMALLINT NOT NULL REFERENCES ticket_statuses(id),
    to_status_id        SMALLINT NOT NULL REFERENCES ticket_statuses(id),
    allowed_roles       SMALLINT[] NOT NULL DEFAULT '{}', -- role_id[] permitidos para ejecutar la transición
    UNIQUE (from_status_id, to_status_id)
);

CREATE SEQUENCE ticket_number_seq START 1;

CREATE TABLE tickets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number       VARCHAR(20) NOT NULL UNIQUE,    -- ej. HD-2026-00001, generado desde system_config
    subject             VARCHAR(200) NOT NULL,
    description         TEXT NOT NULL,

    -- Nulas a propósito: el Usuario Final solo diligencia asunto/descripción
    -- al crear el ticket; la clasificación la asigna después un Técnico o
    -- el Administrador (ver TicketsService.update).
    category_id         INTEGER REFERENCES ticket_categories(id),
    subcategory_id      INTEGER REFERENCES ticket_subcategories(id),
    typification_id     INTEGER REFERENCES ticket_typifications(id),

    status_id           SMALLINT NOT NULL REFERENCES ticket_statuses(id),
    priority            VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
                            CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),

    requester_id        UUID NOT NULL REFERENCES users(id),          -- Usuario Final que crea el ticket
    assigned_to_id       UUID REFERENCES users(id),                   -- Técnico asignado
    assigned_area_id    INTEGER REFERENCES areas(id),

    asset_id            UUID REFERENCES assets(id) ON DELETE SET NULL, -- FK opcional -> integración ITAM futura
    sla_contract_id      INTEGER REFERENCES sla_contracts(id),         -- FK opcional -> módulo SLA futuro
    due_at               TIMESTAMPTZ,                                   -- fecha límite calculada según SLA

    resolution_summary   TEXT,
    resolved_at          TIMESTAMPTZ,
    closed_at            TIMESTAMPTZ,
    reopened_count       SMALLINT NOT NULL DEFAULT 0,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_requester ON tickets(requester_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to_id);
CREATE INDEX idx_tickets_status ON tickets(status_id);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_category ON tickets(category_id);
CREATE INDEX idx_tickets_subcategory ON tickets(subcategory_id);
CREATE INDEX idx_tickets_typification ON tickets(typification_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_asset ON tickets(asset_id);
CREATE INDEX idx_tickets_area ON tickets(assigned_area_id);
-- índice compuesto para dashboards "mis tickets por estado"
CREATE INDEX idx_tickets_assigned_status ON tickets(assigned_to_id, status_id);

CREATE TABLE ticket_status_history (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    from_status_id  SMALLINT REFERENCES ticket_statuses(id),
    to_status_id    SMALLINT NOT NULL REFERENCES ticket_statuses(id),
    changed_by      UUID REFERENCES users(id),          -- NULL = acción automática del sistema (ej. cierre a 24h)
    reason          VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_ticket ON ticket_status_history(ticket_id);

CREATE TABLE ticket_assignment_history (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    from_user_id    UUID REFERENCES users(id),
    to_user_id      UUID NOT NULL REFERENCES users(id),
    assigned_by     UUID NOT NULL REFERENCES users(id),
    reason          VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignment_history_ticket ON ticket_assignment_history(ticket_id);

CREATE TABLE ticket_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    body            TEXT NOT NULL,
    is_internal     BOOLEAN NOT NULL DEFAULT FALSE,     -- true = solo Admin/Técnico
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_comments_ticket ON ticket_comments(ticket_id);

CREATE TABLE ticket_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    comment_id      UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    file_name       VARCHAR(255) NOT NULL,
    storage_key     VARCHAR(500) NOT NULL,              -- ruta en storage (S3/local/Azure Blob)
    mime_type       VARCHAR(100) NOT NULL,
    size_bytes      BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_attachments_ticket ON ticket_attachments(ticket_id);

-- =====================================================================
-- 5. AUDITORÍA (AUDIT TRAIL)
-- =====================================================================

CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,   -- null = acción del sistema
    action          VARCHAR(20) NOT NULL
                        CHECK (action IN ('CREATE','UPDATE','DELETE','CHANGE_STATUS','LOGIN','LOGOUT','ASSIGN')),
    entity          VARCHAR(60) NOT NULL,               -- ej. 'Ticket', 'User', 'TicketCategory'
    entity_id       VARCHAR(60) NOT NULL,               -- soporta UUID o int como texto
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    user_agent      VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
-- índice GIN para búsquedas dentro de los JSONB (auditoría avanzada / soporte)
CREATE INDEX idx_audit_new_values_gin ON audit_logs USING GIN (new_values);

-- =====================================================================
-- 6. CONFIGURACIÓN GLOBAL DEL SISTEMA
-- =====================================================================

CREATE TABLE system_config (
    id                      SMALLINT PRIMARY KEY DEFAULT 1,   -- fila única (singleton)
    company_name            VARCHAR(150) NOT NULL DEFAULT '',
    company_logo_url        VARCHAR(500),
    support_email           VARCHAR(150),
    max_attachment_size_mb  INTEGER NOT NULL DEFAULT 10,
    allowed_extensions      TEXT[] NOT NULL DEFAULT '{pdf,jpg,jpeg,png,docx,xlsx,txt}',
    ticket_prefix           VARCHAR(10) NOT NULL DEFAULT 'HD',
    ticket_number_format    VARCHAR(50) NOT NULL DEFAULT '{prefix}-{year}-{seq:5}',
    smtp_host               VARCHAR(150),
    smtp_port               INTEGER,
    smtp_user               VARCHAR(150),
    smtp_password_encrypted VARCHAR(255),
    smtp_use_tls            BOOLEAN NOT NULL DEFAULT TRUE,
    business_hours_start    TIME NOT NULL DEFAULT '08:00',
    business_hours_end      TIME NOT NULL DEFAULT '18:00',
    updated_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_singleton CHECK (id = 1)
);

-- =====================================================================
-- 7. NOTIFICACIONES (soporte para módulo de correo/alertas)
-- =====================================================================

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_id       UUID REFERENCES tickets(id) ON DELETE CASCADE,
    type            VARCHAR(40) NOT NULL,               -- TICKET_ASSIGNED, STATUS_CHANGED, COMMENT_ADDED...
    title           VARCHAR(150) NOT NULL,
    message         TEXT,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;

-- =====================================================================
-- 8. TRIGGERS: updated_at automático
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users','areas','roles','ticket_categories','ticket_subcategories',
        'ticket_typifications','tickets','ticket_comments','assets',
        'providers','sla_contracts'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();', t
        );
    END LOOP;
END $$;

-- =====================================================================
-- 9. SEED MÍNIMO (roles base, estados, permisos, configuración)
-- =====================================================================

INSERT INTO roles (code, name, is_system) VALUES
    ('ADMIN', 'Administrador', TRUE),
    ('TECHNICIAN', 'Técnico', TRUE),
    ('END_USER', 'Usuario Final', TRUE);

INSERT INTO ticket_statuses (code, name, display_order, is_final) VALUES
    ('OPEN', 'Abierto', 1, FALSE),
    ('ASSIGNED', 'Asignado', 2, FALSE),
    ('IN_PROGRESS', 'En Proceso', 3, FALSE),
    ('ON_HOLD', 'En Espera', 4, FALSE),
    ('RESOLVED', 'Resuelto', 5, FALSE),
    ('CLOSED', 'Cerrado', 6, TRUE),
    ('REOPENED', 'Reabierto', 7, FALSE);

INSERT INTO system_config (id, company_name, ticket_prefix) VALUES (1, 'Mi Empresa', 'HD');

-- Transiciones de estado por defecto (ejemplo, editable vía CRUD/admin)
INSERT INTO ticket_status_transitions (from_status_id, to_status_id, allowed_roles)
SELECT s1.id, s2.id, '{1,2}' -- ADMIN, TECHNICIAN
FROM ticket_statuses s1, ticket_statuses s2
WHERE (s1.code, s2.code) IN (
    ('OPEN','ASSIGNED'), ('ASSIGNED','IN_PROGRESS'), ('IN_PROGRESS','ON_HOLD'),
    ('ON_HOLD','IN_PROGRESS'), ('IN_PROGRESS','RESOLVED'), ('RESOLVED','CLOSED'),
    ('RESOLVED','REOPENED'), ('CLOSED','REOPENED'), ('REOPENED','ASSIGNED')
);
