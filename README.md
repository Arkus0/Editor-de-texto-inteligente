# Editor Inteligente IA

Editor de documentos profesional con una experiencia familiar para usuarios de
Word, compatibilidad DOCX/PDF y un asistente de IA capaz de comprender y
modificar el documento. Permite redactar informes, cartas, currículos, actas,
proyectos, publicaciones y trabajos académicos a partir de instrucciones,
archivos PDF —también escaneados—, imágenes, DOCX o TXT.

El editor, las referencias, Zotero, las versiones, la revisión y la maquetación
profesional forman un único flujo de trabajo.

Versión actual del proyecto: **0.9.0**.

## Flujo principal

### Modo Rápido

Pensado para quien no quiere configurar parámetros:

1. Adjunta los materiales o describe el documento.
2. Pulsa **Crear documento con IA**.
3. Edita el resultado directamente en el documento o conversa con el asistente para
   cambiar fragmentos.

Este modo usa el modelo elegido: Gemini o el enrutador gratuito de OpenRouter.
Mantiene longitud automática y materiales más conocimiento del modelo.

### Modo Profesional

Conserva el mismo enunciado y los mismos archivos, pero permite controlar:

- Gemini 3.1 Pro/Flash/Flash-Lite, `openrouter/free` o un modelo `:free`
  específico.
- Nivel de razonamiento, temperatura y Top-P cuando el modelo los admite.
- Longitud, una o dos pasadas, política de fuentes y filtros del modelo.
- Instrucciones maestras, función de cada adjunto y análisis editable de los
  requisitos.
- Perfiles reutilizables para informes profesionales, documentos estructurados
  y trabajos basados únicamente en los materiales.

La aplicación analiza automáticamente las instrucciones con Flash-Lite, detecta
el tipo de documento, los apartados y los requisitos, y usa esa lectura
estructurada al redactar. La búsqueda web solo se activa cuando se solicita.

Los controles profesionales reducen falsos positivos y aprovechan la API del
proveedor elegido, sin eliminar sus políticas ni límites técnicos.

## Edición y asistencia después del borrador

- Chat contextual sobre el documento y los materiales adjuntos.
- Previsualización antes de aplicar una reescritura, con edición directa
  opcional.
- Acciones específicas para reforzar argumentos, aclarar ideas, verificar
  afirmaciones y comprobar el cumplimiento de requisitos.
- Exportación y edición DOCX/PDF, recuperación, versiones, control de cambios,
  notas, comentarios, referencias, CSL y Zotero.

## Novedades de la versión 0.8: cinta adaptable, ODT e IA accionable

- Personalización persistente de pestañas, orden y grupos de la cinta, sin
  perder la organización familiar de Word; KeyTips para sus pestañas
  principales.
- Pincel de formato de un uso o persistente e inspector «Revelar formato», con
  protección para no copiar comentarios, revisiones ni anclas.
- Apertura y guardado ODT con estilos, estructura e imágenes, y comparación
  estructural de documentos con combinación completa o selectiva.
- Vista previa granular del contexto que recibirá la IA: documento, estructura
  del editor, adjuntos e historial se controlan por cada envío.
- Las acciones nativas propuestas por Gemini u OpenRouter aparecen como una
  lista revisable y se aplican solo tras confirmación.
- OpenRouter evita modelos de clasificación o moderación y selecciona un modelo
  instructivo gratuito adecuado sin riesgo de elegir una variante de pago.
- El SDK de Gemini se carga bajo demanda y el paquete incorpora presupuestos
  automáticos de JavaScript, CSS y tamaño total.
- Fondo, borde, marca de agua y guiones automáticos con vista real y
  conservación en DOCX/PDF/ODT.
- Pestaña Correspondencia con CSV/TSV local, campos, vista previa y lotes por
  intervalos que se crean en una pestaña nueva sin alterar la plantilla.
- Autocorrección local y configurable para mayúsculas, comillas, rayas y
  sustituciones propias, con persistencia, exclusión de código y acciones de IA.
- Tesauros completos de LibreOffice para español e inglés, cargados bajo demanda
  en un hilo separado, con búsqueda desde la selección y sustitución en un clic.
- Recorte, compresión y correcciones reales de imagen con historial de Deshacer,
  más ajustes estrecho, detrás y delante conservados en DOCX/ODT y controlables
  por el asistente.
- Galería buscable de símbolos matemáticos, griegos, flechas, monedas y signos
  editoriales, con recientes locales y acción segura del asistente.
- Gestor de marcadores manuales para documentos largos: navegación, eliminación,
  referencias cruzadas, acciones de IA y conservación nativa en DOCX/ODT.
- Tablas con galería contextual de cinco estilos, ordenación por la columna
  activa y fórmulas `SUM`, `AVERAGE`, `COUNT`, `MIN` y `MAX` hacia arriba o la
  izquierda; el asistente puede configurarlas y se exportan como campos de
  Word y fórmulas OpenDocument.
- Cuadros de texto editables con presets, relleno, contorno, tamaño,
  alineación y ajuste flotante; disponen de pestaña contextual, acciones de IA
  y viaje de ida y vuelta como objetos nativos DOCX y ODT, además de PDF.

## Novedades de la versión 0.7: editor profesional y UX tipo Word

- Cinta de opciones reorganizada por tareas, barra de acceso rápido para
  deshacer/rehacer, galería de estilos con navegación propia y pestañas
  contextuales para imágenes y tablas. La cinta evita el desplazamiento
  horizontal en escritorio y el documento abre mostrando regla y margen
  superior. Las pestañas abiertas y el nombre editable comparten una única
  barra superior para recuperar espacio vertical.
- Notas al pie y notas finales numeradas, editables e importadas/exportadas como
  campos nativos de Word; también se conservan en PDF.
- Secciones académicas con preliminares romanos, cuerpo arábigo, reinicio o
  continuidad de numeración y creación automática de estructura de tesis.
- Numeración de líneas continua, por página o por sección, con inicio, intervalo
  y distancia configurables y compatibilidad DOCX nativa.
- Formato avanzado de párrafo con sangrías, espaciado, viudas y huérfanas,
  mantener con el siguiente, mantener líneas juntas, salto previo y exclusión
  de numeración de líneas; conservado al abrir y exportar DOCX/PDF.
- Rótulos y referencias cruzadas exportados como campos nativos `SEQ` y `REF`
  con marcadores estables; al reabrir el DOCX se reconstruyen como campos
  editables en el editor.
- Ecuaciones LaTeX exportadas como OMML editable de Word —incluidas fracciones,
  raíces, scripts, sumatorios, integrales y límites— y recuperadas como LaTeX
  al importar de nuevo el documento.
- Ajuste de texto alrededor de imágenes, distancia configurable, tamaño
  proporcional, texto alternativo y exportación DOCX flotante.
- Idioma de corrección por documento o selección, conservado por fragmento en
  DOCX.
- Catálogo CSL auditado, estilos académicos por disciplina e idioma
  independiente para citas y bibliografía.
- Autoguardado con detección de cambios externos, recuperación local y copia de
  seguridad antes de una sobrescritura intencional.
- Asistente de escritura explicable con perfiles académicos, reglas
  desactivables e incidencias ignorables.
- Protocolo de acciones del asistente para controlar formato, estructura,
  revisión, citas, notas y maquetación con confirmación previa.

## Novedades de la versión 0.5: Zotero y citas académicas

- Sincronización incremental con Zotero Desktop o Zotero.org mediante la
  versión de la biblioteca: solo se descargan los cambios posteriores a la
  última sincronización.
- Bibliotecas personales y de grupo, colecciones, búsqueda, filtro por
  etiqueta e importación múltiple.
- Metadatos ampliados: resumen, volumen, número, páginas, edición, idioma,
  colecciones, etiquetas y adjuntos.
- Apertura de PDF y otros adjuntos de Zotero desde la aplicación.
- Detector de duplicados por DOI, ISBN, URL canónica, título, autor, año y
  publicación.
- Elección campo a campo al fusionar registros que difieren.
- Fusión opcional también en Zotero.org, con confirmación previa, control de
  versión, traslado de adjuntos y relación `dc:replaces`. Requiere una API Key
  con permiso de escritura.
- Catálogo CSL oficial de Zotero con más de 10.000 estilos. Incluye accesos
  rápidos a APA 7, MLA 9, Chicago, Vancouver e IEEE.
- Citas múltiples, narrativas, parentéticas o en nota, con localizadores,
  prefijos y sufijos.
- Bibliografía ordenada y formateada por el mismo motor CSL que las citas.
- Identidad estable por obra: al actualizar o fusionar una fuente, sus citas
  vinculadas y la bibliografía se regeneran.

## Novedades de la versión 0.6: edición avanzada

- Índice dinámico enlazado a los títulos del documento y exportado como tabla
  de contenido actualizable en Word.
- Numeración multinivel de títulos hasta seis niveles.
- Rótulos automáticos de figuras y tablas y referencias cruzadas que se
  actualizan al renumerar.
- Ecuaciones LaTeX renderizadas con KaTeX en el editor y numeradas en Word/PDF.
- Tablas avanzadas: combinar o dividir celdas, filas, columnas, cabecera
  repetida y control de división entre páginas.
- Navegador de títulos, rótulos, ecuaciones, citas y saltos de página.
- Buscar y reemplazar con mayúsculas, palabra completa y expresiones regulares,
  conservando la estructura del documento.
- Comparación secuencial con DOCX, PDF, HTML, Markdown o texto: detecta
  inserciones, eliminaciones, repeticiones y cambios de orden sin perder el
  contexto, con adopción opcional de la versión comparada.
- Asistente de escritura local para palabras repetidas, espacios, puntuación y
  frases excesivamente largas.
- Diccionario personal persistente integrado con el corrector de Windows.
- Importación y exportación enriquecida de estilos Caption, Equation y TOC.
- Nuevas entradas en los menús de Windows para buscar, insertar índices y
  abrir las herramientas de documento.

## Funciones anteriores (0.2-0.4)

- Cinta de edición con estilos de párrafo, tipografías, tablas, imágenes,
  alineación, listas, interlineado y corrector ortográfico.
- Vista de impresión paginada, A4 o Carta, orientación, zoom, regla, márgenes y
  una, dos o tres columnas.
- Secciones continuas, de página siguiente, par o impar; encabezados, pies y
  numeración de páginas.
- Notas al pie y finales reales de Word, comentarios, respuestas y control de
  cambios.
- Apertura, guardado y copia de seguridad de DOCX, recuperación local,
  autoguardado e historial de versiones.
- Chat de IA con respuestas breves, medias, largas o muy largas,
  reescritura de selecciones, borradores alternativos e investigación con
  fuentes.
- Importación BibTeX/RIS con deduplicación.

## Configurar la IA

No hay que editar archivos ni usar la terminal:

1. Abre **Ajustes**. Si todavía no hay clave, la aplicación lo abre
   automáticamente.
2. Elige **Gemini** o **OpenRouter gratis**.
3. Crea una API Key en Google AI Studio u OpenRouter y pégala.
4. Pulsa **Guardar y comprobar**.

Con OpenRouter, la opción predeterminada es `openrouter/free`: consulta el
catálogo y elige un modelo instructivo gratuito, popular y compatible, evitando
clasificadores de seguridad y otros modelos que no sirven para conversar o
editar documentos. También se admite un modelo gratuito específico terminado
en `:free`. La aplicación sustituye cualquier identificador de pago por
`openrouter/free` para evitar cargos accidentales. Los modelos gratuitos tienen
límites diarios y su disponibilidad puede variar.

La aplicación prueba la conexión antes de activarla. Las claves se guardan en
el perfil local de la aplicación y nunca dentro de los documentos.

## Instalación en Windows

Ejecuta `Editor-Inteligente-IA-Setup.exe`. Es un instalador Squirrel por
usuario: muestra brevemente su ventana de instalación, crea accesos directos y
guarda la aplicación en:

`%LOCALAPPDATA%\EditorInteligenteIA\app-<versión>\EditorInteligenteIA.exe`

No es necesario conservar abierto el instalador para utilizar el programa.

## Conectar Zotero

Abre **Referencias → Fuentes y Zotero**:

1. Para trabajar en local, abre Zotero Desktop y pulsa **Detectar Zotero
   Desktop**. Si Zotero lo solicita, activa en **Ajustes → Avanzado** la opción
   que permite la comunicación con otras aplicaciones.
2. Para Zotero.org, pulsa **Crear API Key en Zotero**, pega la clave y pulsa
   **Guardar y conectar**.
3. Elige biblioteca y colección, busca, selecciona e importa.
4. Usa **Sincronizar cambios desde la última versión** para actualizar lo ya
   importado.

La lectura local no modifica Zotero Desktop. La fusión remota solo se ejecuta
tras una confirmación explícita y necesita permiso de escritura en la API Key.

## Límites conocidos de la 0.7

- Las citas exportadas son texto humano legible, no campos activos del
  complemento oficial de Zotero para Word.
- La comparación permite revisar el cambio unificado y adoptar la versión
  completa; todavía no combina selectivamente cada revisión.
- El asistente local aplica reglas prácticas de español; no sustituye un motor
  lingüístico completo.
- La interfaz web de desarrollo no dispone de cifrado, archivos locales ni
  conexión directa con Zotero. Esas funciones requieren la aplicación Windows.

## Ejecutar y comprobar

Requiere Node.js:

```powershell
npm install
npm run desktop:dev
```

Validación completa:

```powershell
npm run lint
npm test
npm run build
npm run desktop:make
```

El instalador se genera en:

`dist-electron/make/squirrel.windows/x64/Editor-Inteligente-IA-Setup.exe`

Las propuestas históricas de ampliación de Word, distribución y automatización
se conservan en [`V0.7_HANDOFF.md`](./V0.7_HANDOFF.md); no describen el estado
del flujo académico implementado aquí.
