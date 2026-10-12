# Riff · Entrenador de guitarra

App web para aprender guitarra por tu cuenta: abres, practicas de 15 a 45 minutos y ves con datos si estás mejorando. Funciona en el navegador del celular o la computadora, se instala en la pantalla de inicio y trabaja sin conexión.

## Qué incluye

| Sección | Para qué sirve |
|---|---|
| **Hoy** | Nivel actual, siguiente meta y rutina guiada que se arma sola según tu nivel y el tiempo que tengas. |
| **Practicar** | Reto de cambios de acorde (contando tú, con clic o escuchando por micrófono), metrónomo progresivo y Jam con batería y bajo. |
| **Afinador** | Afinador cromático por micrófono con detección automática de cuerda. |
| **Acordes** | 35 acordes con digitación y sonido, y escalas en el diapasón en cualquier tono. |
| **Progreso** | Minutos por día, rachas, camino de 5 niveles, repertorio de canciones, récords y respaldo de datos. |

La descripción completa del producto está en [PRODUCTO.md](PRODUCTO.md).

## Publicar con GitHub Pages

1. En el repositorio entra a **Settings → Pages**.
2. En **Build and deployment** elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y guarda.
3. En uno o dos minutos la app queda en `https://peresq08.github.io/guitar/`.

En el celular abre esa dirección y usa **Agregar a pantalla de inicio**.

## Consejos para el micrófono

- Calibra cada acorde una vez desde el reto de cambios (modo *Escuchar*).
- Teléfono a menos de un metro, sin música ni ruido de fondo.
- Con guitarra eléctrica usa sonido limpio o poca distorsión.

## Tus datos

Se guardan en el navegador del dispositivo donde practicas. Para pasarlos a otro dispositivo usa **Progreso → Descargar respaldo** y luego **Cargar respaldo** en el otro.

## Estructura

```
index.html            Estructura y barra de navegación
css/app.css           Estilos (tema claro y oscuro)
js/main.js            Navegación entre secciones
js/store.js           Datos, rachas y respaldo
js/audio.js           Clic, guitarra sintetizada, batería, bajo y micrófono
js/chords.js          Acordes, diagramas y diapasón
js/plan.js            Niveles, metas, repertorio inicial y rutina
js/views/*.js         Una sección por archivo
sw.js                 Funcionamiento sin conexión
```

No requiere instalación ni compilación: son archivos estáticos.
