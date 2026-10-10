# Juego millonario

Juego de preguntas inspirado en «¿Quién quiere ser millonario?». Incluye la interfaz web, una API en Flask y una base de datos SQLite local.

## Compartir y ejecutar en otro equipo

Comparte este enlace para que la otra persona descargue el proyecto:

**https://github.com/esneidermoo19/Juego-millonario**

Debe tener [Python 3](https://www.python.org/downloads/) instalado. Luego puede descargar el proyecto desde GitHub con **Code → Download ZIP** y descomprimirlo. También puede clonarlo con Git:

```bash
git clone https://github.com/esneidermoo19/Juego-millonario.git
cd Juego-millonario
```

Para iniciar:

- **Windows:** doble clic en `iniciar_juego.bat`.
- **macOS o Linux:** abrir una terminal en la carpeta del proyecto y ejecutar `./iniciar_juego.sh`.

El primer inicio crea un entorno de Python e instala las dependencias. En este equipo, abre **http://127.0.0.1:5000** en el navegador. Para compartirlo con alguien conectado a la misma red Wi-Fi, ambos deben usar este equipo como servidor y la otra persona debe abrir `http://IP-DEL-EQUIPO:5000`. En Fedora puedes ver la IP con `hostname -I` (por ejemplo, `192.168.1.42`). Para cerrar el juego, pulsa `Ctrl+C` en la ventana que lo inició.

La otra persona no necesita descargar nada. El equipo que ejecuta el juego debe permanecer encendido y conectado a la red. Este enlace funciona dentro de la misma red Wi-Fi, no desde Internet.

## Iniciar manualmente

Desde la carpeta del proyecto:

```bash
python -m venv .venv
```

Activa el entorno (`.venv\\Scripts\\activate` en Windows o `source .venv/bin/activate` en macOS/Linux), instala las dependencias y arranca el servidor:

```bash
python -m pip install -r backend/requirements.txt
python -m backend.app
```

La base de datos SQLite se crea en `backend/instance/millionaire.db` y se completa con preguntas de ejemplo al iniciar.
