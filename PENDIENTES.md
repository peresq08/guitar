# Pendientes

Cambios acordados que aún no se implementan.

## 1. Micrófono como opción por defecto

Que la calificación por micrófono venga activada de entrada en todo lo que la usa:

- **Cambios:** modo *Escuchar* como modo inicial, y *Calificar con el micrófono* activado en *Con clic*.
- **Secuencias:** *Calificar con el micrófono, acorde por acorde* activado.
- **Rasgueo:** *Calificar mi tiempo con el micrófono* activado.

Detalles a cuidar:
- Respetar la elección del usuario: si lo desactiva, que se quede desactivado.
- Si el navegador niega el permiso o no hay micrófono, seguir sin él y avisar una sola vez, sin bloquear la práctica.

## 2. Todo a la vista en laptop, sin desplazarse

Problema concreto: en **Secuencias** la mitad de la pantalla queda escondida y hay que desplazarse. La meta es practicar sin tocar la laptop: todo lo que se usa durante la ronda debe verse en una sola pantalla (referencia: 1366 × 768 en adelante).

- Durante la práctica, en una sola pantalla: recuadro con el acorde actual y el siguiente, diagramas, tempo, botón Empezar/Detener y el carril de aciertos (punto 3).
- Lo que se usa antes o después de practicar (editor de secuencias, lista de patrones, historial, ajustes del micrófono) va en la columna lateral o en paneles que se pueden plegar.
- Aplica igual a Cambios, Rasgueo, Metrónomo y Jam; revisar también Hoy y Progreso.
- Ideas de partida: reproductor fijo mientras se desplaza la columna derecha, listas de patrones y secuencias en rejilla compacta, tamaños de recuadro y diagramas pensados para pantalla grande.

## 3. Carril de aciertos estilo Guitar Hero

Ver en tiempo real si lo que tocas está bien, en todo lo que usa el micrófono.

**Carril de tiempo (horizontal):**
- A la derecha, lo que viene en los **próximos ~10 segundos**: bloques con el nombre de cada acorde, de ancho proporcional a su duración, que avanzan hacia una línea de "ahora".
- A la izquierda, lo que tocaste en los **últimos ~30 segundos**: cada bloque se pinta según lo detectado.
  - Verde: acorde correcto y a tiempo.
  - Rojo: tocaste otro acorde.
  - Gris: no se escuchó (te brincaste el cambio).

**Reacción al momento, en cada cambio:**
- Una animación corta sobre el recuadro: "¡Bien!", "Otro acorde" o "Te lo brincaste".
- Contador de racha (cambios seguidos bien), que se reinicia al fallar.

**Dónde aplica:**
- **Cambios** (modos *Con clic* y *Escuchar*) y **Secuencias**: los bloques son acordes.
- **Rasgueo**: los bloques son golpes (↓ ↑ ✕) y se marca cada uno como a tiempo, adelantado, atrasado o faltante.

Base técnica disponible: la detección de acordes por cuadro y la de golpes ya existen (`js/detect.js`, `startOnsets` en `js/audio.js`), y la calificación de Secuencias ya evalúa cada acorde en su ventana de tiempo.
