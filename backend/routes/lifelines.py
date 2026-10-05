from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..database import get_session
from ..models import Lifeline
from .common import (
    commit_or_error,
    json_body,
    not_found,
    parse_datetime,
    unknown_fields,
)


lifelines_bp = Blueprint("lifelines", __name__)
LIFELINE_FIELDS = {"game_id", "kind", "used_at"}


def serialize_lifeline(lifeline: Lifeline) -> dict[str, object]:
    return {
        "id": lifeline.id,
        "game_id": lifeline.game_id,
        "kind": lifeline.kind,
        "used_at": lifeline.used_at.isoformat() if lifeline.used_at else None,
    }


def validate_lifeline_data(
    data: dict, *, creating: bool
) -> tuple[dict | None, str | None]:
    invalid = unknown_fields(data, LIFELINE_FIELDS)
    if invalid:
        return None, f"Unknown fields: {', '.join(sorted(invalid))}"
    if creating and not {"game_id", "kind"} <= set(data):
        return None, "game_id and kind are required"
    values = {}
    if "game_id" in data:
        game_id = data["game_id"]
        if not isinstance(game_id, int) or isinstance(game_id, bool) or game_id <= 0:
            return None, "game_id must be a positive integer"
        values["game_id"] = game_id
    if "kind" in data:
        kind = data["kind"]
        if not isinstance(kind, str) or not kind.strip() or len(kind.strip()) > 50:
            return None, "kind must be a non-empty string of at most 50 characters"
        values["kind"] = kind.strip()
    if "used_at" in data:
        used_at, error = parse_datetime(data["used_at"], "used_at")
        if error:
            return None, error
        values["used_at"] = used_at
    return values, None


@lifelines_bp.get("")
def list_lifelines():
    lifelines = get_session().query(Lifeline).order_by(Lifeline.id).all()
    return jsonify([serialize_lifeline(lifeline) for lifeline in lifelines])


@lifelines_bp.post("")
def create_lifeline():
    data, error = json_body()
    if error:
        return error
    assert data is not None
    values, validation_error = validate_lifeline_data(data, creating=True)
    if validation_error:
        return jsonify(error=validation_error), 400
    assert values is not None

    session = get_session()
    lifeline = Lifeline(**values)
    session.add(lifeline)
    error = commit_or_error(session)
    if error:
        return error
    return jsonify(serialize_lifeline(lifeline)), 201


@lifelines_bp.get("/<int:lifeline_id>")
def get_lifeline(lifeline_id: int):
    lifeline = get_session().get(Lifeline, lifeline_id)
    if lifeline is None:
        return not_found("Lifeline")
    return jsonify(serialize_lifeline(lifeline))


@lifelines_bp.route("/<int:lifeline_id>", methods=["PUT", "PATCH"])
def update_lifeline(lifeline_id: int):
    data, error = json_body()
    if error:
        return error
    assert data is not None
    if request.method == "PUT" and not {"game_id", "kind"} <= set(data):
        return jsonify(error="PUT requires game_id and kind"), 400
    values, validation_error = validate_lifeline_data(data, creating=False)
    if validation_error:
        return jsonify(error=validation_error), 400
    assert values is not None
    if not values:
        return jsonify(error="At least one field is required"), 400

    session = get_session()
    lifeline = session.get(Lifeline, lifeline_id)
    if lifeline is None:
        return not_found("Lifeline")
    for field, value in values.items():
        setattr(lifeline, field, value)
    error = commit_or_error(session)
    if error:
        return error
    return jsonify(serialize_lifeline(lifeline))


@lifelines_bp.delete("/<int:lifeline_id>")
def delete_lifeline(lifeline_id: int):
    session = get_session()
    lifeline = session.get(Lifeline, lifeline_id)
    if lifeline is None:
        return not_found("Lifeline")
    session.delete(lifeline)
    error = commit_or_error(session)
    if error:
        return error
    return "", 204
