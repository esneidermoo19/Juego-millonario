from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..database import get_session
from ..models import Game
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
