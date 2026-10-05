# 🎮 Millionaire Game — Guía de Frontend (alineada con el Backend)

> Esta versión usa los **nombres exactos** del backend (Flask + SQLite). Si el backend cambia algo, se actualiza aquí.

## 1. Objetivo y tecnologías

El frontend muestra la interfaz, recibe las acciones del jugador y consume la API. **El backend decide y guarda; el frontend pide y muestra.**

- HTML5, CSS3, JavaScript vanilla, Fetch API, JSON
- Opcional: Web Audio API
- Funciona en `localhost` / red local, sin Internet

## 2. Estilo visual

Fondo azul oscuro, dorado para dinero, rosa/morado para botones, botones A–D grandes, animaciones verde/rojo, panel de comodines, marcador de dinero, pantallas de victoria y derrota. Diseño original, sin recursos protegidos.

## 3. Estructura

```text
frontend/
├── index.html   game.html   results.html   ranking.html
├── css/  main.css  game.css  ranking.css  animations.css
├── js/   api.js  main.js  game.js  results.js  ranking.js
└── assets/  images/  characters/  icons/  sounds/
```

## 4. Pantallas

- **index.html**: nombre, JUGAR, RANKING, INSTRUCCIONES. Al pulsar JUGAR → crear jugador → crear partida → `game.html`.
- **game.html**: pregunta, opciones A–D, número de pregunta (n/15), premio actual, comodines, botón **Retirarse**.
- **results.html**: victoria / derrota / retirada con premio final.
- **ranking.html**: tabla Top 10.

## 5. Configuración de la API (`js/api.js`)

URL base acordada: `http://127.0.0.1:5000/api` (si Flask sirve el frontend: `"/api"`).

```javascript
const API_URL = "http://127.0.0.1:5000/api";

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
        const err = new Error(data.error || "Error en la petición");
        err.status = response.status;   // 400, 404, 409, 500
        throw err;
    }
    return data;
}

const api = {
    createPlayer: (name)      => apiRequest("/players", { method: "POST", body: JSON.stringify({ name }) }),
    createGame:   (playerId)  => apiRequest("/games",   { method: "POST", body: JSON.stringify({ player_id: playerId }) }),
    getQuestions: ()          => apiRequest("/questions"),
    answer:       (gid, qid, a) => apiRequest(`/games/${gid}/answers`, { method: "POST", body: JSON.stringify({ question_id: qid, answer: a }) }),
    lifeline:     (gid, type) => apiRequest(`/games/${gid}/lifelines/${type}`, { method: "POST" }), // "5050" | "audience" | "friend"
    quit:         (gid)       => apiRequest(`/games/${gid}/quit`,   { method: "POST" }),
    finish:       (gid, won)  => apiRequest(`/games/${gid}/finish`, { method: "POST", body: JSON.stringify({ won }) }),
    getRanking:   ()          => apiRequest("/ranking")
};
```

## 6. Contrato de endpoints

| Método | Endpoint | Request | Response |
|---|---|---|---|
| POST | `/players` | `{name}` | `{success, player:{id,name}}` (201) |
| POST | `/games` | `{player_id}` | `{game:{id,player_id,current_question,current_prize}}` |
| GET | `/questions` | — | `{questions:[{id,question,options:{A,B,C,D},difficulty,prize}]}` |
| POST | `/games/{id}/answers` | `{question_id, answer}` | `{correct, correct_answer, prize, game_finished}` |
| POST | `/games/{id}/lifelines/5050` | — | `{removed_options:[..]}` |
| POST | `/games/{id}/lifelines/audience` | — | `{percentages:{A,B,C,D}}` |
| POST | `/games/{id}/lifelines/friend` | — | `{message}` |
| POST | `/games/{id}/quit` | — | `{success, final_prize}` |
| POST | `/games/{id}/finish` | `{won}` | `{success, final_prize}` |
| GET | `/ranking` | — | `{ranking:[{position,player,prize}]}` |

**Errores:** `{ "success": false, "error": "mensaje" }` con códigos 400 (datos inválidos), 404 (no existe), 409 (comodín ya usado), 500.

### Reglas importantes
- `GET /questions` **no** trae `correct_answer`; solo llega tras responder.
- El frontend **nunca envía el premio**: lo calcula el backend (`finish` solo recibe `won`).
- Usar `difficulty` (no `level`) y `current_prize` (no `prize`) al crear partida.
- Terminar la partida se decide con `game_finished`, no con `next_question`.

## 7. Estado de la partida

```javascript
let gameState = {
    playerId: null,
    gameId: null,
    questions: [],          // sin respuestas correctas
    questionIndex: 0,
    currentPrize: 0,
    usedLifelines: { fiftyFifty: false, audience: false, friend: false },
    answering: false        // evita doble envío
};
```

Guardar `playerId` y `gameId` en `sessionStorage` para que `results.html` los use.

## 8. Flujo del juego

```text
index.html: nombre → createPlayer → createGame → guardar ids → game.html
game.html:  getQuestions → mostrar pregunta[questionIndex]
  jugador elige → answering=true, deshabilitar botones
  answer(gameId, question.id, letra)
     correct=true  y game_finished=false → verde, actualizar prize, siguiente pregunta
     correct=true  y game_finished=true  → victoria → finish(gameId, true) → results.html
     correct=false (game_finished=true)  → rojo + mostrar correct_answer → results.html
  Retirarse → quit(gameId) → results.html con final_prize
```

Al responder: deshabilitar opciones, animar, pintar verde la elegida si acierta; si falla, rojo la elegida y verde la `correct_answer` devuelta.

## 9. Comodines

- **50/50**: `removed_options` → ocultar/deshabilitar esas letras.
- **Público**: `percentages` → gráfica de barras (suman 100).
- **Amigo**: `message` → globo de diálogo.
- Si responde **409**, mostrar "Este comodín ya fue usado" y marcarlo como gastado.
- Marcar el comodín como usado en `usedLifelines` y desactivar su botón.

## 10. Manejo de errores

Todo con `try/catch`:

```javascript
try {
    const data = await api.getRanking();
} catch (error) {
    if (error.status === undefined) {
        showError("⚠️ No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose.");
    } else {
        showError(error.message);
    }
}
```

## 11. Reglas de frontend

- No acceder a SQLite ni guardar respuestas correctas o secretos en JS.
- Validar nombre (vacío, muy largo) antes de enviar.
- Deshabilitar botones mientras se espera; evitar envíos duplicados.
- Separar lógica de API (`api.js`) y lógica visual.
- Usar `async/await`.
- Diseño responsive básico.

## 12. Pruebas

Nombre vacío / muy largo, inicio de partida, respuesta correcta e incorrecta, doble clic, 50/50, comodín repetido (409), retirarse, llegar a la pregunta 15, ranking vacío, backend apagado, partida terminada (no permitir responder).

## 13. Puntos por confirmar con el compañero

1. ¿`prize` en la respuesta de `/answers` es el premio **ganado** o el de la **siguiente** pregunta? (el ejemplo muestra 200 tras acertar la pregunta 1).
2. Al fallar, el backend devuelve `prize: 0`; ¿se aplican niveles seguros (p. ej. 4.000)? Si sí, ¿en qué campo llega?
3. ¿`/finish` solo se llama al ganar y `/quit` al retirarse? Al fallar, ¿el backend ya cierra la partida solo (`game_finished: true`)?
4. ¿`/questions` llega ya ordenado por `difficulty` y son 15 preguntas?
5. ¿`/ranking` y errores usan exactamente los formatos de arriba?

## 14. Entregables del frontend

Interfaz completa, responsive básico, animaciones, pantallas, JS, consumo de API, manejo de errores, ranking visual, pantalla final y documentación.
