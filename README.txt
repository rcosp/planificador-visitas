a) Qué he hecho y qué queda pendiente

Hecho: los cinco requisitos, con validación completa en el servidor, migraciones, seed y 46 tests
(de las reglas y de integración contra PostgreSQL). Extras, y por qué los elegí:

- Sugerir la hora libre más cercana si una visita no cabe: el problema de partida es buscar hueco
  a mano.
- Agenda del día, una columna por técnico: los huecos se ven de un vistazo y se programa pulsando uno.
- Reprogramar: mover visitas es lo más habitual al planificar; antes había que cancelar y crear otra.

Pendiente:
- Usuarios, roles y permisos.
- CRUD de técnicos y obras.
- Tiempos de desplazamiento reales según el municipio.

b) Decisiones principales

- Next.js + Server Actions + TypeScript: un solo proyecto para interfaz y servidor, desplegado en Vercel.
	Las Server Actions son endpoints públicos, así que validan todo de nuevo (Zod para el formato y después las reglas).
- Las reglas, en un módulo aparte (src/domain/scheduling.ts): se prueba de forma aislada, devuelve todas las reglas
	incumplidas con la visita con la que choca y lo reutilizan el alta, la reprogramación, la sugerencia y el seed.
- Las reglas, también en PostgreSQL (drizzle/0001_reglas_planificacion.sql): validar y luego insertar deja una carrera
	entre dos peticiones simultáneas. Un CHECK (jornada) y dos EXCLUDE con btree_gist (solape, y desplazamiento ensanchando
	cada visita 15 min por lado), solo para visitas programadas, la cierran sin bloqueos. Un test con PGlite (PostgreSQL
	en memoria) comprueba que la base de datos y el código aceptan exactamente las mismas visitas.
- Hora local sin zona horaria (timestamp leído como texto): ningún Date desplaza las horas cuando el servidor corre en UTC.

c) Supuestos

- Una sola zona horaria y sin festivos. Solo aplico las tres reglas del enunciado: se puede programar en fin de semana o en el pasado.
- Los 30 min se exigen solo entre obras distintas, son siempre 30 y no cuentan antes de la primera visita del día ni después de la última.
- Intervalos semiabiertos: terminar a las 10:00 y empezar a las 10:00 no es un solape.
- Cancelar es definitivo: una visita cancelada no se reactiva ni se reprograma.
- El filtro por fecha es un día concreto y las duraciones son minutos enteros.

d) Uso de la IA

He usado Claude Code como asistente de programación. Le pedí primero un plan, que revisé y aprobé antes de escribir código.
Después se implementó por pasos pequeños, cada uno con su commit y comprobado con tests, build y pruebas en el navegador.
Las decisiones fueron mías: stack, Neon, alcance y extras. Pensé en añadir usuarios con roles y un CRUD de técnicos y obras, pero tras
discutirlo con la IA, los dejé como pendientes para no entregar nada a medias.
Los pasos con credenciales (Neon, GitHub, Vercel) los hice yo. La cadena de conexión nunca pasó por la IA por motivos de seguridad.

Una corrección: El primer formulario usaba <form action>. Si el servidor rechazaba una visita, React 19 reseteaba el formulario y los desplegables
de obra y técnico quedaban en blanco aunque el estado conservaba los valores. Se corrigió enviando desde onSubmit y manteniendo action como
alternativa sin JavaScript, y eso provocó un segundo fallo solo en producción: con el prerenderizado parcial de Next.js, enviar antes de que
cargara React devolvía una página en blanco. Se detectó al probar la build de producción y se resolvió quitando action y desactivando
el botón hasta que la página está lista.
