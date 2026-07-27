# Investigación de problemas de Word y respuesta del editor

Última revisión: 26 de julio de 2026.

Este documento convierte quejas públicas de usuarios en requisitos comprobables.
La prioridad no es copiar Word sin criterio, sino conservar su potencia y eliminar
los puntos de fricción que afectan a cualquier tipo de documento.

## Ampliación: quejas de todo tipo

La investigación ya no se limita al uso académico. Se incorporan problemas
repetidos por usuarios domésticos, profesionales, administrativos, técnicos y
creativos:

La arquitectura acordada es **offline-first**: todas las herramientas del
editor y los archivos funcionan sin red. Solo Gemini/OpenRouter acceden a
Internet cuando el usuario invoca la IA. Coautoría, presencia, firma electrónica
y sincronización cloud quedan fuera de alcance.

| Problema observado | Respuesta de producto |
| --- | --- |
| Funciones difíciles de encontrar y comandos repartidos por muchas pestañas | Buscador central de comandos `Alt+Q`/`Ctrl+K`, accesos rápidos y cinta por tareas |
| Interfaz abrumadora para tareas sencillas | Cinta contextual, controles progresivos, plantillas y modo Enfoque |
| Formato que cambia al pegar o mover contenido | Pegado como texto, limpieza de formato, estilos semánticos y temas aplicables al documento completo |
| Lentitud o bloqueos con documentos largos, imágenes y tablas | Serialización en tiempo ocioso, paneles bajo demanda, paginación agrupada y pruebas de documentos grandes |
| Pérdida de trabajo, conflictos de AutoSave y recuperación imprevisible | Historial local, versiones, puntos de recuperación y detección de cambios externos |
| IA intrusiva o incapaz de actuar sobre el documento real | IA opcional, cambios revisables y protocolo de acciones sobre estructura, formato, comentarios, secciones, encabezados y pies |
| Comentarios ignorados por el asistente | Hilos y respuestas incluidos en el contexto; Gemini puede responderlos y resolverlos |
| Empezar cada documento desde cero | Pantalla de inicio con miniaturas reales de cada plantilla, la página en blanco como primera opción y los documentos recientes al mismo nivel que el camino con IA |
| Buscar obliga a abrir un diálogo o un panel que roba ancho y no dice dónde están los resultados | Barra acoplada no modal con `Ctrl+F`: resalta todas las coincidencias sobre el texto, destaca la activa y las recorre con Intro |
| Rellenar un formulario en Word exige proteger el documento, y si olvidas quitar la protección el archivo se queda bloqueado | Campos siempre rellenables y un «modo rellenar» que es una vista, no un permiso guardado en el archivo |
| Al recibir un DOCX revisado por otra persona se pierden sus cambios controlados | Importación de `w:ins` y `w:del` con autor y fecha, incluido el texto borrado |
| Combinar correspondencia produce un único documento que hay que trocear para enviarlo | Salida alternativa en ZIP con un archivo por destinatario, nombrado por la columna elegida |
| Apariencia inconsistente entre documentos | Galería de temas completa: Word, moderno, editorial, corporativo y accesible |
| Problemas de accesibilidad difíciles de localizar o que se descubren al final | Comprobador local con navegación a imágenes, títulos, enlaces, tablas y problemas de contraste |
| Problemas de compatibilidad entre aplicaciones | Importación/exportación DOCX nativa y avisos claros cuando el portapapeles no puede conservar estructuras de Word |
| Usuarios que no quieren pagar por el asistente integrado | Proveedor OpenRouter con `openrouter/free`, streaming, cancelación, clave independiente y protección frente a modelos de pago accidentales |

### Revisión específica de Word 365 y uso académico

| Hallazgo reciente | Decisión aplicada |
| --- | --- |
| En Word para la web se reportan tablas de contenido, márgenes, páginas en blanco y numeración que cambian al abrir o descargar el DOCX | Secciones, numeración, TOC y exportación se modelan como estructura nativa; ODT y DOCX tienen pruebas de ida y vuelta |
| En tesis y documentos largos se rompen estilos, listas multinivel, referencias y TOC, y el usuario termina reparando formato manual | Esquema de títulos, referencias cruzadas, citas, notas y comparación estructural conviven en el modelo del editor |
| Funciones frecuentes quedan enterradas al cambiar la cinta de Word | Cinta familiar pero personalizable por pestaña y grupo, buscador de comandos y KeyTips para las pestañas principales |
| Copiar formato es útil, pero puede arrastrar elementos invisibles o ser difícil de cancelar | Pincel de un uso o persistente, cancelable con `Esc`, que excluye comentarios, revisiones y anclas |
| El usuario no sabe qué documento, adjuntos o historial recibe el asistente | Vista previa granular del contexto antes de cada solicitud |

Evidencia añadida:

- [Microsoft: personalizar la cinta de Word](https://support.microsoft.com/en-us/word/customize-the-ribbon-in-word)
  y [usar la cinta simplificada](https://support.microsoft.com/en-US/Word/using-the-simplified-ribbon-in-word).
- [Microsoft: usar el panel de navegación](https://support.microsoft.com/en-us/word/use-the-navigation-pane-in-word).
- [Microsoft 365 Community: problemas de formato académico en Word para la web](https://techcommunity.microsoft.com/discussions/word/formatting-issues-in-word-microsoft-365-copilot-online-/4511266).
- [Usuarios de doctorado describen fragilidad en estilos, numeración, TOC y referencias](https://www.reddit.com/r/PhD/comments/1pjdswo/who_else_is_writing_in_ms_word_and_hating_it/).
- [Usuarios critican que los estilos queden enterrados en la nueva cinta](https://www.reddit.com/r/word/comments/1t7shx9/recently_updated_to_2024_wtf/)
  y [estudiantes reportan cambios de formato al descargar DOCX](https://www.reddit.com/r/UoPeople/comments/1sjruir/how_are_you_handling_word_formatting_issues_with/).

### Evidencia general consultada

- [Reseñas de Microsoft Word en G2](https://www.g2.com/products/microsoft-word/reviews):
  usuarios señalan dificultad para encontrar funciones, sobrecarga y lentitud en
  documentos con muchas imágenes o tablas.
- [Quejas sobre formato y descubrimiento de funciones](https://www.reddit.com/r/MicrosoftWord/comments/1ncb5og/word_formatting_drives_me_crazy_how_do_you_all/)
  y [comandos dispersos en la cinta](https://www.reddit.com/r/MicrosoftWord/comments/1swprek/i_hate_microsoft_word/).
- [Inestabilidad con objetos pegados](https://www.reddit.com/r/MicrosoftWord/comments/1u8me5j/word_instability/)
  y [problemas de congelación y recuperación](https://www.reddit.com/r/MicrosoftWord/comments/1t5qcdd/word_freezing_and_not_recovering_auto_saved/).
- [Experiencia problemática de Copilot al modificar documentos](https://www.reddit.com/r/microsoft/comments/1l07r4q/copilot_in_word_is_such_a_mess/),
  [limitaciones al leer comentarios](https://www.reddit.com/r/microsoft_365_copilot/comments/1tks9op/copilot_limitations_are_frustrating_me/)
  y [rechazo a una IA impuesta](https://www.reddit.com/r/MicrosoftWord/comments/1rvixqc/how_can_i_convince_microsoft_i_dont_want_ai/).

## Prioridades y estado

| Prioridad | Problema observado | Respuesta del editor | Estado |
| --- | --- | --- | --- |
| P0 | Numeración romana en preliminares y arábiga en el cuerpo difícil de mantener | Formato e inicio por sección, vista previa real, importación/exportación DOCX y atajo de estructura de tesis | Implementado |
| P0 | Copiar contenido entre documentos pierde encabezados, pies o reinicia la numeración | Al pegar desde Word se explica la limitación del portapapeles; al abrir el DOCX se importan encabezados, pies, campos PAGE, alineación, formato, inicio y secciones | Implementado y probado |
| P0 | Numeración de títulos que se rompe o se convierte en texto manual | Esquema multinivel recalculado en el editor y numeración nativa al exportar DOCX | Implementado |
| P0 | Referencias cruzadas que desaparecen, quedan obsoletas o pierden su marcador | Identidades estables, renumeración en vivo y campos Word nativos `SEQ`/`REF`; importación de campos simples y complejos sin convertirlos en texto huérfano | Implementado y probado de ida y vuelta |
| P0 | Lentitud en documentos grandes y con revisión | La cinta no se rerenderiza por cada tecla; serialización, autoguardado, paginación, métricas, campos y accesibilidad esperan una pausa o tiempo ocioso | Implementado; probado con 7.500 bloques y con 69.890 caracteres/120 pulsaciones |
| P0 | Comentarios que desaparecen al aceptar eliminaciones controladas | Conservar texto y conversación, marcar el comentario sin anclaje y permitir reanclarlo | Protección implementada |
| P1 | Formato imprevisible al pegar contenido | Acción visible para pegar solo texto y limpieza integral de formato | Implementado |
| P1 | Sangrías y saltos de página frágiles en tesis, especialmente al aplicar estilos | Cuadro de párrafo tipo Word con sangría izquierda, derecha, primera línea o francesa, espaciado y reglas de paginación; vista real, selección múltiple, asistente e importación/exportación DOCX/PDF | Implementado y probado |
| P1 | Estilos bibliográficos ausentes o difíciles de instalar | Catálogo CSL de Zotero, caché local, estilos principales por disciplina, idioma configurable, fuentes vinculadas y flujo Zotero | Implementado; accesos auditados contra el catálogo actual |
| P1 | Imágenes y tablas que saltan, se deforman o son difíciles de colocar | Tamaño proporcional, alineación, texto alternativo, ajuste cuadrado con distancia configurable, seguridad en celdas y columnas redimensionables | Implementado, incluido DOCX flotante nativo |
| P1 | Herramientas potentes difíciles de descubrir y exceso de navegación entre diálogos | Cinta por tareas sin desplazamiento horizontal en escritorio, acceso rápido, galería compacta, controles con estado, página que abre mostrando regla y márgenes y pestañas contextuales para imagen y tabla | Implementado y verificado visualmente |
| P1 | Ecuaciones que desaparecen al copiar o dejan de ser editables al cambiar de aplicación | Edición LaTeX con vista KaTeX y conversión de ida y vuelta entre LaTeX, MathML y OMML editable; al pegar desde Word se recomienda abrir el DOCX para conservar la estructura | Implementado y probado |
| P1 | Numeración de líneas académica difícil de aplicar por sección y propensa a reinicios inesperados | Control visible en Disposición, opciones avanzadas por sección, vista previa real e importación/exportación DOCX nativa | Implementado y probado |
| P1 | Conflictos de AutoSave y pérdida de cambios | Historial local, puntos de recuperación, hash del archivo externo, bloqueo del autoguardado y copia recuperable antes de sobrescribir | Implementado y probado |
| P1 | Idioma de corrección que cambia solo | Selector explícito por documento o selección, aplicado al corrector y conservado como idioma de carácter en DOCX | Implementado y verificado visualmente |
| P2 | Sugerencias gramaticales incorrectas en prosa académica | Correcciones mecánicas separadas de sugerencias, perfiles 45/60/75, reglas desactivables, avisos ignorables, idioma por fragmento y diccionario personal | Implementado |
| P2 | Notas finales ausentes o convertidas en texto plano al cambiar de editor | Notas al pie y finales separadas, renumeración automática e importación/exportación DOCX nativa | Implementado y probado |

## Evidencia consultada

### Rendimiento y revisión

- Usuarios describen esperas de 10–20 segundos y bloqueos al trabajar con control
  de cambios: [Microsoft Q&A: Track Changes muy lento o con cierres](https://learn.microsoft.com/en-us/answers/questions/1686614/working-with-track-changes-in-word-is-very-slow-or).
- El panel de revisión y un volumen alto de cambios pueden alargar mucho la
  apertura: [Microsoft Q&A: documentos con muchos cambios controlados](https://learn.microsoft.com/en-us/answers/questions/5123447/word-taking-a-long-time-to-open-files-with-tracked).
- También se informa de lentitud en documentos académicos relativamente
  modestos con tablas e imágenes: [Reddit: Word lento con 15 000 palabras](https://www.reddit.com/r/MicrosoftWord/comments/1rfhmwy/lagsluggishslowness/).

### Tesis, secciones y numeración

- La numeración de tesis con preliminares romanos y cuerpo arábigo genera
  consultas recurrentes: [Microsoft Q&A: numeración consecutiva en tesis](https://learn.microsoft.com/en-us/answers/questions/5455635/header-page-numbering-consecutively).
- Los saltos de sección y la reanudación de numeración se rompen con facilidad:
  [Reddit: page numbering breaks](https://www.reddit.com/r/MicrosoftWord/comments/14gwj4y) y
  [Reddit: normalizar números entre secciones](https://www.reddit.com/r/MicrosoftWord/comments/149qfxw).
- Copiar una parte de un documento no conserva de forma fiable encabezados y
  pies, y la numeración automática adopta la configuración del documento de
  destino:
  [Microsoft Q&A: copiar páginas con encabezados, pies y numeración](https://learn.microsoft.com/en-us/answers/questions/4978964/copy-and-paste-multiple-pages-in-word-and-include) y
  [Microsoft Q&A: el encabezado no se copia aunque se incluya el salto](https://learn.microsoft.com/en-us/answers/questions/5022569/header-is-not-copied-over-even-with-section-break).
- Hay regresiones recientes en numeración de títulos:
  [Microsoft Q&A: heading numbering issue](https://learn.microsoft.com/en-us/answers/questions/5826705/heading-numbering-issue-remains-after-fix).
- Word permite numeración continua, reinicio por página o por sección, pero
  obliga a pasar por selección y opciones de sección; además, Microsoft advierte
  que en documentos largos los números pueden truncarse con márgenes estrechos:
  [Microsoft Support: agregar o quitar números de línea](https://support.microsoft.com/en-us/word/add-or-remove-line-numbers).
- El propio equipo de Microsoft destaca como opciones avanzadas el inicio, la
  distancia al texto, el intervalo y el modo de reinicio:
  [Microsoft 365 Insider: mejoras de numeración de líneas](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/enhancements-to-line-numbering-in-word-for-the-web/4336640).

### Formato, referencias e imágenes

- Estilos, márgenes, títulos y referencias son una fuente de frustración
  recurrente: [Reddit: Word formatting drives me crazy](https://www.reddit.com/r/MicrosoftWord/comments/1ncb5og/word_formatting_drives_me_crazy_how_do_you_all/).
- Pegar texto puede arrastrar formato inesperado:
  [Reddit: paste formatting](https://www.reddit.com/r/MicrosoftWord/comments/1iok7lj).
- Microsoft expone «mantener con el siguiente», «mantener líneas juntas»,
  control de viudas y huérfanas, salto previo y exclusión de numeración de
  líneas en un diálogo secundario:
  [Microsoft Support: saltos de línea y página](https://support.microsoft.com/en-us/word/line-and-page-breaks) y
  [Microsoft Support: mantener texto unido](https://support.microsoft.com/en-US/Word/keep-text-together-in-word).
- Usuarios académicos describen que aplicar sangría de primera línea mediante
  estilos puede alterar tablas o exigir reparaciones manuales:
  [Reddit: sangría de primera línea en una tesis doctoral](https://www.reddit.com/r/MicrosoftWord/comments/k32vtk) y
  [Reddit: problemas con formato de párrafo](https://www.reddit.com/r/MicrosoftWord/comments/1k27181).
- Se reportan estilos bibliográficos que desaparecen:
  [Microsoft Q&A: bibliography styles missing](https://learn.microsoft.com/en-us/answers/questions/5398071/all-but-two-bibliography-styles-are-missing-from-m).
- Hay documentos en los que las referencias cruzadas desaparecen al actualizar
  los campos y rótulos que dejan de estar disponibles entre equipos:
  [Microsoft Q&A: cross-references disappear](https://learn.microsoft.com/en-us/answers/questions/5440802/cross-references-disappear-in-documents) y
  [Microsoft Q&A: captions disappear from cross-reference](https://learn.microsoft.com/en-us/answers/questions/5246660/captions-have-disappeared-in-cross-reference-and-w).
- Word Online puede conservar el texto al copiar un bloque y perder todas sus
  ecuaciones:
  [Microsoft Q&A: copiar y pegar ecuaciones en el mismo archivo](https://learn.microsoft.com/en-us/answers/questions/5194609/how-to-copy-and-paste-equations-in-the-same-file-%28).
- Colocar imágenes y mantenerlas dentro de tablas sigue siendo frágil:
  [Reddit: images in tables](https://www.reddit.com/r/MicrosoftWord/comments/1tp2srd/help_with_images_in_tables/) y
  [Reddit: Word user-unfriendly con imágenes y pies](https://www.reddit.com/r/MicrosoftWord/comments/1oy81x6/why_is_ms_word_so_user_unfriendly/).

### Pérdida de trabajo y corrección

- Hay casos en los que se pierden comentarios:
  [Microsoft Q&A: all comments lost](https://learn.microsoft.com/en-us/answers/questions/5544911/all-comments-losts).
- Aceptar eliminaciones con cambios controlados puede borrar comentarios
  anclados a ese texto:
  [Microsoft Q&A: comments anchored to tracked deletions](https://learn.microsoft.com/en-us/answers/questions/5918339/active-comments-anchored-to-tracked-change-deletio).
- También se describen conflictos de AutoSave con cambios perdidos:
  [Microsoft Q&A: Couldn't save automatically](https://learn.microsoft.com/en-us/answers/questions/5922051/while-editing-a-word-file-i-get-couldnt-save-autom).
- El idioma de corrección puede cambiar de forma inesperada:
  [Reddit: Word suddenly using a different language](https://www.reddit.com/r/MicrosoftWord/comments/1rz2ghj/word_suddenly_using_a_different_language_for/).
- Las sugerencias gramaticales pueden ser erróneas en textos académicos:
  [Reddit: wrong grammar suggestions](https://www.reddit.com/r/MicrosoftWord/comments/1qbdcoj/why_am_i_getting_egregiously_flatout_wrong/).

## Criterio de aceptación

Una respuesta solo pasa a “Implementado” cuando cumple las tres condiciones:

1. existe un control comprensible en la interfaz;
2. el formato sobrevive a guardar, reabrir e importar/exportar cuando corresponda;
3. hay una prueba automática o una verificación visual reproducible.

Las funciones de Gemini y OpenRouter se consideran terminadas únicamente cuando
pueden comprender y usar de forma segura las capacidades reales del editor. La
matriz de alcance y paridad se mantiene en `docs/EDITOR_PARITY_MATRIX.md`.
