import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta la variable DATABASE_URL. Copia .env.example a .env.local y pon la cadena de conexión de PostgreSQL.",
    );
  }
  return new Pool({ connectionString, max: 5 });
}

// En desarrollo, la recarga en caliente vuelve a evaluar este módulo: se
// reutiliza el pool para no abrir conexiones nuevas en cada cambio.
const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle({ client: pool, schema });
