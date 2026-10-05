from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        CheckConstraint("score >= 0", name="ck_games_score_nonnegative"),
        CheckConstraint(
            "current_question_number >= 0",
            name="ck_games_question_number_nonnegative",
        ),
        CheckConstraint(
            "status IN ('in_progress', 'completed', 'abandoned')",
            name="ck_games_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="in_progress"
    )
    current_question_number: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    player: Mapped[Player] = relationship(back_populates="games")
    lifelines: Mapped[list[Lifeline]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )
