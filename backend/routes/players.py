from __future__ import annotations

from flask import Blueprint, jsonify

from ..database import get_session
from ..models import Player
from .common import commit_or_error, json_body, not_found, unknown_fields


players_bp = Blueprint("players", __name__)
PLAYER_FIELDS = {"name"}


def serialize_player(player: Player) -> dict[str, object]:
    return {
        "id": player.id,
        "name": player.name,
        "created_at": player.created_at.isoformat(),
    }


@players_bp.get("")
def list_players():
    players = get_session().query(Player).order_by(Player.id).all()
    return jsonify([serialize_player(player) for player in players])


@players_bp.post("")
def create_player():
    data, error = json_body()
    if error:
        return error
    assert data is not None
    invalid = unknown_fields(data, PLAYER_FIELDS)
    if invalid:
        return jsonify(error=f"Unknown fields: {', '.join(sorted(invalid))}"), 400
    name = data.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
        return jsonify(error="name must be a non-empty string of at most 100 characters"), 400

    session = get_session()
    player = Player(name=name.strip())
    session.add(player)
    error = commit_or_error(session)
    if error:
        return error
    return jsonify(serialize_player(player)), 201


@players_bp.get("/<int:player_id>")
def get_player(player_id: int):
    player = get_session().get(Player, player_id)
    if player is None:
        return not_found("Player")
    return jsonify(serialize_player(player))


@players_bp.route("/<int:player_id>", methods=["PUT", "PATCH"])
def update_player(player_id: int):
    data, error = json_body()
    if error:
        return error
    assert data is not None
    invalid = unknown_fields(data, PLAYER_FIELDS)
    if invalid:
        return jsonify(error=f"Unknown fields: {', '.join(sorted(invalid))}"), 400
    if "name" not in data:
        return jsonify(error="name is required"), 400
    name = data["name"]
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
        return jsonify(error="name must be a non-empty string of at most 100 characters"), 400

    session = get_session()
    player = session.get(Player, player_id)
    if player is None:
        return not_found("Player")
    player.name = name.strip()
    error = commit_or_error(session)
    if error:
        return error
    return jsonify(serialize_player(player))


@players_bp.delete("/<int:player_id>")
def delete_player(player_id: int):
    session = get_session()
    player = session.get(Player, player_id)
    if player is None:
        return not_found("Player")
    session.delete(player)
    error = commit_or_error(session)
    if error:
        return error
    return "", 204
