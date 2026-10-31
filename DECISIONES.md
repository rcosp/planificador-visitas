# Decisiones y supuestos

## a) Qué he hecho y qué queda pendiente

**Hecho:** los cinco requisitos funcionales (técnicos y obras con datos de ejemplo, alta de
visitas, las tres reglas, cancelación y listado con filtros), validación completa en el servidor,
esquema y migraciones, seed y 45 tests: los de las reglas y los de integración, que aplican las
migraciones a un PostgreSQL en memoria. Como extras, la sugerencia de la hora libre más cercana y
una agenda diaria con una columna por técnico.

**Pendiente**, por orden de prioridad:

- Autenticación y permisos: ahora cualquiera con la URL puede programar y cancelar. Habría un rol
  de planificación (todo) y otro de técnico (solo lectura de su agenda), con el permiso comprobado
  en cada Server Action y no solo ocultando botones.
- Reprogramar una visita (ahora se cancela y se crea otra) y alta/edición de técnicos y obras.
- Tiempos de desplazamiento reales según el municipio de cada obra.
- Tests E2E en el navegador y una prueba automática de concurrencia. Dos altas simultáneas las he
  probado a mano contra Neon; PGlite, el PostgreSQL de los tests, atiende una sola conexión.

## b) Decisiones principales

- **Next.js + Server Actions + TypeScript**: un único proyecto para interfaz y servidor y
  despliegue directo en Vercel. Las Server Actions son endpoints POST, así que validan todo de
  nuevo (Zod para el formato, después las reglas) aunque el formulario ya lo haya comprobado.
- **Las reglas, en un módulo puro** (`src/domain/scheduling.ts`): no depende de la base de datos
  ni de Next.js, se prueba de forma aislada y es la única fuente de los mensajes. Devuelve todas
  las reglas incumplidas, cada una con la visita con la que choca.
- **Las reglas, también en PostgreSQL** (`drizzle/0001_reglas_planificacion.sql`): validar y
  después insertar deja una carrera entre dos peticiones simultáneas. Un `CHECK` (jornada) y dos
  restricciones `EXCLUDE` con `btree_gist` (solape y desplazamiento), limitadas a las visitas
  programadas, la cierran sin bloqueos manuales. La regla b se expresa ensanchando cada visita
  15 min por lado: dos visitas en obras distintas chocan exactamente si las separan menos de 30
  min. Si la base de datos rechaza una visita, el error se traduce a la misma regla.
- **Hora local sin zona horaria** (`timestamp` leído como texto): las horas son de pared y así
  ningún `Date` las desplaza cuando el servidor corre en UTC, como en Vercel.
- **Drizzle + `pg`**: SQL explícito, migraciones versionadas y el mismo código con Neon, Supabase
  o un PostgreSQL local.
- **Filtros en la URL**: el listado y la agenda se pueden enlazar y no necesitan estado en el
  cliente. La agenda es una rejilla CSS renderizada en el servidor, sin librería de calendario.
- **Tests de integración con PGlite** (PostgreSQL compilado a WebAssembly): `npm test` aplica las
  migraciones reales sin Docker ni base de datos externa. Uno de los tests prueba cientos de
  visitas y comprueba que PostgreSQL acepta exactamente las mismas que `validateVisit`, así que
  las dos implementaciones de las reglas no pueden divergir sin que falle.
- **Extra, sugerir la hora libre más cercana**: el problema de partida es encontrar hueco a mano.
  Reutiliza la función de validación, así que no puede proponer una hora que luego se rechace.

## c) Supuestos

- Una sola zona horaria (la de la empresa) y no hay festivos.
- Solo se aplican las tres reglas del enunciado: se pueden programar visitas en fechas pasadas y
  en fin de semana.
- Los 30 min solo se exigen entre visitas a obras distintas. Dos visitas seguidas en la misma obra
  pueden ir sin hueco. No se exige desplazamiento antes de la primera visita del día ni después
  de la última.
- El desplazamiento es siempre de 30 min, sea cual sea el municipio.
- Los intervalos son semiabiertos: terminar a las 10:00 y empezar a las 10:00 no es un solape.
- Cancelar es definitivo. Reactivar una visita exigiría volver a validarla.
- El filtro por fecha es un día concreto. Las duraciones son minutos enteros.

## d) Uso de la IA

> _Pendiente de redactar por el autor: cómo he usado la IA y al menos un caso en el que haya
> tenido que corregir lo que generó._
