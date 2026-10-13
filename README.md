# Riff · Entrenador de guitarra

App web para aprender guitarra por tu cuenta: abres, practicas de 15 a 45 minutos y ves con datos si estás mejorando. Funciona en el navegador del celular o la computadora, se instala en la pantalla de inicio y trabaja sin conexión.

## Qué incluye

| Sección | Para qué sirve |
|---|---|
| **Hoy** | Nivel actual, siguiente meta y rutina guiada que se arma sola según tu nivel y el tiempo que tengas. |
| **Practicar** | Reto de cambios entre dos acordes (contando tú, con clic o escuchando por micrófono) con entrenador de tempo automático, secuencias de acordes de canciones, metrónomo progresivo y Jam con batería y bajo. |
| **Afinador** | Afinador cromático por micrófono con detección automática de cuerda. |
| **Acordes** | 35 acordes con digitación y sonido, y escalas en el diapasón en cualquier tono. |
| **Progreso** | Minutos por día, rachas, camino de 5 niveles, repertorio de canciones, récords y respaldo de datos. |

La descripción completa del producto está en [PRODUCTO.md](PRODUCTO.md).

## Publicar con GitHub Pages

1. En el repositorio entra a **Settings → Pages**.
2. En **Build and deployment** elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y guarda.
3. En uno o dos minutos la app queda en `https://peresq08.github.io/guitar/`.

En el celular abre esa dirección y usa **Agregar a pantalla de inicio**.

## En laptop

En pantallas anchas el menú pasa a un costado y cada sección usa dos columnas. Atajos: **Espacio** inicia o pausa lo principal de la sección (rutina, reto, metrónomo, Jam, afinador) y **1–5** cambian de sección.

## Entrenador de cambios

En **Practicar → Cambios → Con clic**, con *Tempo automático* activado, la app arranca al 75% de tu récord con ese par de acordes. Después de cada ronda:

| Cambios limpios | Siguiente ronda |
|---|---|
| 95% o más | +10% de velocidad |
| 85–95% | +5% |
| 70–85% | Se mantiene |
| Menos de 70% | −10% |

Puedes calificar tú o dejar que el micrófono cuente los cambios limpios.

## Secuencias de acordes

En **Practicar → Secuencias** armas la progresión de una canción (por ejemplo `G D Em C`) y la practicas en orden con clic. La pantalla muestra el acorde actual, el que sigue y sus diagramas.

- Escribe la secuencia de una vez: `G:2 C:2 D:4` cambia los tiempos y `A7 x4` repite.
- Puedes ligarla a una canción del repertorio; aparece un botón para practicarla desde Progreso y desde la canción del día.
- El tempo sube o baja solo con las mismas reglas del entrenador de cambios.
- Con la calificación por micrófono, la app revisa que cada acorde suene a tiempo y te muestra qué cambio de la secuencia te cuesta más, con un atajo para practicar ese par.

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
