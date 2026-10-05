from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Lifeline(Base):
    __tablename__ = "lifelines"
    __table_args__ = (
        UniqueConstraint("game_id", "kind", name="uq_lifelines_game_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(
        ForeignKey("games.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=None, nullable=True
    )

    game: Mapped[Game] = relationship(back_populates="lifelines")
