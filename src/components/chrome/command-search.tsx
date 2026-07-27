"use client"

import * as React from "react"
import {
  BookOpen,
  BookOpenText,
  Bot,
  FileOutput,
  FilePlus2,
  FileSearch,
  Focus,
  FolderOpen,
  History,
  LayoutTemplate,
  ListTree,
  Mail,
  MessageSquareText,
  Pilcrow,
  Printer,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Table2,
  TextSearch,
  WandSparkles,
} from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type AppCommandId =
  | "file:new"
  | "file:open"
  | "file:save"
  | "file:saveAs"
  | "file:print"
  | "file:exportDocx"
  | "file:exportPdf"
  | "edit:find"
  | "edit:selectAll"
  | "edit:clearFormatting"
  | "insert:table"
  | "insert:textBox"
  | "insert:pageBreak"
  | "insert:sectionBreak"
  | "insert:footnote"
  | "insert:endnote"
  | "insert:toc"
  | "insert:equation"
  | "view:documentTools"
  | "view:mailMerge"
  | "view:layout"
  | "view:references"
  | "view:review"
  | "view:versions"
  | "view:assistant"
  | "view:accessibility"
  | "view:focus"
  | "view:immersiveReader"
  | "view:settings"
  | "review:trackChanges"
  | "ai:rewrite"
  | "ai:reviewDocument"
  | "ai:research"
  | "ai:formatDocument"

interface CommandDefinition {
  id: AppCommandId
  label: string
  description: string
  category: string
  keywords: string
  shortcut?: string
  icon: React.ReactNode
  requiresEditing?: boolean
  requiresDesktop?: boolean
  requiresContent?: boolean
}

const COMMANDS: CommandDefinition[] = [
  { id: "file:new", label: "Nuevo documento", description: "Crear una pestaña vacía", category: "Archivo", keywords: "crear nuevo plantilla", shortcut: "Ctrl+N", icon: <FilePlus2 /> },
  { id: "file:open", label: "Abrir documento", description: "Abrir un DOCX u ODT del equipo", category: "Archivo", keywords: "importar cargar docx odt libreoffice", shortcut: "Ctrl+O", icon: <FolderOpen />, requiresDesktop: true },
  { id: "file:save", label: "Guardar", description: "Guardar el documento actual", category: "Archivo", keywords: "salvar docx", shortcut: "Ctrl+S", icon: <Save />, requiresDesktop: true, requiresEditing: true },
  { id: "file:saveAs", label: "Guardar como…", description: "Guardar una copia con otro nombre", category: "Archivo", keywords: "copia ubicación", shortcut: "Ctrl+Shift+S", icon: <Save />, requiresDesktop: true, requiresEditing: true },
  { id: "file:print", label: "Imprimir", description: "Abrir la vista de impresión", category: "Archivo", keywords: "papel impresora", shortcut: "Ctrl+P", icon: <Printer />, requiresEditing: true },
  { id: "file:exportDocx", label: "Exportar a Word", description: "Crear un archivo DOCX compatible", category: "Archivo", keywords: "descargar word office libreoffice", icon: <FileOutput />, requiresContent: true },
  { id: "file:exportPdf", label: "Exportar a PDF", description: "Crear un PDF con el diseño actual", category: "Archivo", keywords: "descargar imprimir pdf", icon: <FileOutput />, requiresContent: true },
  { id: "edit:find", label: "Buscar y reemplazar", description: "Buscar texto, formato o estructura", category: "Edición", keywords: "reemplazar localizar navegación", shortcut: "Ctrl+H", icon: <TextSearch />, requiresEditing: true },
  { id: "edit:selectAll", label: "Seleccionar todo", description: "Seleccionar el documento completo", category: "Edición", keywords: "todo contenido", shortcut: "Ctrl+A", icon: <FileSearch />, requiresEditing: true },
  { id: "edit:clearFormatting", label: "Borrar formato", description: "Conservar el texto y limpiar su formato", category: "Edición", keywords: "limpiar estilo pegado", icon: <Pilcrow />, requiresEditing: true },
  { id: "insert:table", label: "Insertar tabla 3 × 3", description: "Añadir una tabla editable", category: "Insertar", keywords: "filas columnas cuadrícula", icon: <Table2 />, requiresEditing: true },
  { id: "insert:textBox", label: "Insertar cuadro de texto", description: "Añadir un bloque de texto independiente y adaptable", category: "Insertar", keywords: "forma caja destacado cita aviso flotante", icon: <LayoutTemplate />, requiresEditing: true },
  { id: "insert:pageBreak", label: "Salto de página", description: "Comenzar en una página nueva", category: "Insertar", keywords: "página nueva", shortcut: "Ctrl+Enter", icon: <Pilcrow />, requiresEditing: true },
  { id: "insert:sectionBreak", label: "Salto de sección", description: "Separar diseño, encabezados o numeración", category: "Insertar", keywords: "sección numeración orientación", icon: <LayoutTemplate />, requiresEditing: true },
  { id: "insert:footnote", label: "Nota al pie", description: "Insertar y editar una nota al pie", category: "Referencias", keywords: "nota referencia", icon: <BookOpen />, requiresEditing: true },
  { id: "insert:endnote", label: "Nota final", description: "Insertar y editar una nota final", category: "Referencias", keywords: "nota referencia", icon: <BookOpen />, requiresEditing: true },
  { id: "insert:toc", label: "Índice automático", description: "Crear una tabla de contenido dinámica", category: "Referencias", keywords: "tabla contenido toc títulos", icon: <ListTree />, requiresEditing: true },
  { id: "insert:equation", label: "Ecuación", description: "Insertar una fórmula matemática editable", category: "Insertar", keywords: "latex math fórmula", icon: <Pilcrow />, requiresEditing: true },
  { id: "view:documentTools", label: "Navegación y herramientas", description: "Esquema, búsqueda, escritura y campos", category: "Vista", keywords: "panel esquema corrector campos", icon: <ListTree />, requiresEditing: true },
  { id: "view:mailMerge", label: "Combinar correspondencia", description: "Crear cartas, certificados o etiquetas desde CSV", category: "Correspondencia", keywords: "csv campos cartas etiquetas certificados mail merge", icon: <Mail />, requiresEditing: true },
  { id: "view:layout", label: "Configurar página y secciones", description: "Márgenes, columnas, encabezados y numeración", category: "Disposición", keywords: "márgenes header footer página", icon: <LayoutTemplate />, requiresEditing: true },
  { id: "view:references", label: "Fuentes y citas", description: "Bibliografía, Zotero y estilos CSL", category: "Referencias", keywords: "bibliografía zotero cita", icon: <BookOpen />, requiresEditing: true },
  { id: "view:review", label: "Comentarios y cambios", description: "Revisar comentarios y control de cambios", category: "Revisar", keywords: "comentario revisión aceptar rechazar", icon: <MessageSquareText />, requiresEditing: true },
  { id: "view:versions", label: "Historial de versiones", description: "Comparar o restaurar una versión", category: "Vista", keywords: "historial recuperar copia", icon: <History />, requiresEditing: true },
  { id: "view:assistant", label: "Abrir asistente IA", description: "Mostrar u ocultar el asistente", category: "IA", keywords: "chat copilot ayuda gemini openrouter", icon: <Bot /> },
  { id: "view:accessibility", label: "Comprobar accesibilidad", description: "Revisar imágenes, títulos, enlaces, tablas y contraste", category: "Revisar", keywords: "wcag inclusivo lector pantalla alt texto", icon: <ShieldCheck />, requiresEditing: true },
  { id: "view:focus", label: "Modo Enfoque", description: "Ocultar distracciones y dejar solo el documento", category: "Vista", keywords: "inmersivo lectura concentración pantalla completa", shortcut: "Alt+W, O", icon: <Focus />, requiresEditing: true },
  { id: "view:immersiveReader", label: "Lector inmersivo", description: "Leer con foco de línea, temas y una voz local del sistema", category: "Vista", keywords: "leer voz lectura accesibilidad inmersivo offline", icon: <BookOpenText />, requiresEditing: true },
  { id: "view:settings", label: "Ajustes", description: "Proveedores, privacidad y preferencias", category: "Aplicación", keywords: "configuración api key privacidad gemini openrouter", icon: <Settings2 /> },
  { id: "review:trackChanges", label: "Activar o desactivar control de cambios", description: "Registrar ediciones de forma reversible", category: "Revisar", keywords: "track changes revisión cambios", icon: <MessageSquareText />, requiresEditing: true },
  { id: "ai:rewrite", label: "Reescribir la selección con IA", description: "Preparar una versión mejor del fragmento", category: "IA", keywords: "corregir mejorar selección", icon: <WandSparkles />, requiresEditing: true },
  { id: "ai:reviewDocument", label: "Revisión integral con IA", description: "Auditar claridad, estructura y coherencia", category: "IA", keywords: "revisar documento calidad", icon: <Sparkles />, requiresContent: true },
  { id: "ai:research", label: "Investigar y verificar", description: "Contrastar afirmaciones y proponer fuentes", category: "IA", keywords: "web fuentes verificar fact check", icon: <Search />, requiresContent: true },
  { id: "ai:formatDocument", label: "Optimizar formato con IA", description: "Proponer estilos y estructura usando funciones nativas", category: "IA", keywords: "diseño estilos formato profesional", icon: <WandSparkles />, requiresContent: true },
]

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim()
}

export function CommandSearch({
  editing,
  desktop,
  hasContent,
  onCommand,
}: {
  editing: boolean
  desktop: boolean
  hasContent: boolean
  onCommand: (command: AppCommandId) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.altKey && event.key.toLocaleLowerCase() === "q") ||
        ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k")
      ) {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  const normalizedQuery = normalizeSearch(query)
  const visibleCommands = COMMANDS.filter((command) => {
    if (!normalizedQuery) return true
    return normalizeSearch(
      `${command.label} ${command.description} ${command.category} ${command.keywords}`
    ).includes(normalizedQuery)
  }).slice(0, 14)

  const isDisabled = (command: CommandDefinition) =>
    Boolean(
      (command.requiresEditing && !editing) ||
        (command.requiresDesktop && !desktop) ||
        (command.requiresContent && !hasContent)
    )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border/80 bg-background/80 px-3 text-left text-sm text-muted-foreground shadow-sm transition hover:border-primary/40 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Buscar herramientas, acciones y ayuda"
          title="Buscar herramientas (Alt+Q o Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">¿Qué quieres hacer?</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] sm:inline">
            Alt+Q
          </kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={6}
        className="w-[min(560px,calc(100vw-24px))] overflow-hidden p-0 shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false)
            }}
            placeholder="Busca comandos, opciones o lo que quieres conseguir…"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Buscar comandos"
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {visibleCommands.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No hay coincidencias. Prueba a describir la acción con otras palabras.
            </div>
          ) : (
            visibleCommands.map((command) => {
              const disabled = isDisabled(command)
              return (
                <button
                  key={command.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onCommand(command.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition",
                    disabled
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary [&>svg]:h-4 [&>svg]:w-4">
                    {command.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {command.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {command.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {command.shortcut ?? command.category}
                  </span>
                </button>
              )
            })
          )}
        </div>
        <div className="border-t border-border bg-muted/35 px-3 py-2 text-[11px] text-muted-foreground">
          Las funciones no disponibles en el contexto actual aparecen atenuadas.
        </div>
      </PopoverContent>
    </Popover>
  )
}
