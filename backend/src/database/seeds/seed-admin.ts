/**
 * Crea el primer usuario Administrador. Necesario porque el DDL (001_init_schema.sql)
 * solo siembra roles/estados/config, no usuarios: sin esto no hay con qué iniciar sesión.
 *
 * Uso: npm run seed:admin   (dentro de backend/, con .env ya configurado)
 * Personalizable vía variables de entorno SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
import 'dotenv/config';
import { Client } from 'pg';
import * as argon2 from 'argon2';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@helpdesk.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await client.connect();

  try {
    const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      console.log(`El usuario ${email} ya existe; no se crea de nuevo.`);
      return;
    }

    const { rows: roleRows } = await client.query("SELECT id FROM roles WHERE code = 'ADMIN'");
    if (roleRows.length === 0) {
      throw new Error(
        "No existe el rol ADMIN en la base de datos. ¿Corriste database/migrations/001_init_schema.sql?",
      );
    }

    const passwordHash = await argon2.hash(password);

    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, must_change_password)
       VALUES ($1, $2, 'Administrador', 'Sistema', $3, true)`,
      [email, passwordHash, roleRows[0].id],
    );

    console.log('Usuario administrador creado:');
    console.log(`  Correo:      ${email}`);
    console.log(`  Contraseña:  ${password}`);
    console.log('Debe cambiarla en el primer inicio de sesión (must_change_password = true).');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Error al crear el usuario administrador:', err.message);
  process.exit(1);
});
