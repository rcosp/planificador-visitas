import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// La conexión se crea en la primera consulta y no al importar el módulo, para
// que `next build` no dependa de que DATABASE_URL esté configurada. Se guarda
// en globalThis porque en desarrollo la recarga en caliente vuelve a evaluar
// este módulo y se abrirían conexiones nuevas en cada cambio.
const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: NodePgDatabase<typeof schema>;
};

export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "Falta la variable DATABASE_URL. Copia .env.example a .env.local y pon la cadena de conexión de PostgreSQL.",
      );
    }
    globalForDb.pool = new Pool({ connectionString, max: 5 });
    globalForDb.db = drizzle({ client: globalForDb.pool, schema });
  }
  return globalForDb.db;
}

/** Cierra las conexiones; lo usan los scripts que terminan (seed). */
export async function closeDb(): Promise<void> {
  await globalForDb.pool?.end();
  globalForDb.pool = undefined;
  globalForDb.db = undefined;
}
