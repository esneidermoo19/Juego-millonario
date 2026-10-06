from __future__ import annotations

import random

from sqlalchemy.orm import Session

from ..models import Question


LETTERS = ("A", "B", "C", "D")


def questions_for_game(session: Session, game_id: int) -> list[Question]:
    """Choose a repeatable random set of 15 and keep difficulty bands in sequence."""
    questions = session.query(Question).order_by(Question.difficulty, Question.id).all()
    if len(questions) < 2:
        return questions

    rng = random.Random(f"game-questions-{game_id}")
    first_cut = len(questions) // 3
    second_cut = (2 * len(questions)) // 3
    bands = (
        questions[:first_cut],
        questions[first_cut:second_cut],
        questions[second_cut:],
    )
    randomized: list[Question] = []
    for band in bands:
        randomized.extend(rng.sample(band, min(5, len(band))))
    return randomized


def options_for_game(question: Question, game_id: int) -> list[tuple[str, str]]:
    """Shuffle the displayed options while retaining their original answer keys."""
    options = [
        ("A", question.option_a),
        ("B", question.option_b),
        ("C", question.option_c),
        ("D", question.option_d),
    ]
    random.Random(f"game-options-{game_id}-{question.id}").shuffle(options)
    return options


def displayed_correct_letter(question: Question, game_id: int) -> str:
    for letter, (original_letter, _) in zip(LETTERS, options_for_game(question, game_id)):
        if original_letter == question.correct_option:
            return letter
    raise ValueError("Question has no valid correct option")
