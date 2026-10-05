from __future__ import annotations

from pathlib import Path

from flask import Flask, current_app, g
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from .models import Base


def init_database(app: Flask) -> None:
    database_url = app.config["DATABASE_URL"]
    if database_url.startswith("sqlite:///") and ":memory:" not in database_url:
        database_path = Path(database_url.removeprefix("sqlite:///"))
        database_path.parent.mkdir(parents=True, exist_ok=True)

    connect_args = (
        {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    )
    engine = create_engine(database_url, connect_args=connect_args)

    if database_url.startswith("sqlite"):
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)

    app.extensions["database_engine"] = engine
    app.extensions["database_session_factory"] = sessionmaker(
        bind=engine, expire_on_commit=False
    )
    Base.metadata.create_all(engine)
    app.teardown_appcontext(_close_session)


def get_session() -> Session:
    if "database_session" not in g:
        g.database_session = current_app.extensions["database_session_factory"]()
    return g.database_session


def _close_session(exception: BaseException | None = None) -> None:
    session = g.pop("database_session", None)
    if session is not None:
        if exception is not None:
            session.rollback()
        session.close()


def _enable_sqlite_foreign_keys(
    dbapi_connection: object, connection_record: object
) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
