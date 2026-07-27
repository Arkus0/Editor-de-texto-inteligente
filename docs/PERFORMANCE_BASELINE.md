# Línea base y presupuestos de rendimiento

Última revisión: 26 de julio de 2026 (segunda ronda).

## Paquete de arranque

«Arranque» es todo el JavaScript que hay que descargar y compilar antes de que
el editor sea utilizable: lo que enlaza `index.html` más el grupo de fragmentos
de `AppShell`, que la página pide de inmediato. Los paneles y herramientas que
se importan bajo demanda no cuentan.

| Métrica | 0.8.3 | Ahora | Presupuesto |
| --- | ---: | ---: | ---: |
| JavaScript de arranque | 2.354,4 KiB | 1.989,2 KiB | 2.050 KiB |
| CSS de arranque | 127,2 KiB | 132,5 KiB | 145 KiB |
| Mayor fragmento de arranque | 599,6 KiB | 482,8 KiB | 500 KiB |
| JavaScript + CSS total | 6.262,0 KiB | 6.316,7 KiB | 6.500 KiB |

Los presupuestos se subieron una vez, a conciencia: los campos de formulario, la
barra de búsqueda y los gráficos añadieron unos 25 KiB de arranque. El dibujo de
los gráficos se carga bajo demanda, pero la definición de sus nodos no puede,
porque el esquema de ProseMirror se fija al crear el editor. Si el arranque
sigue creciendo, lo siguiente que hay que mirar son `marked` y `turndown`.

Los 391 KiB que salieron del arranque son dos bibliotecas que no hacen falta
para abrir, escribir ni guardar un documento:

- **KaTeX** (257 KiB) se importaba de forma estática en
  `document-features.ts`. Ahora lo pide `EquationNode` la primera vez que una
  ecuación aparece en pantalla. Mientras llega, la fórmula se muestra con su
  LaTeX en crudo; a partir de la segunda ecuación el módulo ya está en memoria
  y se compone sin parpadeo. La mayoría de documentos no tiene ni una fórmula y
  no lo descarga nunca.
- **react-markdown y remark-gfm** (~140 KiB) se importaban en el lienzo y en el
  panel de IA. Ahora los carga `MarkdownView` cuando hay una respuesta que
  leer, con el texto en claro como estado intermedio.

`marked` y `turndown` (~70 KiB) siguen en el arranque a propósito:
`markdownToHtml` y `htmlToMarkdown` se llaman de forma síncrona en 17 puntos de
`AppShell`, y volverlos asíncronos es mucho más riesgo del que justifica un 3 %
del paquete.

`scripts/check-bundle-budget.mjs` falla si alguna métrica supera su presupuesto
**y también si KaTeX o react-markdown vuelven al arranque**. La comprobación por
biblioteca es necesaria: el presupuesto global tiene holgura suficiente para
absorber una de ellas sin protestar, así que una importación estática nueva
pasaría desapercibida.

Para reproducir la medición:

```powershell
npm run build; if ($?) { npm run bundle:check }
```

## Latencia durante la escritura

Medido en el navegador sobre un documento sintético de 2.200 bloques (2.000
párrafos y 200 títulos, 343 KiB de HTML, 158 páginas), contando tareas largas
con `PerformanceObserver`.

| Trabajo tras una ráfaga de escritura | Antes | Ahora |
| --- | ---: | ---: |
| Serializar el documento a HTML y Markdown | 117 ms | 0 ms |
| Medir la paginación (bucle de alturas) | 12,5 ms | ~0 ms |
| `getComputedStyle` por pulsación | ~2.200 llamadas | 13 llamadas |
| Tareas largas tras una pulsación | 114–168 ms | ninguna |

Tres cambios:

1. **La serialización dejó de ser continua.** `onUpdate` llamaba a
   `editor.getHTML()` y `htmlToMarkdown()` 450 ms después de cada ráfaga, con un
   coste que crecía con el documento — exactamente la queja que se le hace a
   Word en documentos largos. Ahora `getSerializedDocument()` la calcula solo
   cuando alguien la lee de verdad (IA, exportar, cambiar de pestaña, guardar) y
   la cachea usando la identidad del `doc` de ProseMirror como clave, que es
   exacta porque los documentos son inmutables. Lo único que sigue siendo
   continuo es la longitud del texto, que la interfaz necesita durante el
   render: cuesta ~4 ms y va en tiempo ocioso.
2. **Las alturas de bloque se cachean por nodo.** Escribir una letra sustituye
   un párrafo y deja intactos los otros 2.199, así que un acierto de caché
   garantiza que ese bloque no ha cambiado de alto. La caché se vacía cuando
   cambia la geometría de la página, las columnas o los estilos —que rehacen el
   efecto entero— y cuando termina de cargar una fuente o una imagen.
3. **La cinta se memoiza.** Ver más abajo.

## Coste de interactuar con la interfaz

| Acción | Antes | Ahora |
| --- | ---: | ---: |
| Abrir o cerrar el panel de IA | 52–58 ms | sin tarea larga |

El coste era constante e independiente del tamaño del documento: se reproducía
igual con un documento vacío. Colapsando la cinta desaparecía por completo, lo
que lo situaba entero en el render de `EditorToolbar` — 4.126 líneas de JSX que
se rehacían ante cualquier cambio de estado de `AppShell`, que tiene 40
`useState` y ningún hijo memoizado.

La cinta va ahora en `React.memo`. Para que sirva de algo, las ~20 props de
callback que recibía en línea pasan por `useStableCallback`
(`src/lib/use-stable-callback.ts`), que mantiene la identidad de la función y
sustituye su cuerpo en cada render. Se eligió frente a repartir `useCallback`
porque en un componente de este tamaño una dependencia olvidada produce un
controlador que lee estado caducado, un fallo silencioso; aquí ese riesgo no
existe. La cinta no se queda congelada: ya se suscribía por su cuenta a la
selección y a las transacciones del editor.

Esa memoización destapó un fallo latente. La cinta decide si repintarse
comparando una firma de la selección, y la firma solo miraba las marcas del
punto inicial. Poner negrita a un párrafo entero y quitarla después deja ese
punto igual en los dos casos, así que la firma no cambiaba y el botón seguía
mostrándose pulsado sobre un texto que ya no estaba en negrita. Antes no se
notaba porque cualquier render de `AppShell` refrescaba la cinta de rebote. La
firma mira ahora el rango completo **solo cuando hay selección**; con el cursor
colapsado —el caso de escribir— sigue el camino barato de antes, y la escritura
en un documento de 1.263 bloques sigue sin producir ninguna tarea larga.

## Comprobaciones que siguen pendientes

- tiempo de primera ventana en arranque frío y caliente del EXE empaquetado;
- CPU y memoria con control de cambios, tablas e imágenes reales;
- apertura, desplazamiento, guardado y exportación de documentos reales grandes;
- repetir la medición de latencia sobre el Electron de producción: las cifras de
  arriba se tomaron en el navegador de desarrollo.
