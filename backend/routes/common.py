from __future__ import annotations

from datetime import datetime
from typing import Any

from flask import jsonify, request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def json_body() -> tuple[dict[str, Any] | None, Any | None]:
    if not request.is_json:
        return None, (jsonify(error="Content-Type must be application/json"), 415)

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify(error="Request body must be a JSON object"), 400)
    return data, None


def parse_datetime(value: Any, field: str) -> tuple[datetime | None, str | None]:
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, f"{field} must be an ISO-8601 datetime"
    try:
        return datetime.fromisoformat(value), None
    except ValueError:
        return None, f"{field} must be an ISO-8601 datetime"


def commit_or_error(session: Session) -> Any | None:
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return jsonify(error="The resource conflicts with existing data"), 409
    return None


def not_found(resource: str) -> Any:
    return jsonify(error=f"{resource} not found"), 404


def unknown_fields(data: dict[str, Any], allowed: set[str]) -> set[str]:
    return set(data) - allowed
