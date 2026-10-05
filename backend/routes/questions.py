from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..database import get_session
from ..models import Question
from .common import commit_or_error, json_body, not_found, unknown_fields


questions_bp = Blueprint("questions", __name__)
QUESTION_FIELDS = {
    "text",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "correct_option",
    "category",
    "difficulty",
}
REQUIRED_QUESTION_FIELDS = {
    "text",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "correct_option",
}


def serialize_question(question: Question) -> dict[str, object]:
    return {
        "id": question.id,
        "text": question.text,
        "option_a": question.option_a,
        "option_b": question.option_b,
        "option_c": question.option_c,
        "option_d": question.option_d,
        "correct_option": question.correct_option,
        "category": question.category,
        "difficulty": question.difficulty,
    }


def validate_question_data(
    data: dict, *, creating: bool
) -> tuple[dict | None, str | None]:
    invalid = unknown_fields(data, QUESTION_FIELDS)
    if invalid:
        return None, f"Unknown fields: {', '.join(sorted(invalid))}"
    if creating:
        missing = REQUIRED_QUESTION_FIELDS - set(data)
        if missing:
            return None, f"Missing required fields: {', '.join(sorted(missing))}"
    values = {}
    for field in ("text", "option_a", "option_b", "option_c", "option_d"):
        if field in data:
            value = data[field]
            if not isinstance(value, str) or not value.strip():
                return None, f"{field} must be a non-empty string"
            if field != "text" and len(value) > 500:
                return None, f"{field} must be at most 500 characters"
            values[field] = value.strip()
    if "correct_option" in data:
        option = data["correct_option"]
        if not isinstance(option, str) or option.upper() not in {"A", "B", "C", "D"}:
            return None, "correct_option must be A, B, C, or D"
        values["correct_option"] = option.upper()
    if "category" in data:
        category = data["category"]
        if category is not None and (
            not isinstance(category, str) or len(category) > 100
        ):
            return None, "category must be a string of at most 100 characters or null"
        values["category"] = category.strip() if isinstance(category, str) else None
    if "difficulty" in data:
        difficulty = data["difficulty"]
        if difficulty is not None and (
            not isinstance(difficulty, int) or isinstance(difficulty, bool)
        ):
            return None, "difficulty must be an integer or null"
        values["difficulty"] = difficulty
    return values, None


@questions_bp.get("")
def list_questions():
    questions = get_session().query(Question).order_by(Question.id).all()
    return jsonify([serialize_question(question) for question in questions])


@questions_bp.post("")
def create_question():
    data, error = json_body()
    if error:
        return error
    assert data is not None
    values, validation_error = validate_question_data(data, creating=True)
    if validation_error:
        return jsonify(error=validation_error), 400
    assert values is not None

    session = get_session()
    question = Question(**values)
    session.add(question)
    error = commit_or_error(session)
    if error:
        return error
    return jsonify(serialize_question(question)), 201


@questions_bp.get("/<int:question_id>")
def get_question(question_id: int):
    question = get_session().get(Question, question_id)
    if question is None:
        return not_found("Question")
    return jsonify(serialize_question(question))


@questions_bp.route("/<int:question_id>", methods=["PUT", "PATCH"])
def update_question(question_id: int):
    data, error = json_body()
    if error:
        return error
    assert data is not None
    if request.method == "PUT" and not REQUIRED_QUESTION_FIELDS <= set(data):
        return jsonify(
            error=f"PUT requires: {', '.join(sorted(REQUIRED_QUESTION_FIELDS))}"
        ), 400
    values, validation_error = validate_question_data(data, creating=False)
    if validation_error:
        return jsonify(error=validation_error), 400
    assert values is not None
    if not values:
        return jsonify(error="At least one field is required"), 400

    session = get_session()
    question = session.get(Question, question_id)
    if question is None:
        return not_found("Question")
    for field, value in values.items():
        setattr(question, field, value)
    error = commit_or_error(session)
    if error:
        return error
    return jsonify(serialize_question(question))


@questions_bp.delete("/<int:question_id>")
def delete_question(question_id: int):
    session = get_session()
    question = session.get(Question, question_id)
    if question is None:
        return not_found("Question")
    session.delete(question)
    error = commit_or_error(session)
    if error:
        return error
    return "", 204
