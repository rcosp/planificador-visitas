# Decisiones y supuestos

## a) Qué he hecho y qué queda pendiente

**Hecho:** los cinco requisitos funcionales (técnicos y obras con datos de ejemplo, alta de
visitas, las tres reglas, cancelación y listado con filtros), validación completa en el servidor,
esquema y migraciones, seed, 39 tests de las reglas y, como extra, la sugerencia de la hora libre
más cercana.

**Pendiente**, por orden de prioridad:

- Autenticación y permisos (ahora cualquiera con la URL puede programar y cancelar).
- Reprogramar una visita (ahora se cancela y se crea otra) y alta/edición de técnicos y obras.
- Vista de agenda diaria por técnico, más útil que una tabla para ver los huecos.
- Tiempos de desplazamiento reales según el municipio de cada obra.
- Tests automáticos de integración contra PostgreSQL y E2E. Las restricciones de la base de datos
  las he comprobado con un script que inserta filas inválidas directamente, pero no está
  automatizado.

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
- **Filtros en la URL**: el listado se puede enlazar y no necesita estado en el cliente.
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
