from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..database import get_session
from ..models import Game, Player


ranking_bp = Blueprint("ranking", __name__)


@ranking_bp.get("")
def get_ranking():
    raw_limit = request.args.get("limit", "10")
    try:
        limit = int(raw_limit)
    except ValueError:
        return jsonify(error="limit must be an integer between 1 and 100"), 400
    if not 1 <= limit <= 100:
        return jsonify(error="limit must be an integer between 1 and 100"), 400

    results = (
        get_session()
        .query(Game, Player.name)
        .join(Player, Game.player_id == Player.id)
        .filter(Game.status == "completed")
        .order_by(Game.score.desc(), Game.finished_at.asc(), Game.id.asc())
        .limit(limit)
        .all()
    )
    return jsonify(
        [
            {
                "game_id": game.id,
                "player_id": game.player_id,
                "player_name": player_name,
                "score": game.score,
                "finished_at": game.finished_at.isoformat()
                if game.finished_at
                else None,
            }
            for game, player_name in results
        ]
    )
