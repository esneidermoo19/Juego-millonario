# Juego millonario

## API y backend (Explicación)

Este repositorio incluye un backend en Flask que expone una API REST para el
juego "Juego millonario". A continuación se explican los puntos esenciales
para usar y comprender el backend.

1) Arrancar la API

Desde la raíz del repositorio, se puede iniciar la aplicación con:

```bash
python -m backend.app
```

Por defecto usa SQLite y crea una base de datos en `backend/instance/millionaire.db`.
Para apuntar a otra base de datos compatible con SQLAlchemy, exporta `DATABASE_URL`:

```bash
DATABASE_URL=sqlite:///backend/instance/millionaire.db python -m backend.app
```

2) Estructura principal del backend

- `backend/models/` — modelos SQLAlchemy:
  - `Player` (players)
  - `Game` (games)
  - `Question` (questions)
  - `Lifeline` (lifelines)

  Estos modelos definen las tablas y las relaciones (por ejemplo, Player -> Game).
  Al iniciar la aplicación el módulo de inicialización crea las tablas si no existen
  (Base.metadata.create_all(engine)).

- `backend/database.py` — inicialización del engine de SQLAlchemy, factory de sesiones
  y helpers para abrir/cerrar sesiones por request.

- `backend/routes/` — blueprints con los endpoints para cada recurso y el ranking:
  - `/api/players` — CRUD de jugadores
  - `/api/games` — CRUD de partidas
  - `/api/questions` — CRUD de preguntas
  - `/api/lifelines` — CRUD de comodines
- `/api/ranking` — consulta derivada del ranking (solo GET)

El flujo de juego también expone `POST /api/games/<id>/answers`,
`POST /api/games/<id>/lifelines/<5050|audience|friend>`,
`POST /api/games/<id>/quit` y `POST /api/games/<id>/finish`. La interfaz usa
`GET /api/questions/game`, que entrega las preguntas sin revelar sus respuestas.
En la base local predeterminada se cargan 15 preguntas de ejemplo al iniciar si
la tabla está vacía.

- `backend/app.py` — fábrica de la aplicación Flask que registra los blueprints y
  configura la URL de la base de datos.

3) Formato y códigos HTTP

- Todas las solicitudes que crean o actualizan recursos deben enviar JSON con
  cabecera `Content-Type: application/json`.
- Las creaciones devuelven `201 Created` con el recurso creado.
- Las eliminaciones exitosas devuelven `204 No Content`.
- Errores de validación devuelven `4xx` con cuerpo JSON `{ "error": "..." }`.
- Conflictos de integridad de base de datos (por ejemplo, FK inexistente) devuelven `409`.

4) Rutas y parámetros importantes

- `GET /api/games?player_id=<id>` filtra partidas por jugador.
- `GET /api/ranking?limit=<1-100>` devuelve las mejores partidas completadas,
  ordenadas por score, con un límite opcional entre 1 y 100.

5) Estado actual de la base de datos en `backend/instance/millionaire.db`

Se verificó el archivo `backend/instance/millionaire.db` incluido en el repositorio
para comprobar si ya contiene tablas. Resultado de la comprobación local:

- Archivo: `backend/instance/millionaire.db`
- Tablas encontradas: ninguna (la lista está vacía)

Esto significa que, aunque el archivo existe en `backend/instance`, actualmente no
hay tablas creadas dentro de él. Al iniciar la aplicación con la configuración
predeterminada (o con `DATABASE_URL` apuntando a ese fichero), el backend intentará
crear las tablas automáticamente si la conexión al fichero es válida.

6) Recomendaciones

- Si se desea partir de una base de datos poblada, ejecutar la app localmente
  (con `DATABASE_URL` apuntando al fichero) y comprobar que las tablas se han creado
  o ejecutar un script de migración/seed según se diseñe.
- Hacer copias de seguridad del fichero `backend/instance/millionaire.db` antes de
  rellenarlo manualmente.

Si quieres, puedo:
- Añadir un script de ejemplo para poblar preguntas de muestra.
- Ejecutar la creación de tablas ahora mismo contra `backend/instance/millionaire.db`
  desde el entorno y reportar cualquier error (por ejemplo permisos o compatibilidad).
- Preparar endpoints de documentación (OpenAPI) para facilitar pruebas.

