--
-- Estructura completa (solo esquema, SIN datos) de la base de datos real
-- de producción `helpdesk` — generado con `pg_dump --schema-only` el
-- 2026-08-28 para validar capacidad/estructura en una evaluación de VPS
-- (Hostinger). No contiene filas de datos, usuarios, tickets ni
-- credenciales — solo definiciones de tablas, columnas, índices,
-- constraints y secuencias.
--
-- Este archivo es una FOTO del esquema en este momento, no se actualiza
-- solo. El historial incremental "vivo" del esquema (fuente de verdad
-- para futuros cambios) sigue siendo database/migrations/*.sql.
--

--
-- PostgreSQL database dump
--

\restrict 22egjdyiMYjWaETMFB5p1Iv5Zm7Bzm2bSprxvl9YTxMu6fvUIIcfqPcVoB5TRGb

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: trg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: areas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.areas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: areas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.areas_id_seq OWNED BY public.areas.id;


--
-- Name: asset_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


--
-- Name: asset_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_categories_id_seq OWNED BY public.asset_categories.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_tag character varying(50) NOT NULL,
    asset_category_id integer,
    name character varying(150) NOT NULL,
    serial_number character varying(100),
    provider_id integer,
    assigned_to uuid,
    area_id integer,
    purchase_date date,
    warranty_expires date,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assets_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'IN_REPAIR'::character varying, 'RETIRED'::character varying, 'LOST'::character varying])::text[])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    user_id uuid,
    action character varying(20) NOT NULL,
    entity character varying(60) NOT NULL,
    entity_id character varying(60) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_logs_action_check CHECK (((action)::text = ANY ((ARRAY['CREATE'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying, 'CHANGE_STATUS'::character varying, 'LOGIN'::character varying, 'LOGOUT'::character varying, 'ASSIGN'::character varying])::text[])))
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ticket_id uuid,
    type character varying(40) NOT NULL,
    title character varying(150) NOT NULL,
    message text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id smallint NOT NULL,
    code character varying(80) NOT NULL,
    module character varying(40) NOT NULL,
    description character varying(255)
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    tax_id character varying(30),
    contact_name character varying(120),
    contact_email character varying(150),
    contact_phone character varying(30),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: providers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.providers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: providers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.providers_id_seq OWNED BY public.providers.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    user_agent character varying(255),
    ip_address inet,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id smallint NOT NULL,
    permission_id smallint NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id smallint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(60) NOT NULL,
    description character varying(255),
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    user_agent character varying(255),
    ip_address inet,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sla_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sla_contracts (
    id integer NOT NULL,
    provider_id integer,
    name character varying(150) NOT NULL,
    priority character varying(10) NOT NULL,
    response_time_mins integer NOT NULL,
    resolution_time_mins integer NOT NULL,
    business_hours_only boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sla_contracts_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[])))
);


--
-- Name: sla_contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sla_contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sla_contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sla_contracts_id_seq OWNED BY public.sla_contracts.id;


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    id smallint DEFAULT 1 NOT NULL,
    company_name character varying(150) DEFAULT ''::character varying NOT NULL,
    company_logo_url character varying(500),
    support_email character varying(150),
    max_attachment_size_mb integer DEFAULT 10 NOT NULL,
    allowed_extensions text[] DEFAULT '{pdf,jpg,jpeg,png,docx,xlsx,txt}'::text[] NOT NULL,
    ticket_prefix character varying(10) DEFAULT 'HD'::character varying NOT NULL,
    ticket_number_format character varying(50) DEFAULT '{prefix}-{year}-{seq:5}'::character varying NOT NULL,
    smtp_host character varying(150),
    smtp_port integer,
    smtp_user character varying(150),
    smtp_password_encrypted character varying(255),
    smtp_use_tls boolean DEFAULT true NOT NULL,
    business_hours_start time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    business_hours_end time without time zone DEFAULT '18:00:00'::time without time zone NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_singleton CHECK ((id = 1))
);


--
-- Name: ticket_assignment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_assignment_history (
    id bigint NOT NULL,
    ticket_id uuid NOT NULL,
    from_user_id uuid,
    to_user_id uuid NOT NULL,
    assigned_by uuid NOT NULL,
    reason character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_assignment_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_assignment_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_assignment_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_assignment_history_id_seq OWNED BY public.ticket_assignment_history.id;


--
-- Name: ticket_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    comment_id uuid,
    uploaded_by uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    storage_key character varying(500) NOT NULL,
    mime_type character varying(100) NOT NULL,
    size_bytes bigint NOT NULL,
    checksum_sha256 character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: ticket_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    description character varying(255),
    display_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_categories_id_seq OWNED BY public.ticket_categories.id;


--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: ticket_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_status_history (
    id bigint NOT NULL,
    ticket_id uuid NOT NULL,
    from_status_id smallint,
    to_status_id smallint NOT NULL,
    changed_by uuid,
    reason character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_status_history_id_seq OWNED BY public.ticket_status_history.id;


--
-- Name: ticket_status_transitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_status_transitions (
    id integer NOT NULL,
    from_status_id smallint NOT NULL,
    to_status_id smallint NOT NULL,
    allowed_roles smallint[] DEFAULT '{}'::smallint[] NOT NULL
);


--
-- Name: ticket_status_transitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_status_transitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_status_transitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_status_transitions_id_seq OWNED BY public.ticket_status_transitions.id;


--
-- Name: ticket_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_statuses (
    id smallint NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(50) NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    is_final boolean DEFAULT false NOT NULL
);


--
-- Name: ticket_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_statuses_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_statuses_id_seq OWNED BY public.ticket_statuses.id;


--
-- Name: ticket_subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_subcategories (
    id integer NOT NULL,
    category_id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    description character varying(255),
    display_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_subcategories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_subcategories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_subcategories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_subcategories_id_seq OWNED BY public.ticket_subcategories.id;


--
-- Name: ticket_typifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_typifications (
    id integer NOT NULL,
    subcategory_id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    description character varying(255),
    default_priority character varying(10) DEFAULT 'MEDIUM'::character varying NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_typifications_default_priority_check CHECK (((default_priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[])))
);


--
-- Name: ticket_typifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_typifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_typifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_typifications_id_seq OWNED BY public.ticket_typifications.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number character varying(20) NOT NULL,
    subject character varying(200) NOT NULL,
    description text NOT NULL,
    category_id integer,
    subcategory_id integer,
    typification_id integer,
    status_id smallint NOT NULL,
    priority character varying(10) DEFAULT 'MEDIUM'::character varying NOT NULL,
    requester_id uuid NOT NULL,
    assigned_to_id uuid,
    assigned_area_id integer,
    asset_id uuid,
    sla_contract_id integer,
    due_at timestamp with time zone,
    resolution_summary text,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    reopened_count smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ticket_type character varying(20) DEFAULT 'INCIDENTE'::character varying NOT NULL,
    CONSTRAINT tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[]))),
    CONSTRAINT tickets_ticket_type_check CHECK (((ticket_type)::text = ANY ((ARRAY['INCIDENTE'::character varying, 'REQUERIMIENTO'::character varying, 'CONSULTA'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email public.citext NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(80) NOT NULL,
    last_name character varying(80) NOT NULL,
    phone character varying(30),
    role_id smallint NOT NULL,
    area_id integer,
    is_active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    failed_login_attempts smallint DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: areas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas ALTER COLUMN id SET DEFAULT nextval('public.areas_id_seq'::regclass);


--
-- Name: asset_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_categories ALTER COLUMN id SET DEFAULT nextval('public.asset_categories_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: providers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers ALTER COLUMN id SET DEFAULT nextval('public.providers_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: sla_contracts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_contracts ALTER COLUMN id SET DEFAULT nextval('public.sla_contracts_id_seq'::regclass);


--
-- Name: ticket_assignment_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignment_history ALTER COLUMN id SET DEFAULT nextval('public.ticket_assignment_history_id_seq'::regclass);


--
-- Name: ticket_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories ALTER COLUMN id SET DEFAULT nextval('public.ticket_categories_id_seq'::regclass);


--
-- Name: ticket_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history ALTER COLUMN id SET DEFAULT nextval('public.ticket_status_history_id_seq'::regclass);


--
-- Name: ticket_status_transitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions ALTER COLUMN id SET DEFAULT nextval('public.ticket_status_transitions_id_seq'::regclass);


--
-- Name: ticket_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_statuses ALTER COLUMN id SET DEFAULT nextval('public.ticket_statuses_id_seq'::regclass);


--
-- Name: ticket_subcategories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_subcategories ALTER COLUMN id SET DEFAULT nextval('public.ticket_subcategories_id_seq'::regclass);


--
-- Name: ticket_typifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_typifications ALTER COLUMN id SET DEFAULT nextval('public.ticket_typifications_id_seq'::regclass);


--
-- Name: areas areas_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_name_key UNIQUE (name);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: asset_categories asset_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_name_key UNIQUE (name);


--
-- Name: asset_categories asset_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);


--
-- Name: assets assets_asset_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_tag_key UNIQUE (asset_tag);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: providers providers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_name_key UNIQUE (name);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: sla_contracts sla_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_contracts
    ADD CONSTRAINT sla_contracts_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (id);


--
-- Name: ticket_assignment_history ticket_assignment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignment_history
    ADD CONSTRAINT ticket_assignment_history_pkey PRIMARY KEY (id);


--
-- Name: ticket_attachments ticket_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_pkey PRIMARY KEY (id);


--
-- Name: ticket_categories ticket_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_code_key UNIQUE (code);


--
-- Name: ticket_categories ticket_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_name_key UNIQUE (name);


--
-- Name: ticket_categories ticket_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_pkey PRIMARY KEY (id);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: ticket_status_history ticket_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_pkey PRIMARY KEY (id);


--
-- Name: ticket_status_transitions ticket_status_transitions_from_status_id_to_status_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions
    ADD CONSTRAINT ticket_status_transitions_from_status_id_to_status_id_key UNIQUE (from_status_id, to_status_id);


--
-- Name: ticket_status_transitions ticket_status_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions
    ADD CONSTRAINT ticket_status_transitions_pkey PRIMARY KEY (id);


--
-- Name: ticket_statuses ticket_statuses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_statuses
    ADD CONSTRAINT ticket_statuses_code_key UNIQUE (code);


--
-- Name: ticket_statuses ticket_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_statuses
    ADD CONSTRAINT ticket_statuses_pkey PRIMARY KEY (id);


--
-- Name: ticket_subcategories ticket_subcategories_category_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_subcategories
    ADD CONSTRAINT ticket_subcategories_category_id_name_key UNIQUE (category_id, name);


--
-- Name: ticket_subcategories ticket_subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_subcategories
    ADD CONSTRAINT ticket_subcategories_pkey PRIMARY KEY (id);


--
-- Name: ticket_typifications ticket_typifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_typifications
    ADD CONSTRAINT ticket_typifications_pkey PRIMARY KEY (id);


--
-- Name: ticket_typifications ticket_typifications_subcategory_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_typifications
    ADD CONSTRAINT ticket_typifications_subcategory_id_name_key UNIQUE (subcategory_id, name);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_assets_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_area ON public.assets USING btree (area_id);


--
-- Name: idx_assets_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_assigned_to ON public.assets USING btree (assigned_to);


--
-- Name: idx_assignment_history_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignment_history_ticket ON public.ticket_assignment_history USING btree (ticket_id);


--
-- Name: idx_attachments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_ticket ON public.ticket_attachments USING btree (ticket_id);


--
-- Name: idx_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_logs USING btree (entity, entity_id);


--
-- Name: idx_audit_new_values_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_new_values_gin ON public.audit_logs USING gin (new_values);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_comments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_ticket ON public.ticket_comments USING btree (ticket_id);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id) WHERE (is_read = false);


--
-- Name: idx_refresh_tokens_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_expiry ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_sessions_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expiry ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id);


--
-- Name: idx_status_history_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_history_ticket ON public.ticket_status_history USING btree (ticket_id);


--
-- Name: idx_subcategories_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcategories_category ON public.ticket_subcategories USING btree (category_id) WHERE (is_active = true);


--
-- Name: idx_tickets_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_area ON public.tickets USING btree (assigned_area_id);


--
-- Name: idx_tickets_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_asset ON public.tickets USING btree (asset_id);


--
-- Name: idx_tickets_assigned_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_assigned_status ON public.tickets USING btree (assigned_to_id, status_id);


--
-- Name: idx_tickets_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_assigned_to ON public.tickets USING btree (assigned_to_id);


--
-- Name: idx_tickets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_category ON public.tickets USING btree (category_id);


--
-- Name: idx_tickets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_created_at ON public.tickets USING btree (created_at);


--
-- Name: idx_tickets_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_priority ON public.tickets USING btree (priority);


--
-- Name: idx_tickets_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_requester ON public.tickets USING btree (requester_id);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status_id);


--
-- Name: idx_tickets_subcategory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_subcategory ON public.tickets USING btree (subcategory_id);


--
-- Name: idx_tickets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_type ON public.tickets USING btree (ticket_type);


--
-- Name: idx_tickets_typification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_typification ON public.tickets USING btree (typification_id);


--
-- Name: idx_typifications_subcategory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_typifications_subcategory ON public.ticket_typifications USING btree (subcategory_id) WHERE (is_active = true);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_area ON public.users USING btree (area_id);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role_id);


--
-- Name: areas set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: assets set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: providers set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: roles set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: sla_contracts set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sla_contracts FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: ticket_categories set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ticket_categories FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: ticket_comments set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ticket_comments FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: ticket_subcategories set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ticket_subcategories FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: ticket_typifications set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ticket_typifications FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: tickets set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: users set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: assets assets_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE SET NULL;


--
-- Name: assets assets_asset_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_category_id_fkey FOREIGN KEY (asset_category_id) REFERENCES public.asset_categories(id) ON DELETE SET NULL;


--
-- Name: assets assets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assets assets_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_replaced_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_replaced_by_fkey FOREIGN KEY (replaced_by) REFERENCES public.refresh_tokens(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sla_contracts sla_contracts_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_contracts
    ADD CONSTRAINT sla_contracts_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;


--
-- Name: system_config system_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: ticket_assignment_history ticket_assignment_history_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignment_history
    ADD CONSTRAINT ticket_assignment_history_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: ticket_assignment_history ticket_assignment_history_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignment_history
    ADD CONSTRAINT ticket_assignment_history_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id);


--
-- Name: ticket_assignment_history ticket_assignment_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignment_history
    ADD CONSTRAINT ticket_assignment_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_assignment_history ticket_assignment_history_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignment_history
    ADD CONSTRAINT ticket_assignment_history_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id);


--
-- Name: ticket_attachments ticket_attachments_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.ticket_comments(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: ticket_categories ticket_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ticket_comments ticket_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: ticket_comments ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_status_history ticket_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: ticket_status_history ticket_status_history_from_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_from_status_id_fkey FOREIGN KEY (from_status_id) REFERENCES public.ticket_statuses(id);


--
-- Name: ticket_status_history ticket_status_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_status_history ticket_status_history_to_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_to_status_id_fkey FOREIGN KEY (to_status_id) REFERENCES public.ticket_statuses(id);


--
-- Name: ticket_status_transitions ticket_status_transitions_from_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions
    ADD CONSTRAINT ticket_status_transitions_from_status_id_fkey FOREIGN KEY (from_status_id) REFERENCES public.ticket_statuses(id);


--
-- Name: ticket_status_transitions ticket_status_transitions_to_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_transitions
    ADD CONSTRAINT ticket_status_transitions_to_status_id_fkey FOREIGN KEY (to_status_id) REFERENCES public.ticket_statuses(id);


--
-- Name: ticket_subcategories ticket_subcategories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_subcategories
    ADD CONSTRAINT ticket_subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id) ON DELETE CASCADE;


--
-- Name: ticket_subcategories ticket_subcategories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_subcategories
    ADD CONSTRAINT ticket_subcategories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ticket_typifications ticket_typifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_typifications
    ADD CONSTRAINT ticket_typifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ticket_typifications ticket_typifications_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_typifications
    ADD CONSTRAINT ticket_typifications_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.ticket_subcategories(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_assigned_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_area_id_fkey FOREIGN KEY (assigned_area_id) REFERENCES public.areas(id);


--
-- Name: tickets tickets_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id);


--
-- Name: tickets tickets_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_sla_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_sla_contract_id_fkey FOREIGN KEY (sla_contract_id) REFERENCES public.sla_contracts(id);


--
-- Name: tickets tickets_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.ticket_statuses(id);


--
-- Name: tickets tickets_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.ticket_subcategories(id);


--
-- Name: tickets tickets_typification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_typification_id_fkey FOREIGN KEY (typification_id) REFERENCES public.ticket_typifications(id);


--
-- Name: users users_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE SET NULL;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict 22egjdyiMYjWaETMFB5p1Iv5Zm7Bzm2bSprxvl9YTxMu6fvUIIcfqPcVoB5TRGb

