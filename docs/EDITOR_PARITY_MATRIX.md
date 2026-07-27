# Matriz de paridad y mejora del editor

Última revisión: 26 de julio de 2026.

Esta matriz es el registro de alcance del objetivo. Compara el editor con Word
Desktop, Word para la web y LibreOffice Writer, pero no convierte la copia
literal en el criterio de éxito: una función solo se cierra cuando resulta
familiar, funciona de forma fiable y elimina al menos tanta fricción como su
equivalente.

## Alcance arquitectónico

- La edición, maquetación, revisión, accesibilidad, importación/exportación,
  historial y recuperación deben funcionar **sin conexión**.
- La red se utiliza únicamente cuando el usuario invoca Gemini u OpenRouter.
- Coautoría, presencia, sincronización cloud, permisos corporativos, firma
  electrónica y ecosistemas propietarios como VBA/ActiveX quedan **fuera de
  alcance** y no reducen la paridad objetivo.
- Los formatos abiertos, la compatibilidad DOCX y la automatización local sí
  forman parte del alcance.

## Estados

| Estado | Significado |
| --- | --- |
| ✅ Implementado | Existe UI, comportamiento real y prueba automática o visual |
| 🟡 Parcial | Es utilizable, pero falta profundidad, compatibilidad o verificación |
| 🔴 Ausente | Sigue siendo una carencia relevante dentro del alcance |
| ⛔ Fuera de alcance | Contradice el modelo offline o depende de un ecosistema propietario |

## Interfaz familiar de Word 365

| Capacidad | Estado | Evidencia o brecha |
| --- | --- | --- |
| Barra de título con documento y estado | ✅ | Pestañas, nombre editable y cambios pendientes |
| Barra de acceso rápido | ✅ | Acciones locales configurables, reordenables, restaurables y persistentes por equipo |
| Buscar comandos / Tell Me | ✅ | `Alt+Q` y `Ctrl+K`, búsqueda contextual |
| Pestañas Inicio, Insertar, Diseño, Disposición, Referencias, Revisar y Vista | ✅ | Cinta agrupada por tareas |
| Pestañas contextuales de imagen y tabla | ✅ | Aparecen según el objeto activo |
| Contraer y fijar la cinta | ✅ | Segundo clic en pestaña o control de expansión |
| Pestaña Archivo / vista Backstage | ✅ | `Alt+F`, Inicio, Nuevo, Abrir, Información, Guardar, Imprimir, Exportar y Opciones |
| Personalización de pestañas y grupos | ✅ | Visibilidad, orden y grupos configurables, con restauración y persistencia local |
| KeyTips completos mediante `Alt` | 🟡 | Navegación por letras de todas las pestañas principales y foco en el primer control; faltan letras individuales para cada control y pestaña contextual |
| Menús contextuales y minibarra | 🟡 | Minibarra de selección; faltan menús por objeto más profundos |
| Galería visual de estilos | ✅ | Estilos con vista previa y navegación compacta |
| Barra de estado | ✅ | Página, palabras, caracteres, idioma, zoom y estado de IA |
| Regla y marcas de formato | ✅ | Regla continua e interactiva: sangrías arrastrables o por teclado, tabulaciones con clic, tecla Tab y persistencia DOCX |
| Panel de navegación | ✅ | Títulos, rótulos, ecuaciones, citas y saltos |
| Modo Enfoque | ✅ | Oculta interfaz; salida con `Esc` o `Alt+W, O` |
| Modo lectura / lector inmersivo | ✅ | Ancho, tamaño, espaciado, temas, foco de bloques y voz local |
| Diseño adaptable a ventanas estrechas | 🟡 | Cinta desplazable y etiquetas responsivas; falta auditoría completa |
| Tema oscuro de interfaz | ✅ | Sin alterar los colores de exportación del documento |

## Escritura y formato

| Capacidad | Estado | Evidencia o brecha |
| --- | --- | --- |
| Negrita, cursiva, subrayado, tachado, superíndice y código | ✅ | Acciones nativas y accesibles desde cinta/IA |
| Fuente, tamaño, color y resaltado | ✅ | Conservación en el modelo y exportación |
| Estilos semánticos editables | ✅ | Normal, títulos y estilos de documento |
| Temas completos de documento | ✅ | Word, moderno, editorial, corporativo y accesible |
| Formato de párrafo avanzado | ✅ | Sangrías, espaciado y paginación. Interlineado con las tres reglas de Word: múltiple, mínimo y exacto, con la unidad y los márgenes correctos en cada una —«exacto de 24 pt» es lo que piden las revistas y las plantillas de tesis, y sale al DOCX como `w:lineRule="exact"` en veinteavos de punto—. «No agregar espacio entre párrafos del mismo estilo» y nivel de esquema 0–9 para llevar un párrafo al índice sin darle formato de título |
| Viudas, huérfanas y mantener con siguiente | ✅ | Editor, IA y DOCX |
| Listas simples | ✅ | Viñetas y numeración |
| Esquema multinivel de títulos | ✅ | Renumeración y exportación nativa |
| Tabulaciones y topes sobre la regla | ✅ | Alta, retirada y navegación por topes personalizados; exportación DOCX nativa |
| Copiar, cortar y pegar | 🟡 | Pegado normal y solo texto; falta portapapeles múltiple |
| Pincel de formato | ✅ | Un uso o modo persistente con doble clic; `Esc` cancela y nunca copia comentarios, revisiones ni anclas |
| Mostrar y limpiar formato directo | ✅ | Limpieza integral e inspector «Revelar formato» para carácter y párrafo |
| Buscar y reemplazar | ✅ | Barra acoplada no modal con `Ctrl+F`/`Ctrl+H`/`F3`: resalta todas las coincidencias sobre el documento, destaca la activa, contador «3 de 47», Intro y Mayús+Intro para recorrerlas con vuelta al principio, y reemplazo uno a uno o completo. Encuentra palabras partidas por el formato y no cruza de un párrafo a otro |
| Buscar por formato o estructura | 🟡 | Estructura navegable. Filtros de formato de tres estados —sin filtrar, con el formato o sin él— para negrita, cursiva, subrayado, tachado, resaltado, código, superíndice y subíndice, exigidos en toda la coincidencia y no solo en la primera letra. Caracteres especiales del menú «Especial» (`^t`, `^l`, `^w`, `^#`, `^$`, `^s`, `^-`, `^~`, `^^`), insertables desde la barra y válidos también al reemplazar, más «coincidir prefijo» y «coincidir sufijo». Faltan la marca de párrafo `^p` —una coincidencia nunca cruza de un párrafo al siguiente, que es lo que permite encontrar una palabra partida por el formato— y los filtros por estilo, fuente, tamaño y color |
| Corrector ortográfico del sistema | ✅ | Idioma por documento y selección |
| Asistente local de escritura | ✅ | Reglas mecánicas y perfiles configurables |
| Sinónimos y diccionario | ✅ | Tesauros completos MyThes de LibreOffice para español e inglés, sustitución desde la selección y diccionario personal persistente del corrector de Windows |
| Traducción | 🟡 | Disponible mediante IA online; falta alternativa local |
| Autocorrección configurable | ✅ | Mayúsculas de oración, comillas tipográficas, rayas y sustituciones personalizadas; local, persistente, excluye código y es controlable por IA |

## Página, secciones y objetos

| Capacidad | Estado | Evidencia o brecha |
| --- | --- | --- |
| Tamaños A4 y Carta, orientación y márgenes | ✅ | Configuración por sección |
| Columnas | ✅ | 1–3 columnas con separación |
| Saltos de página y sección | ✅ | Página siguiente, continuo, par e impar |
| Encabezados y pies por sección | ✅ | Normal, primera y páginas pares |
| Numeración de página por sección | ✅ | Arábiga, romana, letras, reinicio y continuación |
| Numeración de líneas | ✅ | Continua, página o sección, con distancia e intervalo |
| Color y borde de página | ✅ | Vista real, persistencia y exportación DOCX/PDF/ODT |
| Marca de agua | ✅ | Texto, color, opacidad y ángulo; vista real y exportación DOCX/PDF/ODT |
| Guiones automáticos | ✅ | Activación local según idioma y conservación DOCX/ODT |
| Imágenes con tamaño proporcional | ✅ | Controles contextuales y exportación |
| Texto alternativo de imágenes | ✅ | Edición y comprobación automática |
| Ajuste de texto | ✅ | Arriba/abajo, cuadrado, estrecho, detrás y delante; vista real y exportación DOCX/ODT |
| Recorte, compresión y correcciones de imagen | ✅ | Recorte por bordes, límite de resolución, PNG/JPEG, brillo, contraste, saturación y escala de grises aplicados a píxeles; deshacer y exportación fiel |
| Tablas editables y redimensionables | ✅ | Filas, columnas, combinación, división y cabecera |
| Repetir cabecera y evitar división de filas | ✅ | UI, IA y DOCX |
| Estilos, fórmulas y ordenación de tablas | ✅ | Cinco estilos con galería contextual; orden ascendente/descendente por la columna activa preservando cabecera; `SUM`, `AVERAGE`, `COUNT`, `MIN` y `MAX` hacia arriba o izquierda, con campos DOCX, fórmulas ODT y acciones revisables de IA |
| Cuadros de texto | ✅ | Contenido editable con cuatro presets, tamaño, alineación, flotación, relleno y contorno desde pestaña contextual; creación/formato por IA, PDF y viaje de ida y vuelta mediante objetos nativos DOCX/ODT |
| Formas y dibujo | 🔴 | Pendiente |
| Gráficos | 🟡 | Barras, líneas y sectores a partir de una tabla del documento, sin asistente ni rejilla de datos: los valores ya están escritos. Se dibujan en SVG y se exportan como imagen a DOCX, PDF y ODT. Falta editar los datos desde el propio gráfico y volver a leerlos cuando cambie la tabla |
| SmartArt | ⛔ | Formato propietario; se priorizarán diagramas portables |
| Ecuaciones editables | ✅ | LaTeX, KaTeX, MathML y OMML |
| Símbolos y caracteres especiales | ✅ | Galería buscable por categorías, recientes locales e inserción segura mediante IA |

## Referencias, documentos largos y revisión

| Capacidad | Estado | Evidencia o brecha |
| --- | --- | --- |
| Tabla de contenido dinámica | ✅ | Actualización, navegación y DOCX |
| Notas al pie y notas finales | ✅ | Gestión, renumeración e intercambio DOCX |
| Citas y bibliografía | ✅ | CSL, deduplicación, estilos y Zotero |
| Citas vivas de Zotero en DOCX | ✅ | Las citas salen como campos `ADDIN ZOTERO_ITEM CSL_CITATION` con el URI de biblioteca, los datos CSL y el localizador, más `ZOTERO_BIBL` alrededor de la bibliografía y la preferencia de estilo. En Word con Zotero se actualizan, se editan y regeneran la bibliografía; sin Zotero se leen igual que antes. Al abrir un DOCX ajeno los campos vuelven a ser citas del editor y sus fuentes entran en la bibliografía con identidad estable, sin duplicar al reabrir |
| Rótulos y referencias cruzadas | ✅ | Identidades estables y campos Word nativos |
| Marcadores manuales | ✅ | Crear, listar, navegar, eliminar, referenciar y controlar con IA; exportación nativa DOCX/ODT y reapertura ODT |
| Índice alfabético | 🔴 | Pendiente |
| Tabla de autoridades | 🔴 | Pendiente |
| Comentarios con respuestas | ✅ | Hilos, resolver, reabrir, reanclar y contexto de IA |
| Control de cambios | ✅ | Inserciones, eliminaciones, visualización y revisión, con ida y vuelta completa por DOCX: al abrir el archivo de un coautor se recuperan sus cambios con autor y fecha, incluido el texto borrado que Word guarda en `w:delText` |
| Aceptar/rechazar cambios individualmente | ✅ | Panel de revisión |
| Comparar documentos | ✅ | Diferencia estructural y de formato, vista previa y combinación completa o selectiva |
| Historial de versiones | ✅ | Versiones locales, fijar, restaurar y comparar |
| Combinar correspondencia | ✅ | CSV/TSV local, campos, vista previa e intervalos, con dos salidas: un documento único para imprimir de una tirada, o un ZIP con un archivo por destinatario en DOCX o PDF, nombrado por la columna que elijas |
| Plantillas | ✅ | Carta, informe, currículo, reunión, proyecto, trabajo académico, cuestionario y ficha de ejercicios, con miniatura real de cada una en la pantalla de inicio |
| Formularios rellenables | ✅ | Casilla, hueco de texto y desplegable insertables desde Insertar, con plantillas de cuestionario y ficha. Rellenables siempre, sin proteger el documento como obliga Word, y con un «modo rellenar» que bloquea el texto y deja solo los campos. Al exportar a DOCX salen como controles de contenido `w:sdt` —`w14:checkbox`, `w:text` y `w:dropDownList`— que se rellenan en Word sin activar ninguna protección; en PDF y ODT se imprimen como texto fiel |

## Archivos, fiabilidad y privacidad

| Capacidad | Estado | Evidencia o brecha |
| --- | --- | --- |
| Abrir y guardar DOCX | ✅ | Aplicación de escritorio y estado interno asociado |
| Fidelidad DOCX avanzada | 🟡 | Amplia; faltan casos extremos, objetos y campos no soportados |
| Exportar PDF | ✅ | Diseño, referencias y campos |
| Exportar Markdown y texto | ✅ | Descarga local |
| Abrir y guardar ODT | ✅ | Importación/exportación OpenDocument con estilos, estructura, imágenes y pruebas de ida y vuelta |
| RTF y HTML editable | 🔴 | Pendiente |
| Importar PDF como documento editable | 🟡 | Extracción disponible para IA; falta flujo de edición fiable |
| Impresión | ✅ | Diálogo nativo del sistema |
| Autoguardado local | ✅ | Recuperación separada y guardado periódico |
| Conflicto con modificaciones externas | ✅ | Hash, pausa, copia de seguridad y elección del usuario |
| Recuperación tras cierre o fallo | ✅ | Base local y puntos de restauración |
| Funcionamiento sin conexión | ✅ | Editor y archivos no dependen de servicios web |
| Telemetría obligatoria | ✅ | No existe |
| Coautoría, presencia y permisos cloud | ⛔ | Excluidos por el modelo offline |
| Firma electrónica | ⛔ | Excluida |
| VBA, ActiveX y complementos propietarios | ⛔ | Excluidos por seguridad y portabilidad |

## Accesibilidad e inclusión

| Capacidad | Estado | Evidencia o brecha |
| --- | --- | --- |
| Comprobador local de accesibilidad | ✅ | Título, idioma, imágenes, títulos, enlaces, tablas, contraste y legibilidad |
| Navegar desde cada incidencia | ✅ | Salto al elemento desde el panel |
| Auditoría sin enviar el documento | ✅ | Análisis determinista dentro del proceso local |
| Contexto de accesibilidad para Gemini/OpenRouter | ✅ | Resumen e incidencias disponibles para acciones revisables |
| Navegación completa por teclado | 🟡 | Controles con foco y atajos; falta recorrido KeyTip total |
| Compatibilidad con lectores de pantalla | 🟡 | Semántica y etiquetas presentes; falta prueba NVDA/JAWS completa |
| Lectura en voz alta | ✅ | Solo usa voces que el sistema identifica como locales |
| Dictado | 🔴 | Pendiente; deberá usar capacidades locales del sistema |
| Lector inmersivo y foco de línea | ✅ | Lectura sin edición, temas y foco de 1, 3 o 5 bloques |

## Rendimiento

| Capacidad | Estado | Evidencia o brecha |
| --- | --- | --- |
| Paneles pesados cargados bajo demanda | ✅ | Imports dinámicos por herramienta; KaTeX y react-markdown también salieron del arranque (−391 KiB) |
| Serialización fuera de cada pulsación | ✅ | Ya no es continua: se calcula solo al leerla (IA, exportar, cambiar de pestaña, guardar) y se cachea por identidad del documento. Eran 117 ms por ráfaga con 2.200 bloques |
| Paginación agrupada | ✅ | Medición por lotes tras una pausa, con alturas cacheadas por nodo: 13 llamadas a `getComputedStyle` por pulsación en vez de 2.200 |
| Interfaz que no se rerenderiza entera | ✅ | La cinta va en `React.memo` con props estables: abrir un panel pasó de 52–58 ms a ninguna tarea larga |
| Métricas sin bloquear escritura | ✅ | Solo ante cambios de documento y durante tiempo ocioso |
| Contexto de IA acotado | ✅ | Inventarios y límites explícitos |
| Prueba sintética de documento grande | ✅ | 7.500 bloques |
| Perfil de bundle | ✅ | Presupuestos automáticos de arranque, CSS, fragmento máximo y total, más una comprobación por biblioteca que falla si KaTeX o react-markdown vuelven al arranque |
| Perfil de CPU y memoria en Electron empaquetado | 🔴 | Pendiente con documentos, tablas e imágenes reales |
| Tiempo de arranque medido | 🔴 | Pendiente en frío y caliente |
| Presupuesto de latencia de escritura | 🟡 | Con 2.200 bloques y 343 KiB de HTML no queda ninguna tarea larga tras una pulsación (antes 114–168 ms). Medido en el navegador de desarrollo; faltan p50/p95 en Electron de producción |

## Integración de IA

| Capacidad | Estado | Evidencia o brecha |
| --- | --- | --- |
| Gemini | ✅ | Streaming, cancelación y configuración |
| OpenRouter gratuito | ✅ | Selección fiable de modelo instructivo gratuito, exclusión de clasificadores y bloqueo de pago accidental |
| IA opcional | ✅ | La edición no requiere clave ni conexión |
| Selección y documento como contexto | ✅ | Rangos e inventario estructural |
| Acciones revisables | ✅ | Protocolo validado, acotado y confirmable |
| Formato, imágenes, tablas, secciones, notas, citas y comentarios | ✅ | Acciones nativas cubiertas, incluido procesamiento real de píxeles seleccionado |
| Abrir herramientas del editor | ✅ | Incluye accesibilidad, revisión, referencias y versiones |
| Conocer incidencias de accesibilidad | ✅ | Auditoría local resumida en el contexto |
| Acciones sobre todas las funciones futuras | 🟡 | La cobertura debe crecer junto a la matriz |
| Privacidad explícita antes de enviar contenido | ✅ | Vista previa y activación granular de documento, estructura, adjuntos e historial antes de cada envío |

## Próximo orden de ejecución

1. Figura enlazada a un archivo del disco, con «actualizar desde el archivo»:
   es lo que resuelve de verdad el flujo de quien genera sus gráficos en R o
   Python y hoy tiene que volver a pegarlos tras cada análisis.
2. Releer la tabla de origen desde un gráfico ya insertado, y elegir la columna
   cuando la tabla tiene varias series.
3. Leer `.xlsx` como archivo en combinar correspondencia, que hoy solo admite
   CSV. Integraciones en la nube tipo Canva o Tableau quedan descartadas: rompen
   el modelo offline, que es la principal ventaja del producto.
4. Formas y dibujo portables.
5. Índice alfabético y tabla de autoridades.
6. RTF/HTML editable e importación PDF.
7. Medir arranque, CPU, memoria y latencia en Electron empaquetado. El
   presupuesto de mayor fragmento de arranque está hoy en 501,5 KiB sobre un
   límite de 500: son las funciones nuevas cuyo nodo no puede cargarse bajo
   demanda porque el esquema de ProseMirror se fija al crear el editor. Hay que
   decidir a conciencia si se sube el límite o se saca algo del esquema.
8. Cerrar la cobertura de IA de cada nueva función: los campos de formulario y
   los gráficos todavía no son accionables por el asistente.

## Fuentes canónicas

- [Comparación de funciones de Word para escritorio y web](https://support.microsoft.com/en-us/word/word-features-comparison-word-for-the-web-vs-desktop)
- [Estructura y navegación de Word con lector de pantalla](https://support.microsoft.com/en-us/accessibility/word/use-a-screen-reader-to-explore-and-navigate-word)
- [Personalización de la cinta de Word](https://support.microsoft.com/en-us/word/customize-the-ribbon-in-word)
- [Herramientas de accesibilidad de Word](https://support.microsoft.com/en-us/accessibility/word/accessibility-tools-for-word)
- [Ayuda de LibreOffice Writer](https://help.libreoffice.org/latest/en-US/text/swriter/main0000.html)

Las quejas y decisiones de producto asociadas se mantienen en
`docs/WORD_USER_RESEARCH.md`.
