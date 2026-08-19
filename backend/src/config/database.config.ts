import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    autoLoadEntities: true,
    // Las migraciones viven en database/migrations (SQL versionado a mano);
    // synchronize permanece en false en todos los entornos para evitar
    // que TypeORM aplique cambios de esquema no controlados.
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  }),
);
