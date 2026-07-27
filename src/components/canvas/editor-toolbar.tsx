"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { Editor } from "@tiptap/react"
import type { Mark } from "@tiptap/pm/model"
import {
  AlertTriangle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalSpaceAround,
  ArrowRight,
  ArrowRightToLine,
  ArrowUpRight,
  Award,
  Briefcase,
  BarChart3,
  BookOpen,
  BookOpenText,
  Bold,
  Building2,
  Calendar,
  Camera,
  CaseSensitive,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  ClipboardPaste,
  Cloud,
  Code,
  Droplets,
  Eraser,
  FileText,
  Flag,
  Focus,
  Globe,
  Hash,
  Heart,
  Highlighter,
  Home,
  ImageIcon,
  Info,
  Italic,
  Key,
  Lightbulb,
  Link2,
  List,
  ListChecks,
  ListTree,
  ListOrdered,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  PenLine,
  Music,
  Paintbrush,
  Palette,
  Pencil,
  Phone,
  Pilcrow,
  Plus,
  Quote,
  RectangleHorizontal,
  Ruler,
  Save,
  ScanSearch,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Square,
  SquareCheck,
  Star,
  StickyNote,
  Sparkles,
  TextCursorInput,
  Strikethrough,
  Subscript as SubscriptIcon,
  Sun,
  Superscript as SuperscriptIcon,
  Table as TableIcon,
  Target,
  TextSelect,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Trophy,
  Umbrella,
  Underline as UnderlineIcon,
  Unlink,
  Users,
  WandSparkles,
  Wifi,
  Wrench,
  XCircle,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RibbonCombobox } from "@/components/canvas/ribbon-combobox"
import { cn } from "@/lib/utils"
import {
  formattingSnapshotDescription,
  sanitizeFormattingBlock,
  sanitizeFormattingMarks,
  type FormattingSnapshot,
} from "@/lib/formatting-tools"
import {
  LINE_SPACING_RULE_OPTIONS,
  normalizeParagraphFormat,
  type ParagraphFormat,
} from "@/lib/paragraph-format"
import { TEXT_BOX_PRESETS } from "@/lib/text-box"
import { SHAPE_TYPES, type ShapeType } from "@/editor/extensions/document-features"
import {
  DOCUMENT_FONTS,
  DOCUMENT_FONT_CATEGORY_LABELS,
  primaryFontName,
  stepFontSize,
} from "@/lib/document-fonts"
import { TEXT_CASE_OPTIONS, transformCase, type TextCaseMode } from "@/lib/text-case"
import {
  DOCUMENT_STYLE_THEMES,
  type DocumentStyleThemeId,
} from "@/lib/document-themes"
import {
  DEFAULT_RIBBON_TABS,
  RIBBON_GROUPS_BY_TAB,
  type RibbonPreferenceTabId,
  useUiPreferencesStore,
} from "@/store/useUiPreferencesStore"
import {
  BUILT_IN_DOCUMENT_STYLES,
  type DocumentLayoutSettings,
  type PageAppearanceSettings,
  type DocumentStyleDefinition,
} from "@/types/document"
import type { LayoutFocusSection } from "@/components/layout/layout-sidebar"
import type { DocumentToolsTab } from "@/components/tools/document-tools-sidebar"

const ImageEditPopover = dynamic(
  () =>
    import("@/components/tools/image-edit-popover").then(
      (module) => module.ImageEditPopover
    ),
  { ssr: false }
)

const SymbolPopover = dynamic(
  () =>
    import("@/components/tools/symbol-popover").then(
      (module) => module.SymbolPopover
    ),
  { ssr: false }
)

interface EditorToolbarProps {
  editor: Editor | null
  onOpenBackstage: () => void
  onAiOpen: () => void
  onAiAction: (actionId: string) => void
  onOpenReferences: () => void
  onOpenVersions: () => void
  onOpenLayout: (section?: LayoutFocusSection) => void
  onOpenReview: (selection: { from: number; to: number } | null) => void
  onOpenAccessibility: () => void
  onOpenImmersiveReader: () => void
  onInsertTableOfContents: () => void
  onOpenFootnotes: () => void
  onInsertPageBreak: () => void
  onOpenDocumentTools: (tab?: DocumentToolsTab) => void
  onOpenFind: () => void
  onInsertChartFromTable: (kind: "bar" | "line" | "pie") => void | Promise<void>
  formFillMode: boolean
  onToggleFormFillMode: () => void
  onOpenWritingTools: () => void
  onOpenMailMerge: () => void
  onToggleFocusMode: () => void
  focusMode: boolean
  trackChanges: boolean
  styles: DocumentStyleDefinition[]
  onAddStyle: (style: Omit<DocumentStyleDefinition, "id">) => string
  onUpdateStyle: (
    styleId: string,
    patch: Partial<Omit<DocumentStyleDefinition, "id">>
  ) => void
  onDeleteStyle: (styleId: string) => void
  layout: DocumentLayoutSettings
  pageAppearance: PageAppearanceSettings
  onLayoutChange: (layout: DocumentLayoutSettings) => void
  onPageAppearanceChange: (appearance: PageAppearanceSettings) => void
  onApplyStyleTheme: (themeId: DocumentStyleThemeId) => void
}

const TEXT_COLORS = ["#0f172a", "#dc2626", "#d97706", "#16a34a", "#2563eb", "#7c3aed", "#db2777"]
const HIGHLIGHT_COLORS = ["#fff3a3", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"]

const FONT_FAMILY_OPTIONS = DOCUMENT_FONTS.map((font) => ({
  id: font.id,
  label: font.label,
  value: font.cssStack,
  group: font.category,
  previewStyle: { fontFamily: font.cssStack },
}))

function isBuiltInStyleId(styleId: string) {
  return BUILT_IN_DOCUMENT_STYLES.some((style) => style.id === styleId)
}

const LINE_SPACING_PRESETS: Array<{ value: string; label: string }> = [
  { value: "1", label: "Sencillo" },
  { value: "1.15", label: "1,15" },
  { value: "1.5", label: "1,5 líneas" },
  { value: "2", label: "Doble" },
  { value: "2.5", label: "2,5 líneas" },
  { value: "3", label: "3 líneas" },
]
const TABLE_STYLE_OPTIONS = [
  { id: "plain", label: "Sin bordes" },
  { id: "grid", label: "Cuadrícula" },
  { id: "header", label: "Cabecera" },
  { id: "banded", label: "Bandas" },
  { id: "academic", label: "Académica" },
] as const
function insertTextBox(
  editor: Editor,
  preset: (typeof TEXT_BOX_PRESETS)[number]
) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "textBox",
      attrs: {
        width: 360,
        minHeight: 96,
        align: "center",
        boxPosition: "inline",
        padding: 16,
        background: preset.background,
        borderColor: preset.borderColor,
        borderStyle: preset.borderStyle,
      },
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Escribe aquí" }],
        },
      ],
    })
    .run()
}

function TextBoxButton({ editor }: { editor: Editor }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <StickyNote />
          Cuadro de texto
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="mb-2 text-xs font-semibold">Cuadros de texto</p>
        <div className="grid grid-cols-2 gap-2">
          {TEXT_BOX_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => insertTextBox(editor, preset)}
              className="rounded border border-border bg-background p-2 text-left hover:border-primary hover:bg-accent/40"
            >
              <span
                className="mb-1 block h-8 rounded px-2 py-1 text-[9px]"
                style={{
                  background: preset.background,
                  border:
                    preset.borderStyle === "double"
                      ? `3px double ${preset.borderColor}`
                      : `1px ${preset.borderStyle} ${preset.borderColor}`,
                }}
              >
                Texto
              </span>
              <span className="text-[10px]">{preset.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

const SHAPE_ICONS: Record<ShapeType, React.ComponentType<{ className?: string }>> = {
  rectangle: Square,
  roundedRectangle: Square,
  ellipse: Circle,
  line: Minus,
  arrow: ArrowRight,
}

function insertShape(editor: Editor, shapeType: ShapeType) {
  const defaults: Partial<Record<ShapeType, { width: number; height: number }>> = {
    line: { width: 200, height: 24 },
    arrow: { width: 200, height: 24 },
  }
  editor
    .chain()
    .focus()
    .insertContent({
      type: "documentShape",
      attrs: {
        shapeType,
        width: defaults[shapeType]?.width ?? 160,
        height: defaults[shapeType]?.height ?? 100,
      },
    })
    .run()
}

function ShapeButton({ editor }: { editor: Editor }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Square />
          Formas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="mb-2 text-xs font-semibold">Formas</p>
        <div className="grid grid-cols-4 gap-1.5">
          {SHAPE_TYPES.map((shape) => {
            const Icon = SHAPE_ICONS[shape.id]
            return (
              <button
                key={shape.id}
                type="button"
                onClick={() => insertShape(editor, shape.id)}
                className="flex h-12 flex-col items-center justify-center gap-1 rounded border border-border bg-background hover:border-primary hover:bg-accent/40"
                title={shape.label}
                aria-label={shape.label}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

const ICON_GALLERY: Array<{
  id: string
  label: string
  Icon: React.ComponentType<{ color?: string; className?: string }>
}> = [
  { id: "star", label: "Estrella", Icon: Star },
  { id: "heart", label: "Corazón", Icon: Heart },
  { id: "flag", label: "Bandera", Icon: Flag },
  { id: "check-circle", label: "Marcado", Icon: CheckCircle2 },
  { id: "x-circle", label: "Descartado", Icon: XCircle },
  { id: "alert-triangle", label: "Advertencia", Icon: AlertTriangle },
  { id: "info", label: "Información", Icon: Info },
  { id: "lightbulb", label: "Idea", Icon: Lightbulb },
  { id: "target", label: "Objetivo", Icon: Target },
  { id: "trending-up", label: "Tendencia", Icon: TrendingUp },
  { id: "bar-chart", label: "Gráfico de barras", Icon: BarChart3 },
  { id: "users", label: "Equipo", Icon: Users },
  { id: "mail", label: "Correo", Icon: Mail },
  { id: "phone", label: "Teléfono", Icon: Phone },
  { id: "calendar", label: "Calendario", Icon: Calendar },
  { id: "clock", label: "Reloj", Icon: Clock },
  { id: "map-pin", label: "Ubicación", Icon: MapPin },
  { id: "home", label: "Casa", Icon: Home },
  { id: "briefcase", label: "Maletín", Icon: Briefcase },
  { id: "building", label: "Edificio", Icon: Building2 },
  { id: "award", label: "Premio", Icon: Award },
  { id: "trophy", label: "Trofeo", Icon: Trophy },
  { id: "thumbs-up", label: "Me gusta", Icon: ThumbsUp },
  { id: "lock", label: "Bloqueado", Icon: Lock },
  { id: "key", label: "Clave", Icon: Key },
  { id: "zap", label: "Rayo", Icon: Zap },
  { id: "sun", label: "Sol", Icon: Sun },
  { id: "cloud", label: "Nube", Icon: Cloud },
  { id: "umbrella", label: "Paraguas", Icon: Umbrella },
  { id: "globe", label: "Global", Icon: Globe },
  { id: "wifi", label: "Wifi", Icon: Wifi },
  { id: "smartphone", label: "Móvil", Icon: Smartphone },
  { id: "camera", label: "Cámara", Icon: Camera },
  { id: "music", label: "Música", Icon: Music },
  { id: "message-circle", label: "Mensaje", Icon: MessageCircle },
]

function IconGalleryButton({ editor }: { editor: Editor }) {
  const [color, setColor] = React.useState("#1f2937")
  const [query, setQuery] = React.useState("")
  const gridRef = React.useRef<HTMLDivElement>(null)

  const filtered = ICON_GALLERY.filter((icon) =>
    icon.label.toLowerCase().includes(query.trim().toLowerCase())
  )

  const insertIcon = (iconId: string, label: string) => {
    const svg = gridRef.current?.querySelector<SVGSVGElement>(
      `[data-icon-id="${iconId}"] svg`
    )
    if (!svg) return
    const markup = svg.outerHTML
    const svgDataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`
    // DOCX/ODT/PDF no admiten SVG como imagen (solo PNG/JPEG/GIF/BMP), así
    // que se rasteriza aquí mismo antes de insertar: así el icono exporta
    // igual de bien en los tres formatos, como cualquier otra imagen.
    const displaySize = 48
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement("canvas")
      const scale = 2
      canvas.width = displaySize * scale
      canvas.height = displaySize * scale
      const ctx = canvas.getContext("2d")
      ctx?.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pngDataUri = canvas.toDataURL("image/png")
      editor
        .chain()
        .focus()
        .setImage({ src: pngDataUri, width: displaySize, height: displaySize, alt: label })
        .run()
    }
    image.src = svgDataUri
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Star />
          Iconos
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 p-2.5" align="start">
        <div className="flex items-center gap-1.5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar icono…"
            className="h-8 flex-1"
          />
          <label className="flex h-8 items-center gap-1 rounded border px-1.5">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
              aria-label="Color del icono"
            />
          </label>
        </div>
        <ScrollArea className="h-56 pr-2">
          <div ref={gridRef} className="grid grid-cols-6 gap-1.5">
            {filtered.map((icon) => (
              <button
                key={icon.id}
                type="button"
                data-icon-id={icon.id}
                onClick={() => insertIcon(icon.id, icon.label)}
                title={icon.label}
                aria-label={icon.label}
                // Fondo claro fijo (no bg-background): el icono se inserta
                // sobre la página del documento, que siempre es blanca
                // incluso en modo oscuro, así que la vista previa debe
                // mostrarse igual — y de paso el color elegido (a menudo
                // oscuro) sigue siendo visible al elegir en modo oscuro.
                className="flex h-9 w-9 items-center justify-center rounded border border-border bg-white hover:border-primary"
              >
                <icon.Icon color={color} className="h-4 w-4" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-6 py-4 text-center text-xs text-muted-foreground">
                Sin coincidencias
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

const WORD_ART_PRESETS: Array<{
  id: string
  label: string
  color: string
  highlight?: string
  bold?: boolean
  italic?: boolean
}> = [
  { id: "bold-blue", label: "Azul negrita", color: "#1d4ed8", bold: true },
  { id: "bold-red", label: "Rojo negrita", color: "#dc2626", bold: true },
  { id: "bold-green", label: "Verde negrita", color: "#15803d", bold: true },
  {
    id: "highlight-yellow",
    label: "Resaltado amarillo",
    color: "#1f2937",
    highlight: "#fde047",
    bold: true,
  },
  {
    id: "highlight-purple",
    label: "Resaltado violeta",
    color: "#ffffff",
    highlight: "#7c3aed",
    bold: true,
  },
  {
    id: "italic-gold",
    label: "Dorado cursiva",
    color: "#b45309",
    italic: true,
    bold: true,
  },
]

function WordArtButton({ editor }: { editor: Editor }) {
  const applyPreset = (preset: (typeof WORD_ART_PRESETS)[number]) => {
    let chain = editor.chain().focus().setColor(preset.color)
    chain = preset.bold ? chain.setBold() : chain.unsetBold()
    chain = preset.italic ? chain.setItalic() : chain.unsetItalic()
    chain = preset.highlight
      ? chain.setHighlight({ color: preset.highlight })
      : chain.unsetHighlight()
    chain.run()
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <WandSparkles />
          WordArt
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="mb-2 text-xs font-semibold">
          Estilos de texto decorativo
        </p>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Selecciona texto y aplica un estilo con un clic.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {WORD_ART_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              title={preset.label}
              className="flex h-10 items-center justify-center rounded border border-border bg-background px-1 hover:border-primary"
              style={{
                color: preset.color,
                backgroundColor: preset.highlight ?? undefined,
                fontWeight: preset.bold ? 700 : 400,
                fontStyle: preset.italic ? "italic" : "normal",
              }}
            >
              Aa
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function deleteActiveTextBox(editor: Editor) {
  const selection = editor.state.selection as typeof editor.state.selection & {
    node?: { type: { name: string }; nodeSize: number }
  }
  if (selection.node?.type.name === "textBox") {
    editor.view.dispatch(
      editor.state.tr.delete(selection.from, selection.from + selection.node.nodeSize)
    )
    editor.commands.focus()
    return
  }
  const { $from } = selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== "textBox") continue
    const from = $from.before(depth)
    editor.view.dispatch(editor.state.tr.delete(from, from + node.nodeSize))
    editor.commands.focus()
    return
  }
}

function captureFormattingSnapshot(editor: Editor): FormattingSnapshot | null {
  const { $from } = editor.state.selection
  let block: ReturnType<typeof sanitizeFormattingBlock> = null
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth)
    block = sanitizeFormattingBlock(node.type.name, node.attrs)
    if (block) break
  }
  if (!block) return null
  const marks = (editor.state.storedMarks ?? $from.marks()).map((mark) => ({
    type: mark.type.name,
    attrs: mark.attrs,
  }))
  return {
    ...block,
    marks: sanitizeFormattingMarks(marks),
  }
}

function applyFormattingSnapshot(
  editor: Editor,
  snapshot: FormattingSnapshot
) {
  if (editor.state.selection.empty) return false
  if (snapshot.blockType === "heading") {
    const level = Math.min(
      6,
      Math.max(1, Number(snapshot.blockAttrs.level ?? 1))
    ) as 1 | 2 | 3 | 4 | 5 | 6
    editor.chain().focus().setHeading({ level }).run()
  } else {
    editor.chain().focus().setParagraph().run()
  }
  editor
    .chain()
    .focus()
    .updateAttributes(snapshot.blockType, snapshot.blockAttrs)
    .run()

  let chain = editor.chain().focus().unsetAllMarks()
  for (const mark of snapshot.marks) {
    chain = chain.setMark(mark.type, mark.attrs)
  }
  return chain.run()
}

function FormattingInspectorPopover({ editor }: { editor: Editor }) {
  const snapshot = captureFormattingSnapshot(editor)
  const descriptions = snapshot
    ? formattingSnapshotDescription(snapshot)
    : ["No se ha podido leer el formato actual"]
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Toggle
          size="sm"
          aria-label="Revelar formato"
          title="Revelar formato de la selección"
          className="h-8 w-8 shrink-0"
        >
          <ScanSearch />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div>
          <p className="text-sm font-semibold">Revelar formato</p>
          <p className="text-xs text-muted-foreground">
            Inspección local del estilo en el punto inicial de la selección.
          </p>
        </div>
        <dl className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
          {descriptions.map((description) => {
            const [term, ...value] = description.split(":")
            return (
              <div key={description} className="grid grid-cols-[5.5rem_1fr] gap-2 text-xs">
                <dt className="font-medium text-muted-foreground">{term}</dt>
                <dd className="break-words">{value.join(":").trim() || "—"}</dd>
              </div>
            )
          })}
        </dl>
        <p className="text-[11px] text-muted-foreground">
          Los comentarios, revisiones y anclas estructurales no se consideran
          formato y nunca se copian con el pincel.
        </p>
      </PopoverContent>
    </Popover>
  )
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col justify-between gap-1 border-r border-border/70 px-2 last:border-r-0">
      <div className="flex min-h-10 items-center gap-0.5">{children}</div>
      <span className="select-none text-center text-[10px] leading-none text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <Toggle
      size="sm"
      pressed={active}
      disabled={disabled}
      onPressedChange={onClick}
      aria-label={label}
      title={label}
      className="h-8 w-8 shrink-0"
    >
      {children}
    </Toggle>
  )
}

function LinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")

  const applyLink = () => {
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
    }
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl(editor.getAttributes("link").href ?? "")
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Toggle size="sm" pressed={editor.isActive("link")} aria-label="Enlace" title="Enlace">
          <Link2 />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2" align="start">
        <p className="text-xs font-medium text-muted-foreground">Insertar enlace</p>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applyLink()
              }
            }}
          />
          <Button size="sm" className="h-8" onClick={applyLink}>
            Aplicar
          </Button>
        </div>
        {editor.isActive("link") && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              editor.chain().focus().unsetLink().run()
              setOpen(false)
            }}
          >
            <Unlink className="h-3 w-3" /> Quitar enlace
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Marcas que la cinta puede activar y cuyo estado muestra pulsado. */
const TOGGLEABLE_MARKS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "superscript",
  "subscript",
  "highlight",
  "link",
] as const

function editorToolbarSignature(editor: Editor) {
  const { selection, storedMarks } = editor.state
  const path = Array.from({ length: selection.$from.depth + 1 }, (_, depth) => {
    const node = selection.$from.node(depth)
    return {
      type: node.type.name,
      attrs: node.attrs,
      index: selection.$from.index(depth),
    }
  })
  /**
   * Con el cursor sin selección basta mirar las marcas de ese punto, que es lo
   * barato y el caso de escribir.
   *
   * Con una selección hay que mirar el rango entero, que es lo que consultan
   * los botones: poner negrita a todo un párrafo y quitarla después deja las
   * marcas del punto inicial igual en los dos casos, así que la firma no
   * cambiaba y la cinta se quedaba mostrando la negrita activa sobre un texto
   * que ya no lo estaba. Antes pasaba desapercibido porque cualquier render de
   * `AppShell` refrescaba la cinta de rebote; al memoizarla dejó de haber ese
   * refresco accidental.
   */
  const marks = selection.empty
    ? (storedMarks ?? selection.$from.marks()).map((mark) => ({
        type: mark.type.name,
        attrs: mark.attrs,
      }))
    : [
        ...TOGGLEABLE_MARKS.filter((name) => editor.isActive(name)),
        JSON.stringify(editor.getAttributes("textStyle")),
        JSON.stringify(editor.getAttributes("highlight")),
      ]
  const selectedNode = (
    selection as typeof selection & {
      node?: { type: { name: string }; attrs: Record<string, unknown> }
    }
  ).node

  return JSON.stringify({
    empty: selection.empty,
    range: selection.empty ? null : [selection.from, selection.to],
    selectionType: selection.constructor.name,
    path,
    marks,
    selectedNode: selectedNode
      ? { type: selectedNode.type.name, attrs: selectedNode.attrs }
      : null,
  })
}

function NumberControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  /** Paso del control. El interlineado múltiple se ajusta de 0,05 en 0,05. */
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Math.round(value * 100) / 100}
        onChange={(event) =>
          onChange(
            Math.min(
              max,
              Math.max(min, Number(event.target.value) || 0)
            )
          )
        }
        className="h-8"
      />
    </label>
  )
}

function BooleanControl({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-accent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5"
      />
      <span>
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[11px] leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  )
}

function ParagraphOptionsPopover({ editor }: { editor: Editor }) {
  const nodeType = editor.isActive("heading") ? "heading" : "paragraph"
  const format = normalizeParagraphFormat(
    editor.getAttributes(nodeType).paragraphFormat
  )

  const updateFormat = (partial: Partial<ParagraphFormat>) => {
    editor.commands.setParagraphFormat(partial)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          onMouseDown={(event) => event.preventDefault()}
          title="Opciones avanzadas de párrafo"
        >
          <Pilcrow />
          Párrafo…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[390px] space-y-4" align="start">
        <div>
          <p className="text-sm font-medium">Párrafo y paginación</p>
          <p className="text-xs text-muted-foreground">
            Se aplica al párrafo actual o a todos los párrafos seleccionados.
          </p>
        </div>

        <section className="space-y-2">
          <p className="text-xs font-semibold">Sangría (pt)</p>
          <div className="grid grid-cols-3 gap-2">
            <NumberControl
              label="Izquierda"
              value={format.leftIndent}
              min={0}
              max={720}
              onChange={(leftIndent) => updateFormat({ leftIndent })}
            />
            <NumberControl
              label="Derecha"
              value={format.rightIndent}
              min={0}
              max={720}
              onChange={(rightIndent) => updateFormat({ rightIndent })}
            />
            <NumberControl
              label="Primera línea"
              value={format.firstLineIndent}
              min={-360}
              max={360}
              onChange={(firstLineIndent) =>
                updateFormat({ firstLineIndent })
              }
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => updateFormat({ firstLineIndent: 36 })}
            >
              Primera línea 0,5″
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() =>
                updateFormat({ leftIndent: 36, firstLineIndent: -36 })
              }
            >
              Francesa 0,5″
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold">Espaciado (pt)</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberControl
              label="Antes"
              value={format.spacingBefore}
              min={0}
              max={240}
              onChange={(spacingBefore) => updateFormat({ spacingBefore })}
            />
            <NumberControl
              label="Después"
              value={format.spacingAfter}
              min={0}
              max={240}
              onChange={(spacingAfter) => updateFormat({ spacingAfter })}
            />
          </div>
          <BooleanControl
            label="No agregar espacio entre párrafos del mismo estilo"
            description="Junta apartados y listas seguidas sin tocar el espaciado."
            checked={format.contextualSpacing}
            onChange={(contextualSpacing) =>
              updateFormat({ contextualSpacing })
            }
          />
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold">Interlineado</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Regla</span>
              <select
                value={format.lineSpacingRule}
                aria-label="Regla de interlineado"
                className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
                onChange={(event) => {
                  const lineSpacingRule = event.target
                    .value as ParagraphFormat["lineSpacingRule"]
                  // Al cambiar de unidad hay que reponer el valor: 1,5 líneas y
                  // 1,5 puntos no son lo mismo ni de lejos.
                  updateFormat({
                    lineSpacingRule,
                    lineSpacing: lineSpacingRule === "multiple" ? 1.5 : 24,
                  })
                }}
              >
                {LINE_SPACING_RULE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <NumberControl
              label={
                format.lineSpacingRule === "multiple" ? "Líneas" : "Puntos"
              }
              value={format.lineSpacing}
              min={format.lineSpacingRule === "multiple" ? 0.25 : 1}
              max={format.lineSpacingRule === "multiple" ? 10 : 480}
              step={format.lineSpacingRule === "multiple" ? 0.05 : 1}
              onChange={(lineSpacing) => updateFormat({ lineSpacing })}
            />
          </div>
        </section>

        <section className="space-y-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold">Nivel de esquema</span>
            <select
              value={format.outlineLevel}
              aria-label="Nivel de esquema"
              className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
              onChange={(event) =>
                updateFormat({ outlineLevel: Number(event.target.value) })
              }
            >
              <option value={0}>Texto independiente</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                <option key={level} value={level}>
                  Nivel {level}
                </option>
              ))}
            </select>
            <span className="block text-xs text-muted-foreground">
              Incluye el párrafo en el índice y en el panel de navegación sin
              darle formato de título.
            </span>
          </label>
        </section>

        <section className="space-y-1 border-t pt-3">
          <BooleanControl
            label="Mantener con el siguiente"
            description="Evita separar un título del primer párrafo."
            checked={format.keepWithNext}
            onChange={(keepWithNext) => updateFormat({ keepWithNext })}
          />
          <BooleanControl
            label="Mantener líneas juntas"
            description="Evita partir este párrafo entre dos páginas."
            checked={format.keepLinesTogether}
            onChange={(keepLinesTogether) =>
              updateFormat({ keepLinesTogether })
            }
          />
          <BooleanControl
            label="Control de viudas y huérfanas"
            description="Conserva al menos dos líneas al principio y al final."
            checked={format.widowOrphanControl}
            onChange={(widowOrphanControl) =>
              updateFormat({ widowOrphanControl })
            }
          />
          <BooleanControl
            label="Salto de página anterior"
            description="Hace que el párrafo comience siempre en página nueva."
            checked={format.pageBreakBefore}
            onChange={(pageBreakBefore) =>
              updateFormat({ pageBreakBefore })
            }
          />
          <BooleanControl
            label="Excluir de la numeración de líneas"
            description="No asigna número a las líneas de este párrafo."
            checked={format.suppressLineNumbers}
            onChange={(suppressLineNumbers) =>
              updateFormat({ suppressLineNumbers })
            }
          />
        </section>

        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => editor.commands.resetParagraphFormat()}
        >
          Restablecer formato directo de párrafo
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function ColorPopover({
  icon,
  label,
  colors,
  isActive,
  apply,
  clear,
}: {
  icon: React.ReactNode
  label: string
  colors: string[]
  isActive: boolean
  apply: (color: string) => void
  clear: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Toggle size="sm" pressed={isActive} aria-label={label} title={label}>
          {icon}
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex items-center gap-1.5">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              className="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
              onClick={() => apply(color)}
              aria-label={color}
            />
          ))}
          <button
            type="button"
            onClick={clear}
            className="ml-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Quitar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FontSizeControl({ editor }: { editor: Editor }) {
  const rawSize = editor.getAttributes("textStyle").fontSize
  const numericSize =
    typeof rawSize === "string" && rawSize
      ? Number.parseFloat(rawSize)
      : null
  const [draft, setDraft] = React.useState(
    numericSize !== null ? String(numericSize) : ""
  )
  const [focused, setFocused] = React.useState(false)
  const [syncedSize, setSyncedSize] = React.useState(numericSize)

  // La selección puede cambiar de tamaño de fuente desde fuera (otro botón,
  // otra selección) mientras el input no tiene el foco: sincroniza el valor
  // mostrado ajustando el estado durante el render, sin useEffect.
  if (!focused && numericSize !== syncedSize) {
    setSyncedSize(numericSize)
    setDraft(numericSize !== null ? String(numericSize) : "")
  }

  const commit = (value: string) => {
    const parsed = Number.parseFloat(value.replace(",", "."))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      editor.chain().focus().unsetFontSize().run()
      setDraft("")
      return
    }
    const bounded = Math.min(400, Math.max(1, Math.round(parsed * 2) / 2))
    editor.chain().focus().setFontSize(`${bounded}pt`).run()
    setDraft(String(bounded))
  }

  const step = (direction: 1 | -1) => {
    const base = numericSize ?? 11
    const next = stepFontSize(base, direction)
    editor.chain().focus().setFontSize(`${next}pt`).run()
  }

  return (
    <div className="flex h-8 shrink-0 items-stretch overflow-hidden rounded border border-input bg-background">
      <button
        type="button"
        className="flex w-5 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Reducir tamaño de fuente"
        aria-label="Reducir tamaño de fuente"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => step(-1)}
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      <input
        value={draft}
        placeholder="11"
        inputMode="decimal"
        onFocus={() => setFocused(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setFocused(false)
          if (draft.trim()) commit(draft)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit(draft)
            ;(event.target as HTMLInputElement).blur()
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            step(1)
          } else if (event.key === "ArrowDown") {
            event.preventDefault()
            step(-1)
          }
        }}
        className="w-9 border-x border-input bg-transparent text-center text-xs focus-visible:outline-none"
        aria-label="Tamaño de fuente"
        title="Tamaño de fuente (pt)"
      />
      <button
        type="button"
        className="flex w-5 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Aumentar tamaño de fuente"
        aria-label="Aumentar tamaño de fuente"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => step(1)}
      >
        <ChevronUp className="h-3 w-3" />
      </button>
    </div>
  )
}

function LineSpacingPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false)
  const [customValue, setCustomValue] = React.useState("")
  const rawLineHeight = editor.getAttributes("textStyle").lineHeight
  const current = typeof rawLineHeight === "string" ? rawLineHeight : ""
  const isPreset = LINE_SPACING_PRESETS.some((preset) => preset.value === current)

  const apply = (value: string) => {
    if (!value) editor.chain().focus().unsetLineHeight().run()
    else editor.chain().focus().setLineHeight(value).run()
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setCustomValue(current && !isPreset ? current : "")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-input bg-background hover:bg-accent"
          title="Interlineado"
          aria-label="Interlineado"
        >
          <AlignVerticalSpaceAround className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 space-y-1 p-2" align="start">
        <p className="px-1 pb-1 text-xs font-semibold">Interlineado</p>
        <button
          type="button"
          onClick={() => apply("")}
          className={cn(
            "flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
            !current && "bg-accent/70 font-medium"
          )}
        >
          Predeterminado
        </button>
        {LINE_SPACING_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => apply(preset.value)}
            aria-pressed={current === preset.value}
            className={cn(
              "flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
              current === preset.value && "bg-accent/70 font-medium"
            )}
          >
            {preset.label}
          </button>
        ))}
        <Separator className="my-1" />
        <div className="space-y-1 px-1 pb-1">
          <p className="text-[11px] text-muted-foreground">
            Múltiplo personalizado
          </p>
          <div className="flex gap-1">
            <input
              type="number"
              min={0.5}
              max={10}
              step={0.05}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder="p. ej. 1,75"
              className="h-7 w-full rounded border border-input bg-background px-2 text-xs"
              onKeyDown={(event) => {
                if (event.key === "Enter" && customValue.trim()) {
                  event.preventDefault()
                  apply(customValue.trim())
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!customValue.trim()}
              onClick={() => apply(customValue.trim())}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function applyTextCase(editor: Editor, mode: TextCaseMode) {
  const { from, to, empty } = editor.state.selection
  if (empty) return
  const original = editor.state.doc.textBetween(from, to, "", "")
  if (!original) return
  const transformed = transformCase(original, mode)
  if (transformed === original) return

  const replacements: Array<{
    from: number
    to: number
    text: string
    marks: readonly Mark[]
  }> = []
  let cursor = 0
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return
    const nodeFrom = pos
    const nodeTo = pos + node.text.length
    const sliceFrom = Math.max(from, nodeFrom)
    const sliceTo = Math.min(to, nodeTo)
    if (sliceFrom >= sliceTo) return
    const length = sliceTo - sliceFrom
    const replacementText = transformed.slice(cursor, cursor + length)
    cursor += length
    const originalText = node.text.slice(sliceFrom - nodeFrom, sliceTo - nodeFrom)
    if (replacementText && replacementText !== originalText) {
      replacements.push({
        from: sliceFrom,
        to: sliceTo,
        text: replacementText,
        marks: node.marks,
      })
    }
  })
  if (!replacements.length) return

  const { tr } = editor.state
  for (const replacement of [...replacements].reverse()) {
    tr.replaceWith(
      replacement.from,
      replacement.to,
      editor.schema.text(replacement.text, [...replacement.marks])
    )
  }
  editor.view.dispatch(tr)
  editor.commands.focus()
}

function ChangeCaseButton({ editor }: { editor: Editor }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Toggle
          size="sm"
          aria-label="Cambiar mayúsculas y minúsculas"
          title="Cambiar mayúsculas y minúsculas"
          className="h-8 w-8 shrink-0"
        >
          <CaseSensitive />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-0.5 p-1.5" align="start">
        {TEXT_CASE_OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyTextCase(editor, option.mode)}
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

interface StyleFormValues {
  name: string
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  color: string
  spacingBefore: number
  spacingAfter: number
  lineHeight: number
}

function styleToFormValues(style: DocumentStyleDefinition): StyleFormValues {
  return {
    name: style.name,
    fontFamily: style.fontFamily ?? "Calibri, Candara, Segoe UI, sans-serif",
    fontSize: style.fontSize ?? 11,
    bold: Boolean(style.bold),
    italic: Boolean(style.italic),
    color: (style.color ?? "202020").replace("#", ""),
    spacingBefore: style.spacingBefore ?? 0,
    spacingAfter: style.spacingAfter ?? 0,
    lineHeight: style.lineHeight ?? 1.15,
  }
}

function captureSelectionFormValues(editor: Editor): StyleFormValues {
  const textAttrs = editor.getAttributes("textStyle")
  const nodeType = editor.isActive("heading") ? "heading" : "paragraph"
  const format = normalizeParagraphFormat(
    editor.getAttributes(nodeType).paragraphFormat
  )
  return {
    name: "",
    fontFamily: textAttrs.fontFamily ?? "Calibri, Candara, Segoe UI, sans-serif",
    fontSize: textAttrs.fontSize ? Number.parseFloat(textAttrs.fontSize) : 11,
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    color: String(textAttrs.color ?? "202020").replace("#", ""),
    spacingBefore: format.spacingBefore,
    spacingAfter: format.spacingAfter,
    lineHeight: textAttrs.lineHeight
      ? Number.parseFloat(textAttrs.lineHeight)
      : 1.15,
  }
}

function styleFormValuesToDefinition(
  values: StyleFormValues
): Omit<DocumentStyleDefinition, "id"> {
  return {
    name: values.name,
    fontFamily: values.fontFamily,
    fontSize: values.fontSize,
    bold: values.bold,
    italic: values.italic,
    color: values.color,
    spacingBefore: values.spacingBefore,
    spacingAfter: values.spacingAfter,
    lineHeight: values.lineHeight,
  }
}

function StyleForm({
  initialValues,
  onCancel,
  onSave,
}: {
  initialValues: StyleFormValues
  onCancel: () => void
  onSave: (values: StyleFormValues) => void
}) {
  const [values, setValues] = React.useState(initialValues)
  const patch = (partial: Partial<StyleFormValues>) =>
    setValues((current) => ({ ...current, ...partial }))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onCancel}
          aria-label="Volver a la lista de estilos"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold">
          {initialValues.name ? "Modificar estilo" : "Nuevo estilo"}
        </p>
      </div>

      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">Nombre</span>
        <Input
          value={values.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="Ej.: Cita destacada"
          className="h-8"
          autoFocus
        />
      </label>

      <div className="flex items-center gap-1.5">
        <RibbonCombobox
          value={values.fontFamily}
          placeholder="Buscar fuente…"
          options={FONT_FAMILY_OPTIONS}
          groupOrder={["web", "system"]}
          groupLabels={DOCUMENT_FONT_CATEGORY_LABELS}
          onSelect={(value) => patch({ fontFamily: value })}
          onCommitCustom={(value) => patch({ fontFamily: value })}
          ariaLabel="Fuente del estilo"
          widthClass="w-40"
        />
        <Input
          type="number"
          min={1}
          max={409}
          value={values.fontSize}
          onChange={(event) =>
            patch({ fontSize: Number(event.target.value) || values.fontSize })
          }
          className="h-8 w-16"
          aria-label="Tamaño de fuente del estilo"
        />
        <Toggle
          size="sm"
          pressed={values.bold}
          onPressedChange={(bold) => patch({ bold })}
          aria-label="Negrita"
          className="h-8 w-8"
        >
          <Bold className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={values.italic}
          onPressedChange={(italic) => patch({ italic })}
          aria-label="Cursiva"
          className="h-8 w-8"
        >
          <Italic className="h-3.5 w-3.5" />
        </Toggle>
        <label className="flex h-8 items-center gap-1 rounded border border-input bg-background px-1.5">
          <input
            type="color"
            value={`#${values.color}`}
            onChange={(event) =>
              patch({ color: event.target.value.replace("#", "") })
            }
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            aria-label="Color del texto del estilo"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <NumberControl
          label="Espacio antes (pt)"
          value={values.spacingBefore}
          min={0}
          max={240}
          onChange={(spacingBefore) => patch({ spacingBefore })}
        />
        <NumberControl
          label="Espacio después (pt)"
          value={values.spacingAfter}
          min={0}
          max={240}
          onChange={(spacingAfter) => patch({ spacingAfter })}
        />
        <NumberControl
          label="Interlineado"
          value={values.lineHeight}
          min={0.5}
          max={5}
          onChange={(lineHeight) => patch({ lineHeight })}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!values.name.trim()}
          onClick={() => onSave({ ...values, name: values.name.trim() })}
        >
          Guardar estilo
        </Button>
      </div>
    </div>
  )
}

interface StylesPanelContentProps {
  editor: Editor
  styles: DocumentStyleDefinition[]
  currentStyleId: string
  onApplyStyle: (styleId: string, styleNameOverride?: string) => void
  onAddStyle: (style: Omit<DocumentStyleDefinition, "id">) => string
  onUpdateStyle: (
    styleId: string,
    patch: Partial<Omit<DocumentStyleDefinition, "id">>
  ) => void
  onDeleteStyle: (styleId: string) => void
  onClose: () => void
}

function StylesPanelContent({
  editor,
  styles,
  currentStyleId,
  onApplyStyle,
  onAddStyle,
  onUpdateStyle,
  onDeleteStyle,
  onClose,
}: StylesPanelContentProps) {
  const [editingStyleId, setEditingStyleId] = React.useState<
    string | "new" | null
  >(null)

  if (editingStyleId === "new") {
    return (
      <StyleForm
        initialValues={captureSelectionFormValues(editor)}
        onCancel={() => setEditingStyleId(null)}
        onSave={(values) => {
          const id = onAddStyle(styleFormValuesToDefinition(values))
          onApplyStyle(id, values.name)
          setEditingStyleId(null)
          onClose()
        }}
      />
    )
  }

  const editingStyle = styles.find((style) => style.id === editingStyleId)
  if (editingStyle) {
    return (
      <StyleForm
        initialValues={styleToFormValues(editingStyle)}
        onCancel={() => setEditingStyleId(null)}
        onSave={(values) => {
          onUpdateStyle(editingStyle.id, styleFormValuesToDefinition(values))
          setEditingStyleId(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Estilos</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() => setEditingStyleId("new")}
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo a partir de la selección
        </Button>
      </div>
      <ScrollArea className="h-72 pr-2">
        <div className="space-y-1">
          {styles.map((style) => {
            const builtIn = isBuiltInStyleId(style.id)
            return (
              <div
                key={style.id}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-1 py-1",
                  style.id === currentStyleId
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-accent"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onApplyStyle(style.id)
                    onClose()
                  }}
                  className="flex-1 truncate rounded px-1.5 py-1 text-left"
                  style={{
                    fontFamily: style.fontFamily,
                    fontWeight: style.bold ? 700 : 400,
                    fontStyle: style.italic ? "italic" : "normal",
                    color: style.color ? `#${style.color.replace("#", "")}` : undefined,
                  }}
                  title={`Aplicar ${style.name}`}
                >
                  {style.name}
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setEditingStyleId(style.id)}
                  aria-label={`Modificar ${style.name}`}
                  title="Modificar estilo"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!builtIn && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => onDeleteStyle(style.id)}
                    aria-label={`Eliminar ${style.name}`}
                    title="Eliminar estilo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

function StylesPanelButton({
  editor,
  styles,
  currentStyleId,
  onApplyStyle,
  onAddStyle,
  onUpdateStyle,
  onDeleteStyle,
  label,
}: Omit<StylesPanelContentProps, "onClose"> & { label?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {label ?? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5 self-end"
            aria-label="Panel de estilos"
            title="Panel de estilos (crear y modificar)"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2.5" align="start">
        <StylesPanelContent
          editor={editor}
          styles={styles}
          currentStyleId={currentStyleId}
          onApplyStyle={onApplyStyle}
          onAddStyle={onAddStyle}
          onUpdateStyle={onUpdateStyle}
          onDeleteStyle={onDeleteStyle}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

function ImageButton({ editor }: { editor: Editor }) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      img.onload = () => {
        let editorSrc = src
        if (!/^data:image\/(?:png|jpe?g|gif|bmp);/i.test(src)) {
          const scale = Math.min(
            1,
            2048 / Math.max(1, img.naturalWidth),
            2048 / Math.max(1, img.naturalHeight)
          )
          const canvas = document.createElement("canvas")
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
          canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height)
          editorSrc = canvas.toDataURL("image/png")
        }
        const maxWidth = editor.isActive("table") ? 220 : 560
        const width = Math.min(img.naturalWidth, maxWidth)
        const height = Math.max(
          1,
          Math.round(width * (img.naturalHeight / img.naturalWidth))
        )
        editor
          .chain()
          .focus()
          .setImage({
            src: editorSrc,
            width,
            height,
            alt: file.name.replace(/\.[^.]+$/, ""),
          })
          .run()
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/bmp,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ""
        }}
      />
      <Toggle size="sm" aria-label="Insertar imagen" title="Insertar imagen" onPressedChange={() => inputRef.current?.click()}>
        <ImageIcon />
      </Toggle>
    </>
  )
}

function ImageOptionsPopover({ editor }: { editor: Editor }) {
  const isImage = editor.isActive("image")
  const attributes = editor.getAttributes("image")
  const width = Math.max(1, Number(attributes.width) || 320)
  const height = Math.max(1, Number(attributes.height) || 240)
  const wrap =
    typeof attributes.wrap === "string"
      ? attributes.wrap
      : "none"
  const spacing = Math.min(
    48,
    Math.max(0, Number(attributes.spacing) || 12)
  )

  const resizeImage = (nextWidth: number) => {
    const boundedWidth = Math.min(1200, Math.max(48, Math.round(nextWidth)))
    editor
      .chain()
      .focus()
      .updateAttributes("image", {
        width: boundedWidth,
        height: Math.max(1, Math.round(boundedWidth * (height / width))),
      })
      .run()
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={!isImage}
          onMouseDown={(event) => event.preventDefault()}
        >
          <ImageIcon />
          Formato de imagen
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div>
          <p className="text-sm font-medium">Tamaño y posición</p>
          <p className="text-xs text-muted-foreground">
            La proporción se conserva para evitar imágenes deformadas.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[180, 320, 480].map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => resizeImage(preset)}
            >
              {preset}px
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => resizeImage(editor.isActive("table") ? 220 : 560)}
          >
            Ajustar
          </Button>
        </div>
        <label className="grid grid-cols-[1fr_5rem] items-center gap-2 text-xs">
          <span className="text-muted-foreground">Ancho exacto</span>
          <Input
            type="number"
            min={48}
            max={1200}
            value={Math.round(width)}
            onChange={(event) => resizeImage(Number(event.target.value))}
            className="h-8"
          />
        </label>
        <label className="grid grid-cols-[1fr_8rem] items-center gap-2 text-xs">
          <span className="text-muted-foreground">Alineación</span>
          <select
            value={attributes.align ?? "center"}
            onChange={(event) =>
              editor
                .chain()
                .focus()
                .updateAttributes("image", { align: event.target.value })
                .run()
            }
            className="h-8 rounded border border-input bg-background px-2"
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </label>
        <label className="grid grid-cols-[1fr_8rem] items-center gap-2 text-xs">
          <span className="text-muted-foreground">Ajuste del texto</span>
          <select
            value={wrap}
            onChange={(event) => {
              const nextWrap = event.target.value
              editor
                .chain()
                .focus()
                .updateAttributes("image", {
                  wrap: nextWrap,
                  ...(nextWrap === "square-left" ||
                  nextWrap === "tight-left"
                    ? { align: "left" }
                    : nextWrap === "square-right" ||
                        nextWrap === "tight-right"
                      ? { align: "right" }
                      : {}),
                })
                .run()
            }}
            className="h-8 rounded border border-input bg-background px-2"
          >
            <option value="none">Arriba y abajo</option>
            <option value="square-left">Cuadrado · izquierda</option>
            <option value="square-right">Cuadrado · derecha</option>
            <option value="tight-left">Estrecho · izquierda</option>
            <option value="tight-right">Estrecho · derecha</option>
            <option value="behind">Detrás del texto</option>
            <option value="in-front">Delante del texto</option>
          </select>
        </label>
        {wrap !== "none" && (
          <label className="grid grid-cols-[1fr_5rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">Distancia al texto</span>
            <Input
              type="number"
              min={0}
              max={48}
              value={Math.round(spacing)}
              onChange={(event) =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes("image", {
                    spacing: Math.min(
                      48,
                      Math.max(0, Number(event.target.value) || 0)
                    ),
                  })
                  .run()
              }
              className="h-8"
            />
          </label>
        )}
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">
            Texto alternativo accesible
          </span>
          <Input
            value={attributes.alt ?? ""}
            onChange={(event) =>
              editor
                .chain()
                .focus()
                .updateAttributes("image", { alt: event.target.value })
                .run()
            }
            placeholder="Describe la información de la imagen"
            className="h-8"
          />
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full text-destructive"
          onClick={() => editor.chain().focus().deleteSelection().run()}
        >
          Eliminar imagen
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function TableButton({ editor }: { editor: Editor }) {
  const [rows, setRows] = React.useState(3)
  const [columns, setColumns] = React.useState(3)
  const [header, setHeader] = React.useState(true)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Toggle
          size="sm"
          pressed={editor.isActive("table")}
          aria-label="Insertar o editar tabla"
          title="Insertar o editar tabla"
        >
          <TableIcon />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div>
          <p className="text-sm font-medium">Insertar tabla</p>
          <p className="text-xs text-muted-foreground">
            Las columnas se pueden redimensionar arrastrando sus bordes.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Filas</span>
            <Input
              type="number"
              min={1}
              max={20}
              value={rows}
              onChange={(event) =>
                setRows(Math.min(20, Math.max(1, Number(event.target.value))))
              }
              className="h-8"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Columnas</span>
            <Input
              type="number"
              min={1}
              max={20}
              value={columns}
              onChange={(event) =>
                setColumns(
                  Math.min(20, Math.max(1, Number(event.target.value)))
                )
              }
              className="h-8"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={header}
            onChange={(event) => setHeader(event.target.checked)}
          />
          Primera fila como cabecera
        </label>
        <Button
          type="button"
          className="w-full"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({
                rows,
                cols: columns,
                withHeaderRow: header,
              })
              .run()
          }
        >
          Insertar {rows} × {columns}
        </Button>
        {editor.isActive("table") && (
          <>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">
              Tabla seleccionada
            </p>
            <div className="grid grid-cols-3 gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                + fila
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                + columna
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().mergeCells().run()}
              >
                Combinar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                − fila
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                − columna
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().splitCell().run()}
              >
                Dividir
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

type RibbonTab =
  | RibbonPreferenceTabId
  | "image"
  | "table"
  | "textBox"
  | "documentShape"

const RIBBON_TABS: Array<{
  id: RibbonPreferenceTabId
  label: string
  keyTip: string
  contextual?: boolean
}> = [
  { id: "home", label: "Inicio", keyTip: "H" },
  { id: "insert", label: "Insertar", keyTip: "N" },
  { id: "design", label: "Diseño", keyTip: "G" },
  { id: "layout", label: "Disposición", keyTip: "P" },
  { id: "references", label: "Referencias", keyTip: "S" },
  { id: "mailings", label: "Correspondencia", keyTip: "M" },
  { id: "review", label: "Revisar", keyTip: "R" },
  { id: "view", label: "Vista", keyTip: "W" },
  { id: "ai", label: "IA", keyTip: "A" },
]

const RIBBON_GROUP_LABELS: Record<string, string> = {
  "home.clipboard": "Portapapeles",
  "home.font": "Fuente",
  "home.styles": "Estilos",
  "home.paragraph": "Párrafo",
  "home.editing": "Edición",
  "insert.content": "Insertar",
  "insert.pages": "Encabezado, pie y página",
  "insert.fields": "Campos y fórmulas",
  "insert.form": "Formulario",
  "design.themes": "Temas del documento",
  "design.page": "Fondo de página",
  "design.customize": "Personalizar",
  "layout.page": "Página",
  "layout.zoom": "Zoom",
  "references.citations": "Citas y bibliografía",
  "references.academic": "Documento académico",
  "mailings.merge": "Combinar correspondencia",
  "review.versions": "Versiones",
  "review.review": "Revisión",
  "review.accessibility": "Accesibilidad",
  "view.show": "Mostrar",
  "view.zoom": "Zoom",
  "view.immersive": "Inmersión",
  "ai.assistant": "Asistente IA",
}

/**
 * La cinta es, con diferencia, el componente más caro del árbol: renderizarla
 * cuesta unos 55 ms, y lo hacía en cada cambio de estado de `AppShell` —abrir
 * un panel, cambiar el zoom, recibir una métrica— aunque no le afectara nada.
 * Medido con la cinta colapsada, ese mismo cambio de estado no producía ni una
 * tarea larga, así que el coste era enteramente suyo.
 *
 * `React.memo` lo corta, a condición de que las props se mantengan estables;
 * de eso se encarga `useStableCallback` en `AppShell`. La cinta no se queda
 * congelada: ya se suscribe por su cuenta a la selección y a las transacciones
 * del editor para repintarse cuando de verdad cambia algo suyo.
 */
export const EditorToolbar = React.memo(function EditorToolbar({
  editor,
  onOpenBackstage,
  onAiOpen,
  onAiAction,
  onOpenReferences,
  onOpenVersions,
  onOpenLayout,
  onOpenReview,
  onOpenAccessibility,
  onOpenImmersiveReader,
  onInsertTableOfContents,
  onOpenFootnotes,
  onInsertPageBreak,
  onOpenDocumentTools,
  onOpenFind,
  onInsertChartFromTable,
  formFillMode,
  onToggleFormFillMode,
  onOpenWritingTools,
  onOpenMailMerge,
  onToggleFocusMode,
  focusMode,
  trackChanges,
  styles,
  onAddStyle,
  onUpdateStyle,
  onDeleteStyle,
  layout,
  pageAppearance,
  onLayoutChange,
  onPageAppearanceChange,
  onApplyStyleTheme,
}: EditorToolbarProps) {
  const [, forceRerender] = React.useReducer((c) => c + 1, 0)
  const [selectedRibbonTab, setRibbonTab] =
    React.useState<RibbonTab>("home")
  const [ribbonExpanded, setRibbonExpanded] = React.useState(true)
  const [selectedStyleTheme, setSelectedStyleTheme] =
    React.useState<DocumentStyleThemeId>("word")
  const [keyTipsVisible, setKeyTipsVisible] = React.useState(false)
  const [formatPainter, setFormatPainter] =
    React.useState<FormattingSnapshot | null>(null)
  const [formatPainterLocked, setFormatPainterLocked] = React.useState(false)
  const fontHoverPreviewRef = React.useRef<string | null | undefined>(
    undefined
  )
  const styleGalleryRef = React.useRef<HTMLDivElement>(null)
  const ribbonToolsRef = React.useRef<HTMLDivElement>(null)
  const lastSelectionRef = React.useRef<{
    from: number
    to: number
  } | null>(null)
  const ribbonPreferenceTabs = useUiPreferencesStore(
    (state) => state.ribbonTabs
  )
  const hiddenRibbonGroups = useUiPreferencesStore(
    (state) => state.hiddenRibbonGroups
  )
  const toggleRibbonTab = useUiPreferencesStore(
    (state) => state.toggleRibbonTab
  )
  const moveRibbonTab = useUiPreferencesStore((state) => state.moveRibbonTab)
  const toggleRibbonGroup = useUiPreferencesStore(
    (state) => state.toggleRibbonGroup
  )
  const resetRibbon = useUiPreferencesStore((state) => state.resetRibbon)

  React.useEffect(() => {
    if (!editor) return
    let frame = 0
    let signature = editorToolbarSignature(editor)
    const update = () => {
      if (!editor.state.selection.empty) {
        lastSelectionRef.current = {
          from: editor.state.selection.from,
          to: editor.state.selection.to,
        }
      }
      const nextSignature = editorToolbarSignature(editor)
      if (nextSignature === signature) return
      signature = nextSignature
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        forceRerender()
      })
    }
    editor.on("selectionUpdate", update)
    editor.on("transaction", update)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      editor.off("selectionUpdate", update)
      editor.off("transaction", update)
    }
  }, [editor])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && formatPainter) {
        setFormatPainter(null)
        setFormatPainterLocked(false)
      }
      if (event.key === "Escape" && keyTipsVisible) {
        event.preventDefault()
        setKeyTipsVisible(false)
        return
      }
      if (event.key === "Alt" && !event.repeat) {
        event.preventDefault()
        setKeyTipsVisible(true)
        return
      }
      const key = event.key.toUpperCase()
      const keyTipTab = RIBBON_TABS.find(
        (tab) =>
          tab.keyTip === key && ribbonPreferenceTabs.includes(tab.id)
      )
      if ((event.altKey || keyTipsVisible) && keyTipTab) {
        event.preventDefault()
        setRibbonTab(keyTipTab.id)
        setRibbonExpanded(true)
        setKeyTipsVisible(false)
        requestAnimationFrame(() => {
          ribbonToolsRef.current
            ?.querySelector<HTMLElement>(
              "button:not(:disabled), select:not(:disabled), input:not(:disabled)"
            )
            ?.focus()
        })
        return
      }
      if ((event.altKey || keyTipsVisible) && key === "F") {
        event.preventDefault()
        setKeyTipsVisible(false)
        onOpenBackstage()
        return
      }
      if (keyTipsVisible && !["ALT", "SHIFT", "CONTROL", "META"].includes(key)) {
        setKeyTipsVisible(false)
      }
    }
    const handlePointerDown = () => setKeyTipsVisible(false)
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("pointerdown", handlePointerDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [
    formatPainter,
    keyTipsVisible,
    onOpenBackstage,
    ribbonPreferenceTabs,
  ])

  React.useEffect(() => {
    if (!editor || !formatPainter) return
    const editorElement = document.querySelector<HTMLElement>(
      ".doc-page .ProseMirror"
    )
    if (!editorElement) return
    editorElement.dataset.formatPainter = "true"
    const applyPainter = () => {
      if (editor.state.selection.empty) return
      const applied = applyFormattingSnapshot(editor, formatPainter)
      if (!applied) return
      toast.success("Formato aplicado", {
        description: formatPainterLocked
          ? "El pincel sigue activo; pulsa Esc para terminar."
          : "El pincel se ha desactivado después de esta aplicación.",
      })
      if (!formatPainterLocked) setFormatPainter(null)
    }
    editorElement.addEventListener("mouseup", applyPainter)
    editorElement.addEventListener("keyup", applyPainter)
    return () => {
      delete editorElement.dataset.formatPainter
      editorElement.removeEventListener("mouseup", applyPainter)
      editorElement.removeEventListener("keyup", applyPainter)
    }
  }, [editor, formatPainter, formatPainterLocked])

  const imageSelected = Boolean(editor?.isActive("image"))
  const tableSelected = Boolean(editor?.isActive("table"))
  const textBoxSelected = Boolean(editor?.isActive("textBox"))
  const shapeSelected = Boolean(editor?.isActive("documentShape"))

  if (!editor) return null

  const fallbackRibbonTab = ribbonPreferenceTabs[0] ?? "home"
  const ribbonTab =
    (selectedRibbonTab === "image" && !imageSelected) ||
    (selectedRibbonTab === "table" && !tableSelected) ||
    (selectedRibbonTab === "textBox" && !textBoxSelected) ||
    (selectedRibbonTab === "documentShape" && !shapeSelected)
      ? fallbackRibbonTab
      : DEFAULT_RIBBON_TABS.includes(
            selectedRibbonTab as RibbonPreferenceTabId
          ) &&
          !ribbonPreferenceTabs.includes(
            selectedRibbonTab as RibbonPreferenceTabId
          )
        ? fallbackRibbonTab
      : selectedRibbonTab
  const hasSelection = !editor.state.selection.empty
  const textStyle = editor.getAttributes("textStyle")
  const fontFamilyValue =
    typeof textStyle.fontFamily === "string" ? textStyle.fontFamily : ""
  const fontFamilyOption = FONT_FAMILY_OPTIONS.find(
    (option) => option.value === fontFamilyValue
  )
  const fontFamilyDisplay = fontFamilyValue
    ? (fontFamilyOption?.label ?? primaryFontName(fontFamilyValue))
    : "Documento"

  // Vista previa en vivo del selector de fuente: aplica temporalmente al
  // pasar el ratón (sin entrar en el historial de deshacer) y revierte si
  // el usuario sale sin hacer clic — igual que Word con temas y estilos.
  const previewFontFamily = (value: string) => {
    if (editor.state.selection.empty) return
    if (fontHoverPreviewRef.current === undefined) {
      fontHoverPreviewRef.current =
        (editor.getAttributes("textStyle").fontFamily as string | undefined) ??
        null
    }
    editor
      .chain()
      .command(({ tr }) => {
        tr.setMeta("addToHistory", false)
        return true
      })
      .setFontFamily(value)
      .run()
  }
  const endFontFamilyPreview = () => {
    if (fontHoverPreviewRef.current === undefined) return
    const original = fontHoverPreviewRef.current
    fontHoverPreviewRef.current = undefined
    const chain = editor
      .chain()
      .command(({ tr }) => {
        tr.setMeta("addToHistory", false)
        return true
      })
    if (original) chain.setFontFamily(original).run()
    else chain.unsetFontFamily().run()
  }
  const imageAttributes = editor.getAttributes("image")
  const tableAttributes = editor.getAttributes("table")
  const textBoxAttributes = editor.getAttributes("textBox")
  const shapeAttributes = editor.getAttributes("documentShape")
  const ribbonTabs = [
    ...ribbonPreferenceTabs
      .map((id) => RIBBON_TABS.find((tab) => tab.id === id))
      .filter((tab): tab is (typeof RIBBON_TABS)[number] => Boolean(tab)),
    ...(imageSelected
      ? [
          {
            id: "image" as const,
            label: "Formato de imagen",
            keyTip: "JP",
            contextual: true,
          },
        ]
      : []),
    ...(tableSelected
      ? [
          {
            id: "table" as const,
            label: "Presentación de tabla",
            keyTip: "JL",
            contextual: true,
          },
        ]
      : []),
    ...(textBoxSelected
      ? [
          {
            id: "textBox" as const,
            label: "Formato de forma",
            keyTip: "JD",
            contextual: true,
          },
        ]
      : []),
    ...(shapeSelected
      ? [
          {
            id: "documentShape" as const,
            label: "Formato de forma",
            keyTip: "JS",
            contextual: true,
          },
        ]
      : []),
  ]
  const showRibbonGroup = (group: string) =>
    !hiddenRibbonGroups.includes(group)
  const currentStyleId =
    editor.getAttributes("heading").styleId ??
    editor.getAttributes("paragraph").styleId ??
    (editor.isActive("heading", { level: 1 })
      ? "Heading1"
      : editor.isActive("heading", { level: 2 })
        ? "Heading2"
        : editor.isActive("heading", { level: 3 })
          ? "Heading3"
          : "Normal")

  const applyNamedStyle = (styleId: string, styleNameOverride?: string) => {
    const style = styles.find((candidate) => candidate.id === styleId)
    const styleName = styleNameOverride ?? style?.name ?? styleId
    const headingLevel =
      styleId === "Heading1"
        ? 1
        : styleId === "Heading2"
          ? 2
          : styleId === "Heading3"
            ? 3
            : null
    if (headingLevel) {
      editor
        .chain()
        .focus()
        .setHeading({ level: headingLevel as 1 | 2 | 3 })
        .updateAttributes("heading", {
          styleId,
          styleName,
        })
        .run()
      return
    }
    editor
      .chain()
      .focus()
      .setParagraph()
      .updateAttributes("paragraph", {
        styleId,
        styleName,
      })
      .run()
  }

  const pastePlainText = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        toast.info("El portapapeles no contiene texto")
        return
      }
      const safeHtml = text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replace(/\r?\n/g, "<br>")
      editor.chain().focus().insertContent(safeHtml).run()
    } catch {
      toast.info("Usa Ctrl+Mayús+V para pegar sin formato", {
        description:
          "Windows no ha concedido acceso directo al portapapeles en esta ventana.",
      })
    }
  }

  const clearFormatting = () => {
    editor.chain().focus().unsetAllMarks().clearNodes().run()
  }

  const toggleFormatPainter = () => {
    if (formatPainter) {
      setFormatPainter(null)
      setFormatPainterLocked(false)
      toast.info("Pincel de formato desactivado")
      return
    }
    const snapshot = captureFormattingSnapshot(editor)
    if (!snapshot) {
      toast.error("No se ha podido capturar el formato actual")
      return
    }
    setFormatPainter(snapshot)
    setFormatPainterLocked(false)
    toast.info("Selecciona el texto que debe recibir este formato", {
      description: "Haz doble clic en el pincel para aplicarlo varias veces.",
    })
  }

  const lockFormatPainter = () => {
    const snapshot = captureFormattingSnapshot(editor)
    if (!snapshot) return
    setFormatPainter(snapshot)
    setFormatPainterLocked(true)
    toast.info("Pincel de formato bloqueado", {
      description: "Puedes aplicarlo varias veces. Pulsa Esc para terminar.",
    })
  }

  const visibleStyles = [
    "Normal",
    "NoSpacing",
    "Title",
    "Subtitle",
    "Heading1",
    "Heading2",
    "Heading3",
  ]
    .map((styleId) => styles.find((style) => style.id === styleId))
    .filter((style): style is DocumentStyleDefinition => Boolean(style))

  const setZoom = (zoom: number) => {
    onLayoutChange({
      ...layout,
      zoom: Math.min(2, Math.max(0.5, Math.round(zoom * 20) / 20)),
    })
  }

  const openReviewPanel = () => {
    const { from, to, empty } = editor.state.selection
    onOpenReview(
      empty ? lastSelectionRef.current : { from, to }
    )
  }

  return (
    <div className="shrink-0 border-b border-border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]">
      <nav
        className="flex h-9 items-end gap-0.5 border-b border-border bg-muted/30 px-2"
        aria-label="Pestañas de la cinta"
      >
        <button
          type="button"
          onClick={onOpenBackstage}
          className="relative mr-1 h-8 self-center rounded-sm bg-[#185abd] px-3 text-xs font-medium text-white transition hover:bg-[#144a9c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          title="Archivo (Alt+F)"
        >
          Archivo
          {keyTipsVisible && (
            <span className="absolute -bottom-4 left-1/2 z-50 -translate-x-1/2 rounded border border-amber-700 bg-amber-50 px-1 text-[10px] font-bold leading-4 text-amber-950 shadow-sm">
              F
            </span>
          )}
        </button>
        {ribbonTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (ribbonTab === tab.id) {
                setRibbonExpanded((expanded) => !expanded)
              } else {
                setRibbonTab(tab.id)
                setRibbonExpanded(true)
              }
            }}
            aria-pressed={ribbonTab === tab.id}
            className={cn(
              "relative h-9 border-b-[3px] px-3 text-xs font-medium transition-colors",
              ribbonTab === tab.id
                ? "border-primary text-primary"
                : tab.contextual
                  ? "border-transparent bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
                  : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {keyTipsVisible && (
              <span className="absolute bottom-0 left-1/2 z-50 -translate-x-1/2 translate-y-3 rounded border border-amber-700 bg-amber-50 px-1 text-[10px] font-bold leading-4 text-amber-950 shadow-sm">
                {tab.keyTip}
              </span>
            )}
          </button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="ml-auto mb-0.5 flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Personalizar la cinta"
              title="Personalizar la cinta"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3" align="end">
            <div>
              <p className="text-sm font-semibold">Personalizar la cinta</p>
              <p className="text-xs text-muted-foreground">
                Muestra, oculta y reordena pestañas. Los cambios se guardan en
                este equipo.
              </p>
            </div>
            <div className="space-y-1">
              {RIBBON_TABS.map((tab) => {
                const visible = ribbonPreferenceTabs.includes(tab.id)
                const index = ribbonPreferenceTabs.indexOf(tab.id)
                return (
                  <div
                    key={tab.id}
                    className="flex items-center gap-1 rounded-md border border-border/70 p-1"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
                      aria-pressed={visible}
                      onClick={() => {
                        if (
                          visible &&
                          ribbonTab === tab.id &&
                          ribbonPreferenceTabs.length > 1
                        ) {
                          setRibbonTab(
                            ribbonPreferenceTabs.find(
                              (candidate) => candidate !== tab.id
                            ) ?? "home"
                          )
                        }
                        toggleRibbonTab(tab.id)
                      }}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border text-[10px]",
                          visible
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        )}
                        aria-hidden="true"
                      >
                        {visible ? "✓" : ""}
                      </span>
                      <span className="truncate">{tab.label}</span>
                      <kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[9px]">
                        Alt+{tab.keyTip}
                      </kbd>
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                      onClick={() => moveRibbonTab(tab.id, -1)}
                      disabled={!visible || index <= 0}
                      aria-label={`Mover ${tab.label} a la izquierda`}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                      onClick={() => moveRibbonTab(tab.id, 1)}
                      disabled={
                        !visible || index === ribbonPreferenceTabs.length - 1
                      }
                      aria-label={`Mover ${tab.label} a la derecha`}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
            {DEFAULT_RIBBON_TABS.includes(
              ribbonTab as RibbonPreferenceTabId
            ) && (
              <div className="space-y-1 border-t border-border pt-3">
                <p className="text-xs font-semibold">
                  Grupos de{" "}
                  {
                    RIBBON_TABS.find((tab) => tab.id === ribbonTab)
                      ?.label
                  }
                </p>
                <div className="flex flex-wrap gap-1">
                  {(
                    RIBBON_GROUPS_BY_TAB[
                      ribbonTab as RibbonPreferenceTabId
                    ] ?? []
                  ).map((group) => {
                    const visible = !hiddenRibbonGroups.includes(group)
                    return (
                      <button
                        key={group}
                        type="button"
                        aria-pressed={visible}
                        onClick={() => toggleRibbonGroup(group)}
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px] transition",
                          visible
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {visible ? "✓ " : ""}
                        {RIBBON_GROUP_LABELS[group] ?? group}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              onClick={resetRibbon}
            >
              Restaurar cinta predeterminada
            </Button>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={() => setRibbonExpanded((expanded) => !expanded)}
          className="mb-0.5 flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-expanded={ribbonExpanded}
          aria-label={
            ribbonExpanded
              ? "Ocultar herramientas de edición"
              : "Mostrar herramientas de edición"
          }
          title={
            ribbonExpanded
              ? "Ocultar herramientas de edición"
              : "Mostrar herramientas de edición"
          }
        >
          {ribbonExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </nav>
      {ribbonExpanded && (
      <div
        ref={ribbonToolsRef}
        className="ribbon-tools flex min-h-[76px] items-stretch overflow-x-auto px-1 py-1 xl:overflow-x-hidden"
      >
        {ribbonTab === "home" && (
          <>
            {showRibbonGroup("home.clipboard") && (
            <RibbonGroup label="Portapapeles">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 shrink-0 flex-col gap-0 px-2 text-[10px]"
                onClick={() => void pastePlainText()}
                title="Pegar solo texto (Ctrl+Mayús+V)"
              >
                <ClipboardPaste className="h-5 w-5" />
                Pegar texto
              </Button>
              <button
                type="button"
                aria-pressed={Boolean(formatPainter)}
                aria-label={
                  formatPainterLocked
                    ? "Pincel de formato bloqueado"
                    : "Pincel de formato"
                }
                title="Pincel de formato · clic para una aplicación, doble clic para varias"
                onMouseDown={(event) => event.preventDefault()}
                onClick={toggleFormatPainter}
                onDoubleClick={lockFormatPainter}
                className={cn(
                  "relative flex h-10 shrink-0 flex-col items-center justify-center gap-0 rounded px-2 text-[10px] transition",
                  formatPainter
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Paintbrush className="h-5 w-5" />
                Pincel
                {formatPainterLocked && (
                  <span className="absolute right-0.5 top-0 text-[11px] font-bold">
                    ∞
                  </span>
                )}
              </button>
              <FormattingInspectorPopover editor={editor} />
            </RibbonGroup>
            )}
            <Separator orientation="vertical" className="h-auto" />
            {showRibbonGroup("home.font") && (
            <RibbonGroup label="Fuente">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-0.5">
                  <RibbonCombobox
                    value={fontFamilyValue}
                    displayValue={fontFamilyDisplay}
                    placeholder="Buscar fuente…"
                    options={FONT_FAMILY_OPTIONS}
                    groupOrder={["web", "system"]}
                    groupLabels={DOCUMENT_FONT_CATEGORY_LABELS}
                    onSelect={(value) => editor.chain().focus().setFontFamily(value).run()}
                    onCommitCustom={(value) => editor.chain().focus().setFontFamily(value).run()}
                    onOptionHover={previewFontFamily}
                    onOptionHoverEnd={endFontFamilyPreview}
                    ariaLabel="Familia tipográfica"
                    title="Familia tipográfica"
                    widthClass="w-32"
                    triggerStyle={fontFamilyValue ? { fontFamily: fontFamilyValue } : undefined}
                  />
                  <FontSizeControl editor={editor} />
                </div>
                <div className="flex items-center gap-0.5">
                  <ToolbarButton label="Negrita" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></ToolbarButton>
                  <ToolbarButton label="Cursiva" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></ToolbarButton>
                  <ToolbarButton label="Subrayado" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon /></ToolbarButton>
                  <ToolbarButton label="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></ToolbarButton>
                  <ToolbarButton label="Superíndice" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}><SuperscriptIcon /></ToolbarButton>
                  <ToolbarButton label="Subíndice" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}><SubscriptIcon /></ToolbarButton>
                  <ToolbarButton label="Código" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code /></ToolbarButton>
                  <ChangeCaseButton editor={editor} />
                  <ColorPopover icon={<Palette />} label="Color de texto" colors={TEXT_COLORS} isActive={editor.isActive("textStyle")} apply={(color) => editor.chain().focus().setColor(color).run()} clear={() => editor.chain().focus().unsetColor().run()} />
                  <ColorPopover icon={<Highlighter />} label="Resaltado" colors={HIGHLIGHT_COLORS} isActive={editor.isActive("highlight")} apply={(color) => editor.chain().focus().toggleHighlight({ color }).run()} clear={() => editor.chain().focus().unsetHighlight().run()} />
                  <ToolbarButton label="Borrar todo el formato" onClick={clearFormatting}><Eraser /></ToolbarButton>
                </div>
              </div>
            </RibbonGroup>
            )}
            <Separator orientation="vertical" className="h-auto" />
            {showRibbonGroup("home.styles") && (
            <RibbonGroup label="Estilos">
              <div className="flex items-stretch">
                <div
                  ref={styleGalleryRef}
                  className="ribbon-style-gallery flex max-w-[300px] gap-1 overflow-x-auto 2xl:max-w-[390px]"
                >
                  {visibleStyles.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => applyNamedStyle(style.id)}
                      aria-pressed={currentStyleId === style.id}
                      title={`Aplicar estilo ${style.name}`}
                      className={cn(
                        "h-10 min-w-20 rounded-sm border px-2 text-left font-serif text-[11px] transition-colors",
                        currentStyleId === style.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background hover:border-primary/60 hover:bg-accent"
                      )}
                    >
                      <span
                        className={cn(
                          "block truncate",
                          style.bold && "font-bold",
                          style.italic && "italic",
                          style.id.startsWith("Heading") && "text-primary"
                        )}
                      >
                        {style.name}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="ml-0.5 flex flex-col overflow-hidden rounded-sm border border-border bg-background">
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Estilos anteriores"
                    title="Estilos anteriores"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      styleGalleryRef.current?.scrollBy({
                        left: -240,
                        behavior: "smooth",
                      })
                    }
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center border-t border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Estilos siguientes"
                    title="Estilos siguientes"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      styleGalleryRef.current?.scrollBy({
                        left: 240,
                        behavior: "smooth",
                      })
                    }
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  <StylesPanelButton
                    editor={editor}
                    styles={styles}
                    currentStyleId={currentStyleId}
                    onApplyStyle={applyNamedStyle}
                    onAddStyle={onAddStyle}
                    onUpdateStyle={onUpdateStyle}
                    onDeleteStyle={onDeleteStyle}
                    label={
                      <button
                        type="button"
                        className="flex h-5 w-5 items-center justify-center border-t border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Panel de estilos (crear y modificar)"
                        title="Panel de estilos (crear y modificar)"
                      >
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    }
                  />
                </div>
              </div>
            </RibbonGroup>
            )}
            <Separator orientation="vertical" className="h-auto" />
            {showRibbonGroup("home.paragraph") && (
            <RibbonGroup label="Párrafo">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-0.5">
                  <ToolbarButton label="Lista con viñetas" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></ToolbarButton>
                  <ToolbarButton label="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></ToolbarButton>
                  <ToolbarButton label="Cita" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></ToolbarButton>
                  <ToolbarButton label="Alinear a la izquierda" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft /></ToolbarButton>
                </div>
                <div className="flex items-center gap-0.5">
                  <ToolbarButton label="Centrar" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter /></ToolbarButton>
                  <ToolbarButton label="Alinear a la derecha" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight /></ToolbarButton>
                  <ToolbarButton label="Justificar" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify /></ToolbarButton>
                  <LineSpacingPopover editor={editor} />
                </div>
              </div>
              <ParagraphOptionsPopover editor={editor} />
            </RibbonGroup>
            )}
            {showRibbonGroup("home.editing") && (
            <RibbonGroup label="Edición">
              <ToolbarButton label="Buscar y reemplazar (Ctrl+F)" onClick={onOpenFind}><Search /></ToolbarButton>
              <ToolbarButton label="Seleccionar todo" onClick={() => editor.chain().focus().selectAll().run()}><TextSelect /></ToolbarButton>
            </RibbonGroup>
            )}
          </>
        )}

        {ribbonTab === "design" && (
          <>
            {showRibbonGroup("design.themes") && (
            <RibbonGroup label="Temas del documento">
              <div className="flex items-stretch gap-1">
                {DOCUMENT_STYLE_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setSelectedStyleTheme(theme.id)
                      onApplyStyleTheme(theme.id)
                    }}
                    aria-pressed={selectedStyleTheme === theme.id}
                    className={cn(
                      "group flex h-12 w-28 flex-col justify-center rounded-md border bg-background px-2 text-left transition",
                      selectedStyleTheme === theme.id
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-border hover:border-primary/45 hover:bg-accent/40"
                    )}
                    title={theme.description}
                  >
                    <span
                      className="truncate text-sm font-semibold"
                      style={{
                        color: theme.accent,
                        fontFamily: theme.headingFont,
                      }}
                    >
                      {theme.name}
                    </span>
                    <span
                      className="truncate text-[10px] text-muted-foreground"
                      style={{ fontFamily: theme.bodyFont }}
                    >
                      {theme.description}
                    </span>
                  </button>
                ))}
              </div>
            </RibbonGroup>
            )}
            {showRibbonGroup("design.page") && (
            <RibbonGroup label="Fondo de página">
              <label className="flex h-8 items-center gap-2 rounded border border-input bg-background px-2 text-xs hover:bg-accent">
                <input
                  type="color"
                  value={pageAppearance.color}
                  onChange={(event) =>
                    onPageAppearanceChange({
                      ...pageAppearance,
                      color: event.target.value,
                    })
                  }
                  className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                  aria-label="Color de página"
                />
                Color
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenLayout("borders")}
              >
                Bordes
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenLayout("watermark")}
              >
                Marca de agua
              </Button>
              <ToolbarButton
                label="Guiones automáticos"
                active={pageAppearance.hyphenation}
                onClick={() =>
                  onPageAppearanceChange({
                    ...pageAppearance,
                    hyphenation: !pageAppearance.hyphenation,
                  })
                }
              >
                <Pilcrow />
              </ToolbarButton>
            </RibbonGroup>
            )}
            {showRibbonGroup("design.customize") && (
            <RibbonGroup label="Personalizar">
              <StylesPanelButton
                editor={editor}
                styles={styles}
                currentStyleId={currentStyleId}
                onApplyStyle={applyNamedStyle}
                onAddStyle={onAddStyle}
                onUpdateStyle={onUpdateStyle}
                onDeleteStyle={onDeleteStyle}
                label={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    title="Panel de estilos: aplicar, crear y modificar"
                  >
                    <Palette />
                    Estilos
                  </Button>
                }
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenLayout("page")}
              >
                <Ruler />
                Página
              </Button>
            </RibbonGroup>
            )}
          </>
        )}

        {ribbonTab === "insert" && (
          <>
            {showRibbonGroup("insert.content") && (
            <RibbonGroup label="Insertar">
              <LinkPopover editor={editor} />
              <TableButton editor={editor} />
              <ImageButton editor={editor} />
              <ImageOptionsPopover editor={editor} />
              <TextBoxButton editor={editor} />
              <ShapeButton editor={editor} />
              <IconGalleryButton editor={editor} />
              <WordArtButton editor={editor} />
              <ToolbarButton label="Línea horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus /></ToolbarButton>
              <Button size="sm" variant="outline" onClick={onInsertPageBreak}>
                <Pilcrow />
                Salto de página
              </Button>
            </RibbonGroup>
            )}
            <Separator orientation="vertical" className="h-auto" />
            {showRibbonGroup("insert.pages") && (
            <RibbonGroup label="Encabezado, pie y página">
              <Button size="sm" variant="outline" onClick={() => onOpenLayout("headerFooter")} title="Editar encabezado y pie de página">
                <FileText />
                Encabezado y pie
              </Button>
              <Button size="sm" variant="outline" onClick={() => onOpenLayout("pageNumber")} title="Insertar número de página">
                <Hash />
                Número de página
              </Button>
              <Button size="sm" variant="outline" onClick={() => onOpenLayout("watermark")} title="Añadir marca de agua">
                <Droplets />
                Marca de agua
              </Button>
              <Button size="sm" variant="outline" onClick={() => onOpenLayout("borders")} title="Bordes de página">
                <RectangleHorizontal />
                Bordes
              </Button>
            </RibbonGroup>
            )}
            <Separator orientation="vertical" className="h-auto" />
            {showRibbonGroup("insert.fields") && (
            <RibbonGroup label="Campos y fórmulas">
              <SymbolPopover editor={editor} />
              <Button size="sm" variant="outline" onClick={() => onOpenDocumentTools()}>
                <Wrench />
                Herramientas del documento
              </Button>
            </RibbonGroup>
            )}
            <Separator orientation="vertical" className="h-auto" />
            {showRibbonGroup("insert.form") && (
            <RibbonGroup label="Formulario">
              <ToolbarButton
                label="Casilla de verificación"
                onClick={() => editor.chain().focus().insertFormCheckbox().run()}
              >
                <SquareCheck />
              </ToolbarButton>
              <ToolbarButton
                label="Hueco de texto rellenable"
                onClick={() =>
                  editor.chain().focus().insertFormTextField().run()
                }
              >
                <TextCursorInput />
              </ToolbarButton>
              <ToolbarButton
                label="Desplegable de opciones"
                onClick={() => editor.chain().focus().insertFormDropdown().run()}
              >
                <ListChecks />
              </ToolbarButton>
              <Button
                size="sm"
                variant={formFillMode ? "default" : "outline"}
                onClick={onToggleFormFillMode}
                aria-pressed={formFillMode}
                title="Bloquea el texto y deja solo los campos rellenables"
              >
                <PenLine />
                {formFillMode ? "Salir de rellenar" : "Modo rellenar"}
              </Button>
            </RibbonGroup>
            )}
          </>
        )}

        {ribbonTab === "layout" && (
          <>
            {showRibbonGroup("layout.page") && (
            <RibbonGroup label="Página">
              <select
                value={layout.pageSize}
                aria-label="Tamaño de página"
                onChange={(event) => onLayoutChange({ ...layout, pageSize: event.target.value as "a4" | "letter" })}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
              >
                <option value="a4">A4</option>
                <option value="letter">Carta</option>
              </select>
              <select
                value={layout.orientation}
                aria-label="Orientación de página"
                onChange={(event) => onLayoutChange({ ...layout, orientation: event.target.value as "portrait" | "landscape" })}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
              >
                <option value="portrait">Vertical</option>
                <option value="landscape">Horizontal</option>
              </select>
              <select
                value={layout.margin}
                aria-label="Márgenes de página"
                onChange={(event) => {
                  const margin = Number(event.target.value)
                  onLayoutChange({
                    ...layout,
                    margin,
                    margins: {
                      ...layout.margins,
                      top: margin,
                      right: margin,
                      bottom: margin,
                      left: margin,
                    },
                  })
                }}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
              >
                <option value={48}>Márgenes estrechos</option>
                <option value={72}>Márgenes normales</option>
                <option value={96}>Márgenes amplios</option>
              </select>
              <select
                value={layout.columns}
                onChange={(event) =>
                  onLayoutChange({
                    ...layout,
                    columns: Number(event.target.value) as 1 | 2 | 3,
                  })
                }
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="Columnas"
              >
                <option value={1}>1 columna</option>
                <option value={2}>2 columnas</option>
                <option value={3}>3 columnas</option>
              </select>
              <select
                value={layout.lineNumbers.mode}
                onChange={(event) =>
                  onLayoutChange({
                    ...layout,
                    lineNumbers: {
                      ...layout.lineNumbers,
                      mode: event.target.value as DocumentLayoutSettings["lineNumbers"]["mode"],
                    },
                  })
                }
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="Numeración de líneas"
                title="Numeración de líneas"
              >
                <option value="none">Líneas: ninguna</option>
                <option value="continuous">Líneas: continuas</option>
                <option value="newPage">Líneas: por página</option>
                <option value="newSection">Líneas: por sección</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => onOpenLayout("page")}>
                Configurar sección…
              </Button>
            </RibbonGroup>
            )}
            <Separator orientation="vertical" className="h-auto" />
            {showRibbonGroup("layout.zoom") && (
            <RibbonGroup label="Zoom">
              <select
                value={layout.zoom}
                aria-label="Zoom del documento"
                onChange={(event) => onLayoutChange({ ...layout, zoom: Number(event.target.value) })}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
              >
                <option value={0.75}>75 %</option>
                <option value={1}>100 %</option>
                <option value={1.25}>125 %</option>
                <option value={1.5}>150 %</option>
              </select>
              <ToolbarButton
                label="Mostrar marcas de formato"
                active={layout.showFormattingMarks}
                onClick={() =>
                  onLayoutChange({
                    ...layout,
                    showFormattingMarks: !layout.showFormattingMarks,
                  })
                }
              >
                <Pilcrow />
              </ToolbarButton>
            </RibbonGroup>
            )}
          </>
        )}

        {ribbonTab === "mailings" && (
          <>
            {showRibbonGroup("mailings.merge") && (
              <RibbonGroup label="Combinar correspondencia">
                <Button
                  type="button"
                  size="sm"
                  onClick={onOpenMailMerge}
                >
                  <Mail />
                  Iniciar combinación
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onOpenMailMerge}
                >
                  Campos y vista previa
                </Button>
              </RibbonGroup>
            )}
          </>
        )}

        {ribbonTab === "references" && (
          <>
            {showRibbonGroup("references.citations") && (
            <RibbonGroup label="Citas y bibliografía">
              <Button size="sm" onClick={onOpenReferences}><BookOpen />Fuentes y Zotero</Button>
              <Button size="sm" variant="outline" onClick={onOpenReferences}><Quote />Insertar cita</Button>
            </RibbonGroup>
            )}
            <Separator orientation="vertical" className="h-auto" />
            {showRibbonGroup("references.academic") && (
            <RibbonGroup label="Documento académico">
              <Button size="sm" variant="outline" onClick={onOpenFootnotes}><StickyNote />Notas</Button>
              <Button size="sm" variant="outline" onClick={onInsertTableOfContents}><ListTree />Insertar índice</Button>
              <Button size="sm" variant="outline" onClick={() => onOpenDocumentTools("academic")}><Wrench />Rótulos y ecuaciones</Button>
            </RibbonGroup>
            )}
          </>
        )}

        {ribbonTab === "review" && (
          <>
            {showRibbonGroup("review.versions") && (
            <RibbonGroup label="Versiones">
              <Button size="sm" variant="outline" onClick={onOpenVersions}><Save />Historial local</Button>
            </RibbonGroup>
            )}
            <Separator orientation="vertical" className="h-auto" />
            {showRibbonGroup("review.review") && (
            <RibbonGroup label="Revisión">
              <Button
                size="sm"
                variant={trackChanges ? "default" : "outline"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={openReviewPanel}
              >
                <Pilcrow />
                {trackChanges ? "Registrando cambios" : "Control de cambios"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onMouseDown={(event) => event.preventDefault()}
                onClick={openReviewPanel}
              >
                <StickyNote />
                Comentarios
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAiAction("summarize")}>Revisar estructura</Button>
              <Button size="sm" variant="outline" disabled={!hasSelection} onClick={() => onAiAction("rewrite")}>Corregir selección</Button>
              <Button size="sm" variant="outline" onClick={onOpenWritingTools}><BookOpenText />Sinónimos y corrección</Button>
              <Button size="sm" variant="outline" onClick={() => onOpenDocumentTools("compare")}><Wrench />Buscar, comparar y revisar</Button>
            </RibbonGroup>
            )}
            {showRibbonGroup("review.accessibility") && (
            <RibbonGroup label="Accesibilidad">
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenAccessibility}
              >
                <ShieldCheck />
                Comprobar
              </Button>
            </RibbonGroup>
            )}
          </>
        )}

        {ribbonTab === "view" && (
          <>
            {showRibbonGroup("view.show") && (
            <RibbonGroup label="Mostrar">
              <ToolbarButton
                label="Mostrar regla"
                active={layout.showRuler}
                onClick={() =>
                  onLayoutChange({ ...layout, showRuler: !layout.showRuler })
                }
              >
                <Ruler />
              </ToolbarButton>
              <ToolbarButton
                label="Mostrar marcas de formato"
                active={layout.showFormattingMarks}
                onClick={() =>
                  onLayoutChange({
                    ...layout,
                    showFormattingMarks: !layout.showFormattingMarks,
                  })
                }
              >
                <Pilcrow />
              </ToolbarButton>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenDocumentTools("navigate")}
              >
                <ListTree />
                Navegación
              </Button>
            </RibbonGroup>
            )}
            {showRibbonGroup("view.zoom") && (
            <RibbonGroup label="Zoom">
              <ToolbarButton
                label="Alejar"
                disabled={layout.zoom <= 0.5}
                onClick={() => setZoom(layout.zoom - 0.1)}
              >
                <ZoomOut />
              </ToolbarButton>
              <select
                value={layout.zoom}
                aria-label="Zoom del documento"
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
              >
                <option value={0.5}>50 %</option>
                <option value={0.75}>75 %</option>
                <option value={1}>100 %</option>
                <option value={1.25}>125 %</option>
                <option value={1.5}>150 %</option>
                <option value={2}>200 %</option>
              </select>
              <ToolbarButton
                label="Acercar"
                disabled={layout.zoom >= 2}
                onClick={() => setZoom(layout.zoom + 0.1)}
              >
                <ZoomIn />
              </ToolbarButton>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setZoom(1)}
              >
                100 %
              </Button>
            </RibbonGroup>
            )}
            {showRibbonGroup("view.immersive") && (
            <RibbonGroup label="Inmersión">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onOpenImmersiveReader}
                title="Abre una vista de lectura local con foco y voz del sistema"
              >
                <BookOpenText />
                Lector inmersivo
              </Button>
              <Button
                type="button"
                size="sm"
                variant={focusMode ? "default" : "outline"}
                onClick={onToggleFocusMode}
                title="Oculta la interfaz y deja solo el documento (Esc para salir)"
              >
                <Focus />
                Modo Enfoque
              </Button>
            </RibbonGroup>
            )}
          </>
        )}

        {ribbonTab === "ai" && (
          showRibbonGroup("ai.assistant") && (
          <RibbonGroup label="Asistente IA">
            <Button size="sm" onClick={onAiOpen}><Sparkles />Asistente</Button>
            <Button size="sm" variant="ghost" className={cn("text-primary", !hasSelection && "opacity-50")} onClick={() => onAiAction("rewrite")} disabled={!hasSelection}><WandSparkles />Reescribir</Button>
            <Button size="sm" variant="ghost" className="text-primary" onClick={() => onAiAction("continue")}><ArrowRightToLine />Continuar</Button>
          </RibbonGroup>
          )
        )}

        {ribbonTab === "image" && imageSelected && (
          <>
            <RibbonGroup label="Formato de imagen">
              <ImageOptionsPopover editor={editor} />
              <ImageEditPopover editor={editor} />
              <Button
                size="sm"
                variant={imageAttributes.align === "left" ? "default" : "outline"}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("image", { align: "left" })
                    .run()
                }
              >
                <AlignLeft />
                Izquierda
              </Button>
              <Button
                size="sm"
                variant={
                  !imageAttributes.align || imageAttributes.align === "center"
                    ? "default"
                    : "outline"
                }
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("image", { align: "center" })
                    .run()
                }
              >
                <AlignCenter />
                Centro
              </Button>
              <Button
                size="sm"
                variant={imageAttributes.align === "right" ? "default" : "outline"}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("image", { align: "right" })
                    .run()
                }
              >
                <AlignRight />
                Derecha
              </Button>
            </RibbonGroup>
            <RibbonGroup label="Ajustar texto">
              <select
                value={imageAttributes.wrap ?? "none"}
                onChange={(event) => {
                  const wrap = event.target.value
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("image", {
                      wrap,
                      ...(wrap === "square-left" || wrap === "tight-left"
                        ? { align: "left" }
                        : wrap === "square-right" || wrap === "tight-right"
                          ? { align: "right" }
                          : {}),
                    })
                    .run()
                }}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="Ajuste del texto de la imagen"
              >
                <option value="none">Arriba y abajo</option>
                <option value="square-left">Cuadrado · izquierda</option>
                <option value="square-right">Cuadrado · derecha</option>
                <option value="tight-left">Estrecho · izquierda</option>
                <option value="tight-right">Estrecho · derecha</option>
                <option value="behind">Detrás del texto</option>
                <option value="in-front">Delante del texto</option>
              </select>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => editor.chain().focus().deleteSelection().run()}
              >
                Eliminar imagen
              </Button>
            </RibbonGroup>
          </>
        )}

        {ribbonTab === "textBox" && textBoxSelected && (
          <>
            <RibbonGroup label="Estilos de forma">
              <div className="flex gap-1">
                {TEXT_BOX_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={`Aplicar estilo ${preset.label}`}
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .updateAttributes("textBox", {
                          background: preset.background,
                          borderColor: preset.borderColor,
                          borderStyle: preset.borderStyle,
                        })
                        .run()
                    }
                    className="flex h-12 w-16 flex-col justify-center gap-1 rounded border border-border bg-background px-1 hover:border-primary"
                  >
                    <span
                      className="block h-5 rounded"
                      style={{
                        background: preset.background,
                        border:
                          preset.borderStyle === "double"
                            ? `3px double ${preset.borderColor}`
                            : `1px ${preset.borderStyle} ${preset.borderColor}`,
                      }}
                    />
                    <span className="truncate text-[9px]">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </RibbonGroup>
            <RibbonGroup label="Tamaño">
              <label className="flex items-center gap-1 text-[10px]">
                Ancho
                <Input
                  type="number"
                  min={160}
                  max={720}
                  value={textBoxAttributes.width ?? 360}
                  onChange={(event) =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("textBox", {
                        width: Math.min(
                          720,
                          Math.max(160, Number(event.target.value) || 360)
                        ),
                      })
                      .run()
                  }
                  className="h-8 w-20"
                />
              </label>
              <label className="flex items-center gap-1 text-[10px]">
                Alto mín.
                <Input
                  type="number"
                  min={48}
                  max={600}
                  value={textBoxAttributes.minHeight ?? 96}
                  onChange={(event) =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("textBox", {
                        minHeight: Math.min(
                          600,
                          Math.max(48, Number(event.target.value) || 96)
                        ),
                      })
                      .run()
                  }
                  className="h-8 w-20"
                />
              </label>
            </RibbonGroup>
            <RibbonGroup label="Organizar">
              <select
                value={textBoxAttributes.boxPosition ?? "inline"}
                onChange={(event) =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("textBox", {
                      boxPosition: event.target.value,
                    })
                    .run()
                }
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="Ajuste del cuadro de texto"
              >
                <option value="inline">En línea</option>
                <option value="float-left">Flotante izquierda</option>
                <option value="float-right">Flotante derecha</option>
              </select>
              <select
                value={textBoxAttributes.align ?? "center"}
                onChange={(event) =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("textBox", {
                      align: event.target.value,
                    })
                    .run()
                }
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="Alineación del cuadro de texto"
              >
                <option value="left">Alinear izquierda</option>
                <option value="center">Centrar</option>
                <option value="right">Alinear derecha</option>
              </select>
            </RibbonGroup>
            <RibbonGroup label="Relleno y contorno">
              <label className="flex h-8 items-center gap-1 rounded border px-2 text-[10px]">
                Relleno
                <input
                  type="color"
                  value={textBoxAttributes.background ?? "#f8fafc"}
                  onChange={(event) =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("textBox", {
                        background: event.target.value,
                      })
                      .run()
                  }
                  className="h-5 w-6"
                  aria-label="Color de relleno"
                />
              </label>
              <label className="flex h-8 items-center gap-1 rounded border px-2 text-[10px]">
                Contorno
                <input
                  type="color"
                  value={textBoxAttributes.borderColor ?? "#94a3b8"}
                  onChange={(event) =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("textBox", {
                        borderColor: event.target.value,
                      })
                      .run()
                  }
                  className="h-5 w-6"
                  aria-label="Color del contorno"
                />
              </label>
              <select
                value={textBoxAttributes.borderStyle ?? "solid"}
                onChange={(event) =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("textBox", {
                      borderStyle: event.target.value,
                    })
                    .run()
                }
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="Estilo del contorno"
              >
                <option value="none">Sin contorno</option>
                <option value="solid">Sólido</option>
                <option value="dashed">Discontinuo</option>
                <option value="double">Doble</option>
              </select>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => deleteActiveTextBox(editor)}
              >
                Eliminar
              </Button>
            </RibbonGroup>
          </>
        )}

        {ribbonTab === "documentShape" && shapeSelected && (
          <>
            <RibbonGroup label="Tipo de forma">
              <div className="flex gap-1">
                {SHAPE_TYPES.map((shape) => {
                  const Icon = SHAPE_ICONS[shape.id]
                  return (
                    <button
                      key={shape.id}
                      type="button"
                      title={shape.label}
                      aria-label={shape.label}
                      aria-pressed={
                        (shapeAttributes.shapeType ?? "rectangle") === shape.id
                      }
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .updateAttributes("documentShape", {
                            shapeType: shape.id,
                          })
                          .run()
                      }
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded border",
                        (shapeAttributes.shapeType ?? "rectangle") === shape.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/60"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
            </RibbonGroup>
            <RibbonGroup label="Relleno y contorno">
              <label className="flex h-8 items-center gap-1 rounded border px-2 text-[10px]">
                Relleno
                <input
                  type="color"
                  value={shapeAttributes.fill ?? "#dbeafe"}
                  onChange={(event) =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("documentShape", {
                        fill: event.target.value,
                      })
                      .run()
                  }
                  className="h-5 w-6"
                  aria-label="Color de relleno"
                />
              </label>
              <label className="flex h-8 items-center gap-1 rounded border px-2 text-[10px]">
                Contorno
                <input
                  type="color"
                  value={shapeAttributes.borderColor ?? "#2563eb"}
                  onChange={(event) =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("documentShape", {
                        borderColor: event.target.value,
                      })
                      .run()
                  }
                  className="h-5 w-6"
                  aria-label="Color del contorno"
                />
              </label>
              <select
                value={shapeAttributes.borderStyle ?? "solid"}
                onChange={(event) =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("documentShape", {
                      borderStyle: event.target.value,
                    })
                    .run()
                }
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="Estilo del contorno"
              >
                <option value="none">Sin contorno</option>
                <option value="solid">Sólido</option>
                <option value="dashed">Discontinuo</option>
              </select>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => editor.chain().focus().deleteSelection().run()}
              >
                Eliminar
              </Button>
            </RibbonGroup>
            <RibbonGroup label="Tamaño">
              <label className="flex items-center gap-1 text-[10px]">
                Ancho
                <Input
                  type="number"
                  min={24}
                  max={720}
                  value={shapeAttributes.width ?? 160}
                  onChange={(event) =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("documentShape", {
                        width: Math.min(720, Math.max(24, Number(event.target.value) || 160)),
                      })
                      .run()
                  }
                  className="h-8 w-20"
                />
              </label>
              <label className="flex items-center gap-1 text-[10px]">
                Alto
                <Input
                  type="number"
                  min={24}
                  max={600}
                  value={shapeAttributes.height ?? 100}
                  onChange={(event) =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("documentShape", {
                        height: Math.min(600, Math.max(24, Number(event.target.value) || 100)),
                      })
                      .run()
                  }
                  className="h-8 w-20"
                />
              </label>
              <select
                value={shapeAttributes.align ?? "center"}
                onChange={(event) =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("documentShape", {
                      align: event.target.value,
                    })
                    .run()
                }
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="Alineación de la forma"
              >
                <option value="left">Alinear izquierda</option>
                <option value="center">Centrar</option>
                <option value="right">Alinear derecha</option>
              </select>
            </RibbonGroup>
          </>
        )}

        {ribbonTab === "table" && tableSelected && (
          <>
            <RibbonGroup label="Estilos de tabla">
              <div className="flex gap-1">
                {TABLE_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    title={style.label}
                    aria-label={`Aplicar estilo ${style.label}`}
                    aria-pressed={
                      (tableAttributes.tableStyle ?? "grid") === style.id
                    }
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .updateAttributes("table", {
                          tableStyle: style.id,
                        })
                        .run()
                    }
                    className={cn(
                      "flex h-12 w-14 flex-col justify-center gap-1 rounded border px-1 transition",
                      (tableAttributes.tableStyle ?? "grid") === style.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/25"
                        : "border-border bg-background hover:border-primary/60"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-5 grid-cols-3 overflow-hidden rounded-[2px]",
                        style.id === "plain"
                          ? "gap-px bg-transparent"
                          : "gap-px bg-border",
                        style.id === "academic" &&
                          "border-y border-foreground bg-transparent"
                      )}
                      aria-hidden="true"
                    >
                      {Array.from({ length: 6 }, (_, index) => (
                        <span
                          key={index}
                          className={cn(
                            "bg-background",
                            style.id === "header" &&
                              index < 3 &&
                              "bg-primary/70",
                            style.id === "banded" &&
                              index >= 3 &&
                              "bg-muted",
                            style.id === "academic" &&
                              index < 3 &&
                              "border-b border-foreground"
                          )}
                        />
                      ))}
                    </span>
                    <span className="truncate text-[9px]">{style.label}</span>
                  </button>
                ))}
              </div>
            </RibbonGroup>
            <RibbonGroup label="Filas y columnas">
              <Button
                size="sm"
                variant="outline"
                disabled={!editor.can().addRowAfter()}
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                + Fila
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!editor.can().addColumnAfter()}
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                + Columna
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!editor.can().deleteRow()}
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                − Fila
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!editor.can().deleteColumn()}
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                − Columna
              </Button>
            </RibbonGroup>
            <RibbonGroup label="Combinar">
              <Button
                size="sm"
                variant="outline"
                disabled={!editor.can().mergeCells()}
                onClick={() => editor.chain().focus().mergeCells().run()}
              >
                Combinar celdas
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!editor.can().splitCell()}
                onClick={() => editor.chain().focus().splitCell().run()}
              >
                Dividir celda
              </Button>
            </RibbonGroup>
            <RibbonGroup label="Opciones de tabla">
              <Button
                size="sm"
                variant={tableAttributes.repeatHeader ? "default" : "outline"}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("table", {
                      repeatHeader: !tableAttributes.repeatHeader,
                    })
                    .run()
                }
              >
                Repetir cabecera
              </Button>
              <Button
                size="sm"
                variant={
                  tableAttributes.allowRowBreak === false
                    ? "default"
                    : "outline"
                }
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("table", {
                      allowRowBreak: tableAttributes.allowRowBreak === false,
                    })
                    .run()
                }
              >
                Mantener filas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenDocumentTools("academic")}
              >
                Ordenar y fórmula
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onInsertChartFromTable("bar")}
                title="Crea un gráfico con los datos de esta tabla"
              >
                <BarChart3 />
                Gráfico
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                Eliminar tabla
              </Button>
            </RibbonGroup>
          </>
        )}
      </div>
      )}
    </div>
  )
})
