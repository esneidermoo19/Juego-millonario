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
    ("¿Cuál es el río más largo de Sudamérica?", "Amazonas", "Paraná", "Orinoco", "Magdalena", "A"),
    ("¿En qué país se encuentra la Torre Eiffel?", "Italia", "Francia", "Bélgica", "Suiza", "B"),
    ("¿Cuál es la capital de Perú?", "Quito", "La Paz", "Lima", "Santiago", "C"),
    ("¿Qué país tiene forma de bota en el mapa?", "Grecia", "Portugal", "Italia", "Croacia", "C"),
    ("¿Cuál es la capital de Canadá?", "Toronto", "Vancouver", "Ottawa", "Montreal", "C"),
    ("¿En qué continente está el desierto del Sahara?", "Asia", "África", "América", "Oceanía", "B"),
    ("¿Cuál es la capital de Argentina?", "Córdoba", "Rosario", "Buenos Aires", "Mendoza", "C"),
    ("¿Qué mar separa Europa de África?", "Mar Caribe", "Mar Mediterráneo", "Mar Báltico", "Mar del Norte", "B"),
    ("¿Cuál es la montaña más alta del mundo sobre el nivel del mar?", "K2", "Kilimanjaro", "Everest", "Aconcagua", "C"),
    ("¿Cuál es la capital de Brasil?", "Río de Janeiro", "São Paulo", "Brasilia", "Salvador", "C"),
    ("¿Qué país es conocido por sus molinos de viento y tulipanes?", "Dinamarca", "Países Bajos", "Austria", "Irlanda", "B"),
    ("¿Cuál es la capital de México?", "Guadalajara", "Monterrey", "Ciudad de México", "Puebla", "C"),
    ("¿En qué país está la ciudad de Marrakech?", "Egipto", "Marruecos", "Túnez", "Argelia", "B"),
    ("¿Cuál es el país más grande del mundo por superficie?", "China", "Canadá", "Estados Unidos", "Rusia", "D"),
    ("¿Qué océano baña la costa occidental de Colombia?", "Atlántico", "Índico", "Pacífico", "Ártico", "C"),
    ("¿Cuál es la capital de España?", "Barcelona", "Sevilla", "Madrid", "Valencia", "C"),
    ("¿En qué país se encuentra Machu Picchu?", "Bolivia", "Perú", "Ecuador", "Chile", "B"),
    ("¿Cuál es la capital de Australia?", "Sídney", "Melbourne", "Canberra", "Perth", "C"),
    ("¿Qué línea imaginaria divide la Tierra en hemisferio norte y sur?", "Meridiano de Greenwich", "Trópico de Cáncer", "Ecuador", "Círculo polar ártico", "C"),
    ("¿Qué parte de la célula contiene la mayor parte del material genético?", "Núcleo", "Membrana", "Citoplasma", "Ribosoma", "A"),
    ("¿Cuál es el estado del agua a 0 °C, en condiciones normales?", "Siempre gaseoso", "Sólido y líquido en equilibrio", "Siempre plasma", "Solo líquido", "B"),
    ("¿Qué órgano usamos principalmente para respirar?", "Riñón", "Pulmón", "Estómago", "Páncreas", "B"),
    ("¿Cuál es la estrella más cercana a la Tierra?", "Sirio", "Próxima Centauri", "El Sol", "Vega", "C"),
    ("¿Qué fuerza nos mantiene sobre la superficie de la Tierra?", "Magnetismo", "Fricción", "Gravedad", "Electricidad", "C"),
    ("¿Cuál es el mamífero más grande del mundo?", "Elefante africano", "Ballena azul", "Jirafa", "Tiburón ballena", "B"),
    ("¿Qué vitamina produce el cuerpo con ayuda de la luz solar?", "Vitamina A", "Vitamina B12", "Vitamina C", "Vitamina D", "D"),
    ("¿Qué gas es el más abundante en la atmósfera terrestre?", "Oxígeno", "Nitrógeno", "Dióxido de carbono", "Hidrógeno", "B"),
    ("¿Cómo se llama el proceso por el que las plantas producen alimento usando luz?", "Fermentación", "Fotosíntesis", "Evaporación", "Digestión", "B"),
    ("¿Cuál es el hueso más largo del cuerpo humano?", "Húmero", "Tibia", "Fémur", "Radio", "C"),
    ("¿Qué instrumento se usa para observar objetos muy pequeños?", "Telescopio", "Microscopio", "Periscopio", "Binoculares", "B"),
    ("¿Qué planeta tiene los anillos más visibles?", "Mercurio", "Venus", "Saturno", "Marte", "C"),
    ("¿Cuál es la unidad básica de la corriente eléctrica?", "Voltio", "Amperio", "Vatio", "Ohmio", "B"),
    ("¿Qué animales son anfibios?", "Ranas", "Águilas", "Serpientes", "Mariposas", "A"),
    ("¿Qué órgano filtra la sangre y produce orina?", "Corazón", "Riñón", "Pulmón", "Bazo", "B"),
    ("¿Cuál es el metal que es líquido a temperatura ambiente?", "Hierro", "Mercurio", "Cobre", "Aluminio", "B"),
    ("¿Qué fenómeno causa principalmente las mareas de la Tierra?", "Viento solar", "Atracción gravitatoria de la Luna", "Rotación de Marte", "Lluvia", "B"),
    ("¿Cuál es el símbolo químico del oxígeno?", "Ox", "O", "Og", "X", "B"),
    ("¿Qué tipo de energía almacena una batería?", "Química", "Eólica", "Sonora", "Geotérmica", "A"),
    ("¿Cuál es el animal terrestre más rápido?", "León", "Guepardo", "Antílope", "Caballo", "B"),
    ("¿Qué estructura protege el cerebro?", "Costillas", "Cráneo", "Columna", "Pelvis", "B"),
    ("¿Cuánto es el 25 % de 200?", "25", "40", "50", "75", "C"),
    ("¿Cuánto es 9 al cuadrado?", "18", "72", "81", "99", "C"),
    ("¿Cuántos grados tiene un ángulo recto?", "45", "90", "180", "360", "B"),
    ("¿Cuál es el resultado de 144 dividido entre 12?", "10", "11", "12", "14", "C"),
    ("¿Cuál de estos números es par?", "17", "23", "36", "41", "C"),
    ("¿Cuántos centímetros hay en un metro?", "10", "100", "1.000", "10.000", "B"),
    ("¿Cuál es el perímetro de un cuadrado de lado 5 cm?", "10 cm", "15 cm", "20 cm", "25 cm", "C"),
    ("¿Qué fracción equivale a la mitad?", "1/3", "2/3", "2/4", "3/4", "C"),
    ("¿Cuánto es 7 × 8?", "48", "54", "56", "64", "C"),
    ("¿Cuántos lados tiene un hexágono?", "5", "6", "7", "8", "B"),
    ("¿Cuál es el valor de π aproximado a dos decimales?", "2,14", "3,14", "4,13", "3,41", "B"),
    ("Si un tren recorre 60 km en una hora, ¿cuánto recorre en 3 horas a la misma velocidad?", "120 km", "160 km", "180 km", "240 km", "C"),
    ("¿Qué número romano representa el 50?", "L", "C", "D", "X", "A"),
    ("¿Quién pintó la Mona Lisa?", "Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Claude Monet", "C"),
    ("¿Quién escribió Don Quijote de la Mancha?", "Federico García Lorca", "Miguel de Cervantes", "Lope de Vega", "Francisco de Quevedo", "B"),
    ("¿En qué país nació el pintor Pablo Picasso?", "Francia", "Italia", "España", "Portugal", "C"),
    ("¿Qué instrumento musical tiene teclas blancas y negras?", "Violín", "Flauta", "Piano", "Trompeta", "C"),
    ("¿Cuál es el idioma oficial de Brasil?", "Español", "Portugués", "Francés", "Italiano", "B"),
    ("¿Qué escritor creó al detective Sherlock Holmes?", "Agatha Christie", "Arthur Conan Doyle", "Edgar Allan Poe", "Charles Dickens", "B"),
    ("¿Cuál de estos es un género literario?", "Soneto", "Novela", "Acuarela", "Escultura", "B"),
    ("¿Qué baile se asocia tradicionalmente con Argentina?", "Samba", "Tango", "Salsa", "Flamenco", "B"),
    ("¿Qué color se obtiene al mezclar azul y amarillo con pintura?", "Morado", "Verde", "Naranja", "Rosado", "B"),
    ("¿En qué ciudad está el museo del Louvre?", "Roma", "París", "Londres", "Berlín", "B"),
    ("¿Quién compuso la Novena Sinfonía, conocida por la Oda a la Alegría?", "Mozart", "Beethoven", "Bach", "Chopin", "B"),
    ("¿Qué escritora creó la saga de Harry Potter?", "J. R. R. Tolkien", "J. K. Rowling", "Suzanne Collins", "C. S. Lewis", "B"),
    ("¿Cuál es el deporte que se juega en Wimbledon?", "Críquet", "Tenis", "Golf", "Rugby", "B"),
    ("¿Cuántos jugadores por equipo hay en cancha en un partido de fútbol?", "9", "10", "11", "12", "C"),
    ("¿Cada cuántos años se celebran normalmente los Juegos Olímpicos de verano?", "2", "3", "4", "5", "C"),
    ("¿En qué deporte se usa una raqueta y un volante?", "Bádminton", "Squash", "Tenis de mesa", "Pádel", "A"),
    ("¿Qué país ganó la Copa Mundial masculina de fútbol de 2022?", "Francia", "Brasil", "Argentina", "Croacia", "C"),
    ("¿Cuántos puntos vale un tiro libre encestado en baloncesto?", "1", "2", "3", "4", "A"),
    ("¿En qué deporte se compite en el Tour de Francia?", "Atletismo", "Ciclismo", "Automovilismo", "Natación", "B"),
    ("¿Qué pieza de ajedrez se mueve en forma de L?", "Torre", "Alfil", "Caballo", "Reina", "C"),
    ("¿En qué deporte se usa un bate y se recorren bases?", "Béisbol", "Balonmano", "Hockey", "Voleibol", "A"),
    ("¿Qué país organizó los Juegos Olímpicos de verano de 2016?", "China", "Reino Unido", "Brasil", "Japón", "C"),
    ("¿Quién fue el primer ser humano en caminar sobre la Luna?", "Yuri Gagarin", "Buzz Aldrin", "Neil Armstrong", "John Glenn", "C"),
    ("¿En qué año llegó Cristóbal Colón a América, según la fecha tradicional?", "1492", "1500", "1453", "1519", "A"),
    ("¿Qué civilización construyó las pirámides de Guiza?", "Romana", "Maya", "Egipcia antigua", "Inca", "C"),
    ("¿En qué ciudad cayó el Muro en 1989?", "Viena", "Berlín", "Praga", "Varsovia", "B"),
    ("¿Quién fue conocido como el Libertador de varios países sudamericanos?", "José de San Martín", "Simón Bolívar", "Antonio Nariño", "Francisco de Paula Santander", "B"),
    ("¿Qué documento de 1215 limitó el poder del rey de Inglaterra?", "Código Napoleónico", "Carta Magna", "Tratado de Versalles", "Declaración de Virginia", "B"),
    ("¿En qué país comenzó la Revolución Industrial?", "Francia", "Alemania", "Reino Unido", "España", "C"),
    ("¿Qué pueblo antiguo desarrolló la democracia en Atenas?", "Romanos", "Griegos", "Fenicios", "Persas", "B"),
    ("¿En qué año terminó la Segunda Guerra Mundial?", "1943", "1944", "1945", "1946", "C"),
    ("¿Qué reina egipcia estuvo relacionada con Julio César y Marco Antonio?", "Nefertiti", "Hatshepsut", "Cleopatra", "Merit Ptah", "C"),
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
            existing_texts = {
                text for (text,) in session.query(Question.text).all()
            }
            for difficulty, (text, a, b, c, d, answer) in enumerate(STARTER_QUESTIONS, 1):
                if text not in existing_texts:
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
