/**
 * Configuración y llamadas a la API (Millionaire Game)
 * Alineado exactamente con el contrato del backend en Fronted.md
 */

const API_URL = window.location.protocol === "file:"
    ? "http://127.0.0.1:5000/api"
    : `${window.location.origin}/api`;

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    let data = {};
    try { 
        data = await response.json(); 
    } catch (_) {}

    if (!response.ok) {
        const err = new Error(data.error || "Error en la petición al servidor");
        err.status = response.status; // 400, 404, 409, 500
        throw err;
    }
    return data;
}

const api = {
    // 1. Crear jugador: { name } -> { success, player: { id, name } }
    createPlayer: async (name) => {
        const player = await apiRequest("/players", { method: "POST", body: JSON.stringify({ name }) });
        return { player };
    },

    // 2. Crear partida: { player_id } -> { game: { id, player_id, current_question, current_prize } }
    createGame: async (playerId) => {
        const game = await apiRequest("/games", { method: "POST", body: JSON.stringify({ player_id: playerId }) });
        return { game };
    },

    // 3. Obtener 15 preguntas: -> { questions: [{ id, question, options: {A,B,C,D}, difficulty, prize }] }
    getQuestions: async () => {
        const rows = await apiRequest("/questions/game");
        const questions = (Array.isArray(rows) ? rows : rows.questions || []).map((row) => ({
            id: row.id,
            question: row.text || row.question,
            options: row.options || { A: row.option_a, B: row.option_b, C: row.option_c, D: row.option_d },
            difficulty: row.difficulty,
            prize: row.prize
        }));
        return { questions };
    },

    // 4. Responder: { question_id, answer } -> { correct, correct_answer, prize, game_finished }
    answer: (gid, qid, a) => 
        apiRequest(`/games/${gid}/answers`, { method: "POST", body: JSON.stringify({ question_id: qid, answer: a }) }),

    // 5. Usar comodín: type = "5050" | "audience" | "friend"
    lifeline: (gid, type) => 
        apiRequest(`/games/${gid}/lifelines/${type}`, { method: "POST" }),

    // 6. Retirarse: -> { success, final_prize }
    quit: (gid) => 
        apiRequest(`/games/${gid}/quit`, { method: "POST" }),

    // 7. Finalizar partida por victoria: { won: true } -> { success, final_prize }
    finish: (gid, won) => 
        apiRequest(`/games/${gid}/finish`, { method: "POST", body: JSON.stringify({ won }) }),

    // 8. Obtener tabla de clasificación: -> { ranking: [{ position, player, prize }] }
    getRanking: async () => {
        const rows = await apiRequest("/ranking");
        const ranking = (Array.isArray(rows) ? rows : rows.ranking || []).map((row, index) => ({
            position: index + 1,
            player: row.player || row.player_name,
            prize: row.prize !== undefined ? row.prize : row.score
        }));
        return { ranking };
    }
};

// Exportar globalmente para scripts del navegador
window.api = api;
