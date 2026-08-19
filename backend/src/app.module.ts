import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';

import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';

import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { ClassificationModule } from '@modules/classification/classification.module';
import { TicketsModule } from '@modules/tickets/tickets.module';
import { AuditModule } from '@modules/audit/audit.module';
import { AuditInterceptor } from '@modules/audit/interceptors/audit.interceptor';
import { SystemConfigModule } from '@modules/system-config/system-config.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { AreasModule } from '@modules/areas/areas.module';
import { AttachmentsModule } from '@modules/attachments/attachments.module';
import { ReportsModule } from '@modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig, // ver src/config/database.config.ts
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // límite global de requests
    ScheduleModule.forRoot(), // habilita @Cron() (ej. cierre automático de tickets a 24h)

    AuditModule,
    AuthModule,
    UsersModule,
    ClassificationModule,
    TicketsModule,
    SystemConfigModule,
    DashboardModule,
    AreasModule,
    AttachmentsModule,
    ReportsModule,
  ],
  providers: [
    // Orden de ejecución: Throttler -> JwtAuthGuard (autenticación) -> RolesGuard (autorización)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Aplica @Exclude()/@Expose() de las entidades (ej. User.passwordHash)
    // a toda respuesta HTTP; sin este interceptor esos decoradores no hacen nada.
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) => new ClassSerializerInterceptor(reflector),
      inject: [Reflector],
    },
  ],
})
export class AppModule {}
