PLANIFICADOR DE VISITAS
=======================

Primera versión de una aplicación web para planificar las visitas de los técnicos a las obras sin
solapes ni falta de tiempo para desplazarse.

Aplicación publicada: https://planificador-visitas-nine.vercel.app/
(Vercel + Neon, con los datos de ejemplo)

Funcionalidades:

- Programar una visita (obra, técnico, fecha, hora de inicio y duración). Solo se guarda si
  cumple las tres reglas; si no, se indica qué regla falla y con qué visita choca, y se propone la
  hora libre más cercana.
- Reglas: a) sin solapes con otra visita del técnico; b) al menos 30 min entre dos visitas del
  mismo técnico en obras distintas; c) empezar y terminar entre las 08:00 y las 17:00.
- Cancelar: la visita queda visible como "Cancelada" y su horario libre.
- Reprogramar: cambiar la obra, el técnico, el día, la hora o la duración de una visita
  programada, con las mismas reglas. Se abre desde el listado o pulsando la visita en la agenda.
- Listado ordenado por fecha y hora y filtrable por técnico y por fecha.
- Agenda del día: una columna por técnico de 08:00 a 17:00. Al pulsar un hueco libre se abre el
  formulario con el técnico, la fecha y la hora ya puestos.

Qué he hecho y qué queda pendiente, las decisiones, los supuestos y cómo he usado la IA están al
final, en el apartado EXPLICACIÓN.

Stack: Next.js 16 (App Router, Server Actions), TypeScript, PostgreSQL, Drizzle ORM, Zod,
Tailwind CSS y Vitest.


EJECUTAR EN LOCAL
-----------------

Requisitos: Node.js 22.12 o superior y una base de datos PostgreSQL (14 o superior).

1. Instala las dependencias:

       npm install

2. Prepara la base de datos con una de estas opciones:

   - Docker: ejecuta "docker compose up -d" y copia .env.example a .env.local sin cambios.
   - Neon o Supabase (gratis, sin instalar nada): crea un proyecto, copia .env.example a
     .env.local y pon en DATABASE_URL la cadena de conexión del proyecto.

   Para copiar el fichero: en Windows, "copy .env.example .env.local"; en macOS/Linux,
   "cp .env.example .env.local".

3. Crea las tablas y carga los datos de ejemplo (4 técnicos, 7 obras y una veintena de visitas
   repartidas en los próximos días laborables):

       npm run db:setup

4. Arranca la aplicación y abre http://localhost:3000 :

       npm run dev

"npm run db:seed" vacía las tablas y vuelve a cargar los datos de ejemplo cuando quieras.


SCRIPTS
-------

    npm run dev                    Servidor de desarrollo
    npm run build / npm start      Build de producción y servidor
    npm test                       Tests de las reglas y de integración contra PostgreSQL en
                                   memoria (Vitest + PGlite; no necesita base de datos)
    npm run typecheck              Comprobación de tipos
    npm run lint                   ESLint
    npm run db:migrate             Aplica las migraciones de drizzle/
    npm run db:seed                Vacía y recarga los datos de ejemplo
    npm run db:setup               Migraciones + datos de ejemplo
    npm run db:generate            Genera una migración a partir de src/db/schema.ts


ESTRUCTURA
----------

    src/
      domain/   Reglas de planificación (funciones puras) y utilidades de hora, con sus tests
      db/       Esquema de Drizzle, conexión, consultas, datos de ejemplo y tests de integración
      app/      Páginas (App Router) y Server Actions de alta, reprogramación y cancelación
      lib/      Formato de fechas, parámetros de la URL y clases de estilo compartidas
    drizzle/    Migraciones SQL; la 0001 impone las tres reglas en PostgreSQL


DESPLIEGUE (VERCEL + NEON)
--------------------------

1. Crea la base de datos en Neon y ejecuta en local "npm run db:setup" con su cadena de conexión
   en .env.local.
2. Importa el repositorio en Vercel y añade la variable de entorno DATABASE_URL con la misma
   cadena. No hace falta más configuración.

Ninguna credencial se guarda en el repositorio: .env* está en .gitignore salvo .env.example.


EXPLICACIÓN
-----------

a) Qué he hecho y qué queda pendiente

Hecho: los cinco requisitos, con validación completa en el servidor, migraciones, seed y 46 tests
(de las reglas y de integración contra PostgreSQL). Extras, y por qué los elegí:

- Sugerir la hora libre más cercana si una visita no cabe: el problema de partida es buscar hueco
  a mano.
- Agenda del día, una columna por técnico: los huecos se ven de un vistazo y se programa pulsando
  uno.
- Reprogramar: mover visitas es lo más habitual al planificar; antes había que cancelar y crear
  otra.

Pendiente: usuarios y permisos (planificación y técnico de solo lectura, comprobados en cada
Server Action); alta, edición y baja lógica de técnicos y obras; desplazamientos reales según el
municipio; tests E2E y de concurrencia automáticos; y probar el docker-compose.yml, que no he
podido ejecutar sin Docker.

b) Decisiones principales

- Next.js + Server Actions + TypeScript: un solo proyecto para interfaz y servidor, desplegado en
  Vercel. Las Server Actions son endpoints públicos, así que validan todo de nuevo (Zod para el
  formato y después las reglas).
- Las reglas, en un módulo puro (src/domain/scheduling.ts): se prueba de forma aislada, devuelve
  todas las reglas incumplidas con la visita con la que choca y lo reutilizan el alta, la
  reprogramación, la sugerencia y el seed.
- Las reglas, también en PostgreSQL (drizzle/0001_reglas_planificacion.sql): validar y luego
  insertar deja una carrera entre dos peticiones simultáneas. Un CHECK (jornada) y dos EXCLUDE
  con btree_gist (solape, y desplazamiento ensanchando cada visita 15 min por lado), solo para
  visitas programadas, la cierran sin bloqueos. Un test con PGlite (PostgreSQL en memoria)
  comprueba que la base de datos y el código aceptan exactamente las mismas visitas.
- Hora local sin zona horaria (timestamp leído como texto): ningún Date desplaza las horas cuando
  el servidor corre en UTC.

c) Supuestos

- Una sola zona horaria y sin festivos. Solo aplico las tres reglas del enunciado: se puede
  programar en fin de semana o en el pasado.
- Los 30 min se exigen solo entre obras distintas, son siempre 30 y no cuentan antes de la primera
  visita del día ni después de la última.
- Intervalos semiabiertos: terminar a las 10:00 y empezar a las 10:00 no es un solape.
- Cancelar es definitivo: una visita cancelada no se reactiva ni se reprograma.
- El filtro por fecha es un día concreto y las duraciones son minutos enteros.

d) Uso de la IA

He usado Claude Code como asistente de programación. Le pedí primero un plan, que revisé y aprobé
antes de escribir código; después se implementó por pasos pequeños, cada uno con su commit y
comprobado con tests, build y pruebas en el navegador. Las decisiones fueron mías: stack, Neon,
alcance y extras. Propuse usuarios con roles y un CRUD de técnicos y obras y, tras discutirlo, los
dejé como pendientes para no entregar nada a medias. Los pasos con credenciales (Neon, GitHub,
Vercel) los hice yo; la cadena de conexión nunca pasó por el chat.

Una corrección. El primer formulario usaba <form action>. Si el servidor rechazaba una visita,
React 19 reseteaba el formulario y los desplegables de obra y técnico quedaban en blanco aunque el
estado conservaba los valores. Se corrigió enviando desde onSubmit y manteniendo action como
alternativa sin JavaScript, y eso provocó un segundo fallo solo en producción: con el
prerenderizado parcial de Next.js, enviar antes de que cargara React devolvía una página en
blanco. Se detectó al probar la build de producción y se resolvió quitando action y desactivando
el botón hasta que la página está lista. La lección: el código compilaba y pasaba los tests, pero
los dos fallos solo aparecieron al usar la aplicación en el navegador.
