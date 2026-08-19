# Estructura del Proyecto — Help Desk Platform

Monorepo con separación total Backend / Frontend / Base de Datos.

```
Help Desk/
├── database/
│   └── migrations/
│       └── 001_init_schema.sql          # DDL completo (ver documento)
│
├── backend/                              # NestJS + TypeScript
│   ├── src/
│   │   ├── main.ts                       # Bootstrap (Helmet, CORS, ValidationPipe global)
│   │   ├── app.module.ts                 # Módulo raíz, registra todos los módulos de negocio
│   │   │
│   │   ├── config/                       # Configuración tipada (env, jwt, database, storage)
│   │   │   ├── env.validation.ts
│   │   │   ├── database.config.ts
│   │   │   └── jwt.config.ts
│   │   │
│   │   ├── common/                       # Cross-cutting concerns reutilizables
│   │   │   ├── decorators/
│   │   │   │   ├── roles.decorator.ts        # @Roles('ADMIN', 'TECHNICIAN')
│   │   │   │   ├── current-user.decorator.ts # @CurrentUser()
│   │   │   │   └── audit.decorator.ts        # @Audit('Ticket') metadata para el interceptor
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   └── audit.interceptor.ts      # Captura old/new values -> audit_logs
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   └── pipes/
│   │   │       └── parse-uuid.pipe.ts
│   │   │
│   │   ├── database/
│   │   │   └── seeds/                    # Seeders (roles, estados, admin inicial)
│   │   │
│   │   └── modules/                      # Módulos de dominio (feature-based, desacoplados)
│   │       ├── auth/                     # Login, refresh, logout, estrategias JWT
│   │       │   ├── strategies/
│   │       │   │   ├── jwt.strategy.ts
│   │       │   │   └── jwt-refresh.strategy.ts
│   │       │   ├── guards/
│   │       │   ├── dto/
│   │       │   ├── auth.controller.ts
│   │       │   ├── auth.service.ts
│   │       │   └── auth.module.ts
│   │       │
│   │       ├── users/                    # CRUD usuarios, roles, áreas (Admin)
│   │       ├── areas/
│   │       │
│   │       ├── classification/           # Categoría -> Subcategoría -> Tipificación
│   │       │   ├── entities/
│   │       │   ├── dto/
│   │       │   ├── classification.controller.ts
│   │       │   ├── classification.service.ts
│   │       │   └── classification.module.ts
│   │       │
│   │       ├── tickets/                  # Núcleo funcional: CRUD, estados, comentarios
│   │       │   ├── entities/
│   │       │   ├── dto/
│   │       │   ├── enums/
│   │       │   ├── tickets.controller.ts
│   │       │   ├── tickets.service.ts
│   │       │   └── tickets.module.ts
│   │       │
│   │       ├── attachments/              # Subida/descarga de adjuntos (valida config global)
│   │       ├── audit/                    # Servicio de auditoría + entidad AuditLog
│   │       ├── system-config/            # Parámetros globales (singleton)
│   │       ├── dashboard/                # Endpoints agregados por rol
│   │       ├── reports/                  # Exportación Excel / PDF
│   │       │
│   │       └── assets/                   # (Preparado para ITAM futuro: activos, licencias)
│   │
│   ├── test/
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── .env.example
│
└── frontend/                             # React + Vite + TypeScript
    ├── src/
    │   ├── app/
    │   │   ├── routes/                   # Enrutamiento + rutas protegidas por rol (RequireRole)
    │   │   └── store/                    # Estado global (auth, usuario actual)
    │   ├── features/                     # Organización por dominio (feature-sliced)
    │   │   ├── auth/                     # Login, manejo de tokens
    │   │   ├── tickets/                  # Listado, detalle, formularios, comentarios
    │   │   ├── classification/           # CRUD cascada Categoría/Subcategoría/Tipificación
    │   │   ├── users/                    # Gestión usuarios/roles (Admin)
    │   │   └── dashboard/                # 3 dashboards diferenciados por rol
    │   └── shared/
    │       ├── api/                      # Cliente HTTP (axios) + interceptores refresh-token
    │       ├── components/               # UI genérica (tabla, modal, badge de estado)
    │       └── hooks/                    # useAuth, usePermissions, useCascadeSelect
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

## Principios de la arquitectura

- **Desacople por módulo de dominio** (no por capa técnica): cada carpeta bajo `modules/`
  es independiente y expone su propio `Module`, `Controller`, `Service`, `DTOs` y `Entities`.
  Esto permite migrar un módulo completo (p. ej. `assets`) a un microservicio en el futuro
  sin reescribir el resto del sistema.
- **Guards + Interceptors transversales**: la seguridad (`JwtAuthGuard`, `RolesGuard`) y la
  auditoría (`AuditInterceptor`) se aplican de forma global o por decorador, nunca duplicando
  lógica dentro de cada controlador.
- **Clasificación jerárquica data-driven**: no hay enums de categorías en código; todo vive en
  las tablas `ticket_categories` / `ticket_subcategories` / `ticket_typifications`, editables
  por el Admin vía CRUD.
- **Preparado para ITAM/SLA**: `tickets.asset_id` y `tickets.sla_contract_id` ya existen como
  FKs opcionales; los módulos `assets`, `providers` y `sla_contracts` están definidos en el
  DDL y como carpeta stub en el backend, listos para implementarse sin migraciones destructivas.
