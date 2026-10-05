from __future__ import annotations

import os

from flask import Flask, jsonify

from .database import init_database
from .routes.games import games_bp
from .routes.lifelines import lifelines_bp
from .routes.players import players_bp
from .routes.questions import questions_bp
from .routes.ranking import ranking_bp


def create_app(test_config: dict[str, object] | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_mapping(
        DATABASE_URL=os.environ.get(
            "DATABASE_URL", "sqlite:///backend/instance/millionaire.db"
        )
    )
    if test_config:
        app.config.update(test_config)

    init_database(app)
    app.register_blueprint(players_bp, url_prefix="/api/players")
    app.register_blueprint(games_bp, url_prefix="/api/games")
    app.register_blueprint(questions_bp, url_prefix="/api/questions")
    app.register_blueprint(lifelines_bp, url_prefix="/api/lifelines")
    app.register_blueprint(ranking_bp, url_prefix="/api/ranking")

    @app.errorhandler(400)
    @app.errorhandler(404)
    @app.errorhandler(405)
    @app.errorhandler(415)
    def handle_http_error(error: Exception):
        status = getattr(error, "code", 500)
        description = getattr(error, "description", "Request failed")
        return jsonify(error=description), status

    return app


if __name__ == "__main__":
    create_app().run(debug=False)
