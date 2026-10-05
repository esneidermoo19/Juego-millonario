from __future__ import annotations

from pathlib import Path

from flask import Flask, current_app, g
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from .models import Base, Question


STARTER_QUESTIONS = [
    ("¿Cuál es la capital de Colombia?", "Medellín", "Bogotá", "Cali", "Cartagena", "B"),
    ("¿Cuántos lados tiene un triángulo?", "2", "3", "4", "5", "B"),
    ("¿Qué planeta es conocido como el planeta rojo?", "Venus", "Marte", "Júpiter", "Saturno", "B"),
    ("¿Cuál es el océano más grande?", "Atlántico", "Índico", "Ártico", "Pacífico", "D"),
    ("¿Qué gas absorben principalmente las plantas?", "Oxígeno", "Nitrógeno", "Dióxido de carbono", "Helio", "C"),
    ("¿Quién escribió Cien años de soledad?", "Mario Vargas Llosa", "Gabriel García Márquez", "Jorge Luis Borges", "Pablo Neruda", "B"),
    ("¿Cuántos minutos tiene una hora?", "50", "60", "70", "100", "B"),
    ("¿Cuál es el símbolo químico del oro?", "Ag", "Fe", "Au", "O", "C"),
    ("¿En qué continente está Egipto?", "Asia", "África", "Europa", "Oceanía", "B"),
    ("¿Qué órgano bombea la sangre?", "Pulmón", "Cerebro", "Hígado", "Corazón", "D"),
    ("¿Cuál es el resultado de 12 × 12?", "124", "144", "132", "154", "B"),
    ("¿Qué instrumento mide la temperatura?", "Barómetro", "Termómetro", "Anemómetro", "Higrómetro", "B"),
    ("¿Cuál es la moneda oficial de Japón?", "Yuan", "Won", "Yen", "Rupia", "C"),
    ("¿Qué científico formuló la teoría de la relatividad?", "Isaac Newton", "Galileo Galilei", "Albert Einstein", "Nikola Tesla", "C"),
    ("¿Cuál es el número primo más pequeño?", "0", "1", "2", "3", "C"),
]


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
    # La base de datos local del juego queda lista para usar desde la primera ejecución.
    if database_url == "sqlite:///backend/instance/millionaire.db":
        factory = app.extensions["database_session_factory"]
        with factory() as session:
            if session.query(Question).count() == 0:
                for difficulty, (text, a, b, c, d, answer) in enumerate(STARTER_QUESTIONS, 1):
                    session.add(Question(text=text, option_a=a, option_b=b, option_c=c, option_d=d,
                                         correct_option=answer, difficulty=difficulty))
                session.commit()
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
