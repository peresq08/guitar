# Riff · Entrenador de guitarra

App web para aprender guitarra por tu cuenta: abres, practicas de 15 a 45 minutos y ves con datos si estás mejorando. Funciona en el navegador del celular o la computadora, se instala en la pantalla de inicio y trabaja sin conexión.

## Qué incluye

| Sección | Para qué sirve |
|---|---|
| **Hoy** | Nivel actual, siguiente meta y rutina guiada que se arma sola según tu nivel y el tiempo que tengas. |
| **Practicar** | Reto de cambios entre dos acordes (contando tú, con clic o escuchando por micrófono) con entrenador de tempo automático, secuencias de acordes de canciones, entrenador de rasgueo, tabs y riffs nota por nota, metrónomo progresivo y Jam con batería y bajo. |
| **Afinador** | Afinador cromático por micrófono con detección automática de cuerda. |
| **Acordes** | 43 acordes con digitación y sonido, y escalas en el diapasón en cualquier tono. |
| **Progreso** | Minutos por día, rachas, camino de 5 niveles, repertorio de 64 canciones de rock, pop, metal, grunge, reggae y country (con secuencia de acordes y rasgueo sugerido), récords y respaldo de datos. |

La descripción completa del producto está en [PRODUCTO.md](PRODUCTO.md).

## Publicar con GitHub Pages

1. En el repositorio entra a **Settings → Pages**.
2. En **Build and deployment** elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y guarda.
3. En uno o dos minutos la app queda en `https://peresq08.github.io/guitar/`.

En el celular abre esa dirección y usa **Agregar a pantalla de inicio**.

## En laptop

En pantallas anchas el menú pasa a un costado y cada sección usa dos columnas. En Practicar, todo lo que se usa durante una ronda (acorde actual y siguiente, carril, tempo y botón) cabe en una pantalla, sin desplazarse. Atajos: **Espacio** inicia o pausa lo principal de la sección (rutina, reto, metrónomo, Jam, afinador), **1–5** cambian de sección y **F** activa la pantalla completa en Practicar.

## Diseño

Las pantallas donde practicas (rutina, Cambios, Secuencias, Rasgueo, afinador, metrónomo y Jam) se ven como la pantalla de un instrumento: oscuras, con brillo ámbar, igual en tema claro y oscuro. Lo demás (listas, editor, ajustes) queda sobrio para no distraer.

## Rondas más largas

Cambios y Secuencias ofrecen rondas de 1, 2, 3, 5 o 10 minutos; Rasgueo, de 8 o 16 compases, de 1 a 5 minutos o sin fin. En Cambios, el récord se guarda por minuto para que las rondas de distinta duración se puedan comparar.

## Calibración

- **Acordes** (Cambios y Secuencias → *Calibrar acordes*): rasgueas cada acorde 4 segundos y la app aprende cómo suena con tu guitarra. Avisa si el resultado se parece más a otro acorde, por si tocaste el equivocado.
- **Ritmo** (Rasgueo → *Calibrar ritmo*): tocas 8 golpes con el clic y la app mide el retraso de tu micrófono, que después usa para calificar el rasgueo con exactitud desde el primer golpe.

Todo se guarda en el dispositivo, aparece en Progreso → Ajustes (donde puedes borrarlo) y viaja en el respaldo.

## Carril y reacción en vivo

Con el micrófono activado (viene así por defecto), Cambios, Secuencias y Rasgueo muestran un carril estilo Guitar Hero:

- **A la derecha, lo que viene** (10 segundos de acordes o 2 de golpes) y **a la izquierda, lo que tocaste** (30 segundos o 4), pintado en verde (bien), rojo (otro acorde), naranja (casi, o golpe adelantado o atrasado) o gris (te lo brincaste).
- Abajo, una franja con lo que escuchó el micrófono.
- En cada cambio aparece un ícono de reacción y un contador de racha.

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

### Aprender, sin tempo

Para progresiones nuevas, el modo **Aprender** muestra un acorde a la vez con su diagrama y espera: cuando el micrófono lo escucha bien, pasa al siguiente. Ves una cola con los que vienen, cuánto tardaste en cada cambio y qué tanto se parece lo que tocas al acorde pedido ("Escucho Em, no C"). Cuando la mediana de tus últimos 8 cambios baja de 1 segundo (cambiar en un tiempo a 60 BPM), la app te lo dice y arranca sola la ronda **con tempo** a 60 BPM. Sin micrófono, avanzas con *Ya lo tengo* o la barra espaciadora.

### Con tempo

En **Practicar → Secuencias** armas la progresión de una canción (por ejemplo `G D Em C`) y la practicas en orden con clic. La pantalla muestra el acorde actual, el que sigue y sus diagramas.

- Escribe la secuencia de una vez: `G:2 C:2 D:4` cambia los tiempos y `A7 x4` repite.
- Puedes ligarla a una canción del repertorio; aparece un botón para practicarla desde Progreso y desde la canción del día.
- El tempo sube o baja solo con las mismas reglas del entrenador de cambios.
- **Rasgueo en la secuencia:** elige un patrón (por defecto, el sugerido de la canción) y sus golpes ↓ ↑ ✕ aparecen dentro de cada acorde en el carril y, en grande, en la tarjeta principal, con la casilla que suena iluminada y el siguiente golpe marcado. Con *Sonido guía*, la app toca la canción con ese rasgueo.
- Con la calificación por micrófono, la app revisa que cada acorde suene a tiempo y te muestra qué cambio de la secuencia te cuesta más, con un atajo para practicar ese par.

## Entrenador de rasgueo

En **Practicar → Rasgueo** hay 14 patrones: negras, pop básico, balada, country (bajo y rasgueo), boom-chicka, reggae, rock, ska, punk/metal, galope, shuffle y tres niveles de funk en semicorcheas. Cada casilla muestra ↓ abajo, ↑ arriba, ● bajo (la cuerda más grave del acorde), ✕ golpe apagado o · la mano pasa sin tocar. Las flechas grandes son acentos.

- **Sonido guía:** escucha el patrón tocado con el acorde o la secuencia que elijas.
- **Rondas de 8 o 16 compases**, o **sin fin** con subida de 2 BPM cada 4 compases.
- **Con el micrófono**, la app detecta cada golpe y te dice cuántos cayeron a tiempo, qué tan parejo vas (en milisegundos) y qué parte del patrón se adelanta o se atrasa (por ejemplo: "las 'a' llegan 27 ms tarde"). Solo sube el tempo cuando el ritmo es sólido.
- **Crea tus propios patrones** tocando las casillas.

## Tabs y riffs

En **Practicar → Tabs** importas una tab y la aprendes nota por nota:

- **Archivos de Guitar Pro** (.gp, .gp3, .gp4, .gp5, .gpx) **y MusicXML**: traen cada nota con su cuerda, traste, duración, tempo y secciones (Intro, Verso, Solo…). Si el archivo tiene varias pistas, eliges cuál (la app sugiere la guitarra principal). El lector es [alphaTab](https://alphatab.net) (MPL-2.0); se descarga la primera vez que importas y después funciona sin conexión.
- **Tabs de texto**: copia la tab de una página (los renglones `e|--0--3--|`) y pégala. Detecta afinación por las etiquetas, compases, secciones como `[Intro]`, ligados (h, p), slides, bends y notas muertas.
- **Aprender**: la tab se ve como pentagrama que se desliza solo, con la nota actual en ámbar y un diapasón con la posición de esta nota y la siguiente. Al escuchar la nota correcta por el micrófono avanza (si repites la misma nota, espera un ataque nuevo); con acordes compara todas las notas a la vez. Al terminar la sección te dice tu paso (segundos por nota) y qué notas te costaron.
- **Con tempo**: un compás de entrada y la tab avanza al tempo, con una línea de "ahora" que recorre la tablatura. Con el micrófono, cada nota se pinta en verde (a tiempo), naranja (tarde, temprano o sin ataque claro), rojo (equivocada) o gris (sin tocar). Empieza al 60% de la velocidad original y, con *Subir la velocidad sola*, sube 5% cada vuelta con 90% o más y baja si sale mal. Al terminar te dice qué compás te costó, con un botón para aprenderlo nota por nota.
- **Velocidad** de 30 a 120% (− / +), igual para Escuchar y Con tempo; se guarda por sección.
- **Acompañamiento** (botón *Pistas*): con archivos de Guitar Pro, las demás pistas (otras guitarras, bajo, batería y voz como melodía) suenan contigo al escuchar y al tocar con tempo. Eliges cuáles y el volumen. Con micrófono, mejor usar audífonos.
- **Formas de acorde**: cuando las notas de una parte caben en una forma de acorde (aunque se toquen una a la vez), la tab muestra el nombre arriba (por ejemplo **C**) y la tarjeta dice "Mano en forma de C", con la forma completa marcada en el diapasón. Reconoce los acordes abiertos de la biblioteca, cejillas tipo Mi y tipo La, y power chords.
- **Técnicas visibles**: arcos con *h* y *p* para hammer-on y pull-off, líneas *sl.* para slides, flechas de bend, ondas de vibrato, *P.M.* con línea punteada para palm mute, × para notas muertas, <12> para armónicos y (5) para notas de adorno.
- **Volver al inicio** de la sección y **ver la tab completa** (renglones como impresa, con la sección resaltada; toca una nota para ir a ella), con los botones sobre la tab.
- **Escuchar** toca la sección a la velocidad elegida, y tocar el número grande repite la nota actual.
- Si la tab está en otra afinación (por ejemplo, medio tono abajo) y tu guitarra está en estándar, elígelo en **Ajustes** (botón de controles) y la app ajusta lo que espera escuchar.
- Incluye cuatro ejercicios: pentatónica de La menor, arpegios, un riff en Mi y ligados.

Las tabs importadas se guardan **solo en tu dispositivo** (no están en este repositorio ni se suben a ningún lado) y viajan en el respaldo de Progreso.

## Pantalla completa y más espacio

En la computadora, dentro de Practicar:

- **Pantalla completa** (botón arriba a la derecha o tecla **F**): deja solo el panel de práctica y el carril o la tab crecen para usar todo el alto. Se sale con **Esc**, **F** o el botón *Salir*.
- **Panel**: oculta la columna de la derecha (lista de tabs, editor, estadísticas) para que la práctica use todo el ancho. Se recuerda.
- **Contraer** (abajo en el menú lateral): deja el menú solo con íconos.

## Carril más grande

El botón **A+** en el carril (Cambios, Secuencias, Rasgueo) y en la tab cambia entre tamaño normal, grande y enorme. También está en **Progreso → Ajustes**. En pantallas bajas, los tamaños grandes pueden requerir desplazar un poco el panel.

## Bocinas y eco

Si practicas con bocinas, el micrófono puede escuchar el clic y el sonido guía. Por eso la app activa la **cancelación de eco** del navegador (la misma de las videollamadas) y en **Micrófono y calibración** tiene una **prueba de bocinas**: toca un rasgueo corto y mide si llega al micrófono. Si llega, usa audífonos con el sonido guía o desactívalo cuando quieras que la app te califique.

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
js/tabs/*.js          Lectura de tabs de texto y de Guitar Pro / MusicXML
js/ui/tabstaff.js     Pentagrama de tablatura y diapasón
sw.js                 Funcionamiento sin conexión
```

No requiere instalación ni compilación: son archivos estáticos.
