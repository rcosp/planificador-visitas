# Planificador de visitas

Primera versión de una aplicación web para planificar las visitas de los técnicos a las obras sin
solapes ni falta de tiempo para desplazarse.

**Aplicación publicada:** <https://planificador-visitas-nine.vercel.app/> (Vercel + Neon, con los
datos de ejemplo).

- **Programar una visita** (obra, técnico, fecha, hora de inicio y duración). Solo se guarda si
  cumple las tres reglas; si no, se indica qué regla falla y con qué visita choca, y se propone la
  hora libre más cercana.
- **Reglas**: a) sin solapes con otra visita del técnico; b) al menos 30 min entre dos visitas del
  mismo técnico en obras distintas; c) empezar y terminar entre las 08:00 y las 17:00.
- **Cancelar**: la visita queda visible como *Cancelada* y su horario libre.
- **Reprogramar**: cambiar la obra, el técnico, el día, la hora o la duración de una visita
  programada, con las mismas reglas. Se abre desde el listado o pulsando la visita en la agenda.
- **Listado** ordenado por fecha y hora y filtrable por técnico y por fecha.
- **Agenda del día**: una columna por técnico de 08:00 a 17:00. Al pulsar un hueco libre se abre el
  formulario con el técnico, la fecha y la hora ya puestos.

Las decisiones, los supuestos y lo que queda pendiente están en [DECISIONES.md](DECISIONES.md).

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL · Drizzle ORM ·
Zod · Tailwind CSS · Vitest.

## Ejecutar en local

Requisitos: **Node.js 22.12 o superior** y una base de datos PostgreSQL (14 o superior).

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Prepara la base de datos con **una** de estas opciones:

   - **Docker**: `docker compose up -d` y copia `.env.example` a `.env.local` sin cambios.
   - **Neon o Supabase** (gratis, sin instalar nada): crea un proyecto, copia `.env.example` a
     `.env.local` y pon en `DATABASE_URL` la cadena de conexión del proyecto.

   En Windows, `copy .env.example .env.local`; en macOS/Linux, `cp .env.example .env.local`.

3. Crea las tablas y carga los datos de ejemplo (4 técnicos, 7 obras y una veintena de visitas
   repartidas en los próximos días laborables):

   ```bash
   npm run db:setup
   ```

4. Arranca la aplicación y abre <http://localhost:3000>:

   ```bash
   npm run dev
   ```

`npm run db:seed` vacía las tablas y vuelve a cargar los datos de ejemplo cuando quieras.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build de producción y servidor |
| `npm test` | Tests de las reglas y de integración contra PostgreSQL en memoria (Vitest + PGlite; no necesita base de datos) |
| `npm run typecheck` / `npm run lint` | Comprobación de tipos y ESLint |
| `npm run db:migrate` | Aplica las migraciones de `drizzle/` |
| `npm run db:seed` | Vacía y recarga los datos de ejemplo |
| `npm run db:setup` | Migraciones + datos de ejemplo |
| `npm run db:generate` | Genera una migración a partir de `src/db/schema.ts` |

## Estructura

```
src/
  domain/   Reglas de planificación (funciones puras) y utilidades de hora, con sus tests
  db/       Esquema de Drizzle, conexión, consultas, datos de ejemplo y tests de integración
  app/      Páginas (App Router) y Server Actions de alta y cancelación
  lib/      Formato de fechas, parámetros de la URL y clases de estilo compartidas
drizzle/    Migraciones SQL; la 0001 impone las tres reglas en PostgreSQL
```

## Despliegue (Vercel + Neon)

1. Crea la base de datos en Neon y ejecuta en local `npm run db:setup` con su cadena de conexión
   en `.env.local`.
2. Importa el repositorio en Vercel y añade la variable de entorno `DATABASE_URL` con la misma
   cadena. No hace falta más configuración.

Ninguna credencial se guarda en el repositorio: `.env*` está en `.gitignore` salvo `.env.example`.
