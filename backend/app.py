from __future__ import annotations

import os

from flask import Flask, jsonify
from dotenv import load_dotenv

from .database import init_database
from .routes.games import games_bp
from .routes.lifelines import lifelines_bp
from .routes.players import players_bp
from .routes.questions import questions_bp
from .routes.ranking import ranking_bp

load_dotenv()


def create_app(test_config: dict[str, object] | None = None) -> Flask:
    app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), '..', 'frontend'), static_url_path='')
    app.config.from_mapping(
        DATABASE_URL=os.environ.get(
            "DATABASE_URL", "sqlite:///backend/instance/millionaire.db"
        )
    )
    if test_config:
        app.config.update(test_config)

    init_database(app)

    # Allow frontend (static files) to be served from the project frontend/ folder
    # and add simple CORS headers so the SPA can call the backend.
    @app.after_request
    def _add_cors_headers(response):
        response.headers.setdefault("Access-Control-Allow-Origin", "*")
        response.headers.setdefault("Access-Control-Allow-Headers", "Content-Type")
        response.headers.setdefault(
            "Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        )
        return response

    # Serve index at root; static files are served from the configured static_folder.
    app.add_url_rule('/', 'index', lambda: app.send_static_file('index.html'))

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
    # Escucha en la red local para que otros dispositivos del mismo Wi-Fi
    # puedan abrir el juego usando la dirección IP de este equipo.
    create_app().run(host="0.0.0.0", port=5000, debug=False)
