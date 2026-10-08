from __future__ import annotations

from datetime import datetime, timezone
import random

from flask import Blueprint, jsonify, request

from ..database import get_session
from ..models import Game, Lifeline
from ..services.game_service import (
    LETTERS,
    displayed_correct_letter,
    options_for_game,
    questions_for_game,
)
from ..services.question_translations import english_question
from .common import (
    commit_or_error,
    json_body,
    not_found,
    parse_datetime,
    unknown_fields,
)


games_bp = Blueprint("games", __name__)
GAME_FIELDS = {
    "player_id",
    "status",
    "current_question_number",
    "score",
    "finished_at",
}
GAME_STATUSES = {"in_progress", "completed", "abandoned"}
PRIZES = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000]


def serialize_game(game: Game) -> dict[str, object]:
    return {
        "id": game.id,
        "player_id": game.player_id,
        "status": game.status,
        "current_question_number": game.current_question_number,
        "score": game.score,
        "started_at": game.started_at.isoformat(),
        "finished_at": game.finished_at.isoformat() if game.finished_at else None,
    }


def validate_game_data(data: dict, *, creating: bool) -> tuple[dict | None, str | None]:
    invalid = unknown_fields(data, GAME_FIELDS)
    if invalid:
        return None, f"Unknown fields: {', '.join(sorted(invalid))}"
    if creating and "player_id" not in data:
        return None, "player_id is required"
    validated = {}
    for field in ("player_id", "current_question_number", "score"):
        if field not in data:
            continue
        value = data[field]
        if not isinstance(value, int) or isinstance(value, bool):
            return None, f"{field} must be an integer"
        if value < 0 or (field == "player_id" and value == 0):
            message = (
                f"{field} must be a positive integer"
                if field == "player_id"
                else f"{field} cannot be negative"
            )
            return None, message
        validated[field] = value

    if "status" in data:
        if not isinstance(data["status"], str) or data["status"] not in GAME_STATUSES:
            return None, "status must be in_progress, completed, or abandoned"
        validated["status"] = data["status"]
    if "finished_at" in data:
        parsed, error = parse_datetime(data["finished_at"], "finished_at")
        if error:
            return None, error
        validated["finished_at"] = parsed
    return validated, None


@games_bp.get("")
def list_games():
    session = get_session()
    query = session.query(Game).order_by(Game.id)
    raw_player_id = request.args.get("player_id")
    if raw_player_id is not None:
        try:
            player_id = int(raw_player_id)
        except ValueError:
            return jsonify(error="player_id must be a positive integer"), 400
        if player_id <= 0:
            return jsonify(error="player_id must be a positive integer"), 400
        query = query.filter(Game.player_id == player_id)
    return jsonify([serialize_game(game) for game in query.all()])


@games_bp.post("")
def create_game():
    data, error = json_body()
    if error:
        return error
    assert data is not None
    values, validation_error = validate_game_data(data, creating=True)
    if validation_error:
        return jsonify(error=validation_error), 400
    assert values is not None

    session = get_session()
    game = Game(**values)
    session.add(game)
    error = commit_or_error(session)
    if error:
        return error
    return jsonify(serialize_game(game)), 201


@games_bp.get("/<int:game_id>")
def get_game(game_id: int):
    game = get_session().get(Game, game_id)
    if game is None:
        return not_found("Game")
    return jsonify(serialize_game(game))


@games_bp.route("/<int:game_id>", methods=["PUT", "PATCH"])
def update_game(game_id: int):
    data, error = json_body()
    if error:
        return error
    assert data is not None
    if request.method == "PUT" and not {
        "player_id",
        "status",
        "current_question_number",
        "score",
    } <= set(data):
        return jsonify(
            error="PUT requires player_id, status, current_question_number, and score"
        ), 400
    values, validation_error = validate_game_data(data, creating=False)
    if validation_error:
        return jsonify(error=validation_error), 400
    assert values is not None
    if not values:
        return jsonify(error="At least one field is required"), 400

    session = get_session()
    game = session.get(Game, game_id)
    if game is None:
        return not_found("Game")
    for field, value in values.items():
        setattr(game, field, value)
    error = commit_or_error(session)
    if error:
        return error
    return jsonify(serialize_game(game))


@games_bp.delete("/<int:game_id>")
def delete_game(game_id: int):
    session = get_session()
    game = session.get(Game, game_id)
    if game is None:
        return not_found("Game")
    session.delete(game)
    error = commit_or_error(session)
    if error:
        return error
    return "", 204


def active_game(session, game_id):
    game = session.get(Game, game_id)
    if game is None:
        return None, (jsonify(error="Game not found"), 404)
    if game.status != "in_progress":
        return None, (jsonify(error="Game is already finished"), 409)
    return game, None


@games_bp.post("/<int:game_id>/answers")
def answer_game(game_id: int):
    data, error = json_body()
    if error:
        return error
    data = data or {}
    question_id, answer = data.get("question_id"), data.get("answer")
    if (not isinstance(question_id, int) or isinstance(question_id, bool)
            or not isinstance(answer, str) or answer not in {"A", "B", "C", "D"}):
        return jsonify(error="question_id and answer (A, B, C, or D) are required"), 400
    session = get_session()
    game, error = active_game(session, game_id)
    if error:
        return error
    questions = questions_for_game(session, game_id)
    index = game.current_question_number
    if index >= len(questions) or questions[index].id != question_id:
        return jsonify(error="Question is not the current question"), 400
    question = questions[index]
    correct_answer = displayed_correct_letter(question, game_id)
    correct = answer == correct_answer
    if correct:
        game.current_question_number += 1
        game.score = PRIZES[min(index, len(PRIZES) - 1)]
        finished = game.current_question_number >= min(len(questions), len(PRIZES))
        if finished:
            game.status = "completed"
            game.finished_at = datetime.now(timezone.utc)
    else:
        game.score = 32000 if index >= 10 else 1000 if index >= 5 else 0
        game.status = "completed"
        game.finished_at = datetime.now(timezone.utc)
        finished = True
    session.commit()
    result = {"correct": correct, "prize": game.score, "game_finished": finished}
    if not correct:
        result["correct_answer"] = correct_answer
    return jsonify(result)


@games_bp.post("/<int:game_id>/timeout")
def timeout_game(game_id: int):
    """Finish the active game when the player runs out of time on the current question."""
    data, error = json_body()
    if error:
        return error
    question_id = (data or {}).get("question_id")
    if not isinstance(question_id, int) or isinstance(question_id, bool):
        return jsonify(error="question_id is required"), 400
    session = get_session()
    game, error = active_game(session, game_id)
    if error:
        return error
    questions = questions_for_game(session, game_id)
    index = game.current_question_number
    if index >= len(questions) or questions[index].id != question_id:
        return jsonify(error="Question is not the current question"), 400
    game.score = 32000 if index >= 10 else 1000 if index >= 5 else 0
    game.status = "completed"
    game.finished_at = datetime.now(timezone.utc)
    session.commit()
    return jsonify(correct=False, prize=game.score, game_finished=True)


@games_bp.post("/<int:game_id>/lifelines/<kind>")
def use_lifeline(game_id: int, kind: str):
    aliases = {"5050": "5050", "audience": "audience", "friend": "friend"}
    if kind not in aliases:
        return jsonify(error="Unknown lifeline"), 404
    session = get_session()
    game, error = active_game(session, game_id)
    if error:
        return error
    if session.query(Lifeline).filter_by(game_id=game_id, kind=kind).first():
        return jsonify(error="Lifeline already used"), 409
    questions = questions_for_game(session, game_id)
    index = game.current_question_number
    if index >= len(questions):
        return jsonify(error="No current question"), 409
    question = questions[index]
    correct_answer = displayed_correct_letter(question, game_id)
    displayed_options = options_for_game(question, game_id)
    language = request.args.get("language", "es").lower()
    translated = english_question(question) if language == "en" else None
    if language == "en" and translated is None:
        return jsonify(error="An English translation is not available for this question"), 409
    option_text = {
        letter: (translated[1][LETTERS.index(source_letter)] if translated else text)
        for letter, (source_letter, text) in zip(LETTERS, displayed_options)
    }
    session.add(Lifeline(game_id=game_id, kind=kind, used_at=datetime.now(timezone.utc)))
    if kind == "5050":
        wrong = [letter for letter in LETTERS if letter != correct_answer]
        response = {"removed_options": random.sample(wrong, 2)}
    elif kind == "audience":
        wrong = [letter for letter in LETTERS if letter != correct_answer]
        percentages = {letter: random.randint(0, 15) for letter in wrong}
        percentages[correct_answer] = 100 - sum(percentages.values())
        response = {"percentages": percentages}
    else:
        if language == "en":
            response = {"message": f"I think the correct answer is {correct_answer}: {option_text[correct_answer]}."}
        else:
            response = {"message": f"Creo que la respuesta correcta es {correct_answer}: {option_text[correct_answer]}."}
    session.commit()
    return jsonify(response)


@games_bp.post("/<int:game_id>/quit")
def quit_game(game_id: int):
    session = get_session()
    game, error = active_game(session, game_id)
    if error:
        return error
    game.status = "abandoned"
    game.finished_at = datetime.now(timezone.utc)
    session.commit()
    return jsonify(success=True, final_prize=game.score)


@games_bp.post("/<int:game_id>/finish")
def finish_game(game_id: int):
    data, error = json_body()
    if error:
        return error
    won = (data or {}).get("won")
    if not isinstance(won, bool):
        return jsonify(error="won must be a boolean"), 400
    session = get_session()
    game, error = active_game(session, game_id)
    if error:
        return error
    if won:
        game.score = PRIZES[-1]
    game.status = "completed"
    game.finished_at = datetime.now(timezone.utc)
    session.commit()
    return jsonify(success=True, final_prize=game.score)
