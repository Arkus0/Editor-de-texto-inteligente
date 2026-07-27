export type DocumentTemplateId =
  | "report"
  | "letter"
  | "resume"
  | "meeting"
  | "project"
  | "academic"
  | "questionnaire"
  | "worksheet"

export interface DocumentTemplate {
  id: DocumentTemplateId
  name: string
  description: string
  title: string
  html: string
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "report",
    name: "Informe",
    description: "Resumen, análisis y recomendaciones",
    title: "Nuevo informe",
    html: `
      <h1 data-word-style="Title" data-word-style-name="Título">Título del informe</h1>
      <p data-word-style="Subtitle" data-word-style-name="Subtítulo">Autor · Organización · Fecha</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Resumen ejecutivo</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Expón aquí las conclusiones principales y las decisiones que debe facilitar este informe.</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Contexto y objetivo</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Describe el alcance, los antecedentes y las preguntas que guían el análisis.</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Hallazgos</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Presenta la evidencia de forma ordenada y verificable.</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Recomendaciones</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Convierte los hallazgos en acciones concretas, responsables y plazos.</p>
    `,
  },
  {
    id: "letter",
    name: "Carta",
    description: "Formal, comercial o personal",
    title: "Nueva carta",
    html: `
      <p data-word-style="Normal" data-word-style-name="Normal">Nombre del remitente<br>Dirección · Ciudad<br>Correo · Teléfono</p>
      <p data-word-style="Normal" data-word-style-name="Normal">Fecha</p>
      <p data-word-style="Normal" data-word-style-name="Normal">Nombre del destinatario<br>Cargo · Organización<br>Dirección</p>
      <p data-word-style="Normal" data-word-style-name="Normal"><strong>Asunto: motivo principal de la carta</strong></p>
      <p data-word-style="Normal" data-word-style-name="Normal">Estimado/a:</p>
      <p data-word-style="Normal" data-word-style-name="Normal">Escribe aquí el mensaje. Mantén un propósito claro, párrafos breves y una petición o conclusión inequívoca.</p>
      <p data-word-style="Normal" data-word-style-name="Normal">Atentamente,</p>
      <p data-word-style="Normal" data-word-style-name="Normal"><strong>Nombre y firma</strong></p>
    `,
  },
  {
    id: "resume",
    name: "Currículum",
    description: "Claro y compatible con ATS",
    title: "Nuevo currículum",
    html: `
      <h1 data-word-style="Title" data-word-style-name="Título">Nombre y apellidos</h1>
      <p data-word-style="Subtitle" data-word-style-name="Subtítulo">Profesión o especialidad · Ciudad · correo@ejemplo.com · +34 000 000 000</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Perfil</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Resumen profesional breve, específico y orientado al puesto.</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Experiencia</h2>
      <h3 data-word-style="Heading2" data-word-style-name="Título 2">Puesto · Organización · Fechas</h3>
      <ul><li>Describe logros con verbos de acción, contexto y resultados medibles.</li><li>Evita tablas complejas para conservar la compatibilidad con sistemas ATS.</li></ul>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Formación</h2>
      <p data-word-style="Normal" data-word-style-name="Normal"><strong>Titulación</strong> · Centro · Año</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Competencias</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Competencia 1 · Competencia 2 · Competencia 3</p>
    `,
  },
  {
    id: "meeting",
    name: "Reunión",
    description: "Agenda, decisiones y tareas",
    title: "Notas de reunión",
    html: `
      <h1 data-word-style="Title" data-word-style-name="Título">Reunión: tema principal</h1>
      <p data-word-style="Subtitle" data-word-style-name="Subtítulo">Fecha · Hora · Lugar o enlace</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Participantes</h2>
      <ul><li>Nombre · función</li></ul>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Agenda</h2>
      <ol><li>Punto principal</li><li>Segundo punto</li></ol>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Decisiones</h2>
      <ul><li>Decisión · motivo · fecha efectiva</li></ul>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Acciones</h2>
      <table><thead><tr><th>Tarea</th><th>Responsable</th><th>Fecha</th><th>Estado</th></tr></thead><tbody><tr><td>Próxima acción</td><td>Nombre</td><td>Fecha</td><td>Pendiente</td></tr></tbody></table>
    `,
  },
  {
    id: "project",
    name: "Proyecto",
    description: "Alcance, plan, riesgos y seguimiento",
    title: "Plan de proyecto",
    html: `
      <h1 data-word-style="Title" data-word-style-name="Título">Nombre del proyecto</h1>
      <p data-word-style="Subtitle" data-word-style-name="Subtítulo">Responsable · Versión · Fecha</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Objetivo y resultados</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Define el problema, el resultado esperado y cómo se medirá el éxito.</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Alcance</h2>
      <h3 data-word-style="Heading2" data-word-style-name="Título 2">Incluido</h3>
      <ul><li>Entregable o capacidad</li></ul>
      <h3 data-word-style="Heading2" data-word-style-name="Título 2">Fuera de alcance</h3>
      <ul><li>Límite explícito</li></ul>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Plan de trabajo</h2>
      <table><thead><tr><th>Hito</th><th>Responsable</th><th>Fecha</th><th>Estado</th></tr></thead><tbody><tr><td>Primer hito</td><td>Nombre</td><td>Fecha</td><td>Planificado</td></tr></tbody></table>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Riesgos y decisiones</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Registra riesgos, impacto, mitigación y decisiones relevantes.</p>
    `,
  },
  {
    id: "academic",
    name: "Trabajo académico",
    description: "Estructura, citas y bibliografía",
    title: "Nuevo trabajo académico",
    html: `
      <h1 data-word-style="Title" data-word-style-name="Título">Título del trabajo</h1>
      <p data-word-style="Subtitle" data-word-style-name="Subtítulo">Autor · Asignatura · Centro · Fecha</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Introducción</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Presenta el problema, la tesis o el objetivo, el enfoque y la estructura del trabajo.</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Desarrollo</h2>
      <h3 data-word-style="Heading2" data-word-style-name="Título 2">Primer apartado</h3>
      <p data-word-style="Normal" data-word-style-name="Normal">Desarrolla la argumentación e inserta las citas desde Referencias para mantenerlas vinculadas.</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Conclusiones</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Integra los resultados y sus implicaciones sin limitarte a repetir la introducción.</p>
    `,
  },
  {
    id: "questionnaire",
    name: "Cuestionario",
    description: "Casillas y huecos rellenables",
    title: "Nuevo cuestionario",
    html: `
      <h1 data-word-style="Title" data-word-style-name="Título">Cuestionario</h1>
      <p data-word-style="Subtitle" data-word-style-name="Subtítulo">Fecha · Profesional · Centro</p>
      <p data-word-style="Normal" data-word-style-name="Normal">Nombre y apellidos: <span data-form-text-field="true" data-value="" data-placeholder="Nombre" data-width="32"></span></p>
      <p data-word-style="Normal" data-word-style-name="Normal">Fecha de nacimiento: <span data-form-text-field="true" data-value="" data-placeholder="dd/mm/aaaa" data-width="12"></span></p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Antecedentes</h2>
      <p data-word-style="Normal" data-word-style-name="Normal"><span data-form-checkbox="true" data-checked="false" data-label="Antecedente 1"></span> Primer antecedente</p>
      <p data-word-style="Normal" data-word-style-name="Normal"><span data-form-checkbox="true" data-checked="false" data-label="Antecedente 2"></span> Segundo antecedente</p>
      <p data-word-style="Normal" data-word-style-name="Normal"><span data-form-checkbox="true" data-checked="false" data-label="Antecedente 3"></span> Otro: <span data-form-text-field="true" data-value="" data-placeholder="Especificar" data-width="28"></span></p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">Valoración</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Adherencia al plan: <span data-form-dropdown="true" data-value="" data-options="Buena|Regular|Baja"></span></p>
      <p data-word-style="Normal" data-word-style-name="Normal">Observaciones: <span data-form-text-field="true" data-value="" data-placeholder="Texto libre" data-width="48"></span></p>
      <p data-word-style="Normal" data-word-style-name="Normal">Firma: <span data-form-text-field="true" data-value="" data-placeholder="" data-width="30"></span></p>
    `,
  },
  {
    id: "worksheet",
    name: "Ficha de ejercicios",
    description: "Enunciados, huecos y respuestas",
    title: "Nueva ficha de ejercicios",
    html: `
      <h1 data-word-style="Title" data-word-style-name="Título">Ficha de ejercicios</h1>
      <p data-word-style="Subtitle" data-word-style-name="Subtítulo">Unidad · Nivel · Fecha</p>
      <p data-word-style="Normal" data-word-style-name="Normal">Nombre: <span data-form-text-field="true" data-value="" data-placeholder="" data-width="30"></span> Grupo: <span data-form-text-field="true" data-value="" data-placeholder="" data-width="8"></span></p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">1. Completa los huecos</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">She <span data-form-text-field="true" data-value="" data-placeholder="" data-width="12"></span> to school every day.</p>
      <p data-word-style="Normal" data-word-style-name="Normal">They <span data-form-text-field="true" data-value="" data-placeholder="" data-width="12"></span> football last Sunday.</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">2. Marca la opción correcta</h2>
      <p data-word-style="Normal" data-word-style-name="Normal"><span data-form-checkbox="true" data-checked="false" data-label="Opción A"></span> Opción A &nbsp; <span data-form-checkbox="true" data-checked="false" data-label="Opción B"></span> Opción B &nbsp; <span data-form-checkbox="true" data-checked="false" data-label="Opción C"></span> Opción C</p>
      <h2 data-word-style="Heading1" data-word-style-name="Título 1">3. Responde brevemente</h2>
      <p data-word-style="Normal" data-word-style-name="Normal">Escribe tu respuesta en tres o cuatro líneas.</p>
    `,
  },
]

export function getDocumentTemplate(id: DocumentTemplateId) {
  return DOCUMENT_TEMPLATES.find((template) => template.id === id)
}
