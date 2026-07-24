"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

interface EditorToolbarProps {
  editor: Editor | null
}

const TEXT_COLORS = ["#0f172a", "#dc2626", "#d97706", "#16a34a", "#2563eb", "#7c3aed", "#db2777"]
const HIGHLIGHT_COLORS = ["#fff3a3", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"]

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

function ImageButton({ editor }: { editor: Editor }) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      img.onload = () => {
        editor.chain().focus().setImage({ src, width: img.naturalWidth, height: img.naturalHeight }).run()
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
        accept="image/*"
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

function TableButton({ editor }: { editor: Editor }) {
  return (
    <Toggle
      size="sm"
      aria-label="Insertar tabla"
      title="Insertar tabla"
      onPressedChange={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
    >
      <TableIcon />
    </Toggle>
  )
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [, forceRerender] = React.useReducer((c) => c + 1, 0)

  React.useEffect(() => {
    if (!editor) return
    const update = () => forceRerender()
    editor.on("selectionUpdate", update)
    editor.on("transaction", update)
    return () => {
      editor.off("selectionUpdate", update)
      editor.off("transaction", update)
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-3 py-1.5">
      <ToolbarButton label="Deshacer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton label="Rehacer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton label="Negrita" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </ToolbarButton>
      <ToolbarButton label="Cursiva" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Subrayado"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon />
      </ToolbarButton>
      <ToolbarButton label="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough />
      </ToolbarButton>
      <ToolbarButton label="Código" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton
        label="Párrafo"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow />
      </ToolbarButton>
      <ToolbarButton
        label="Título 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 />
      </ToolbarButton>
      <ToolbarButton
        label="Título 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton
        label="Título 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton
        label="Lista con viñetas"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Cita"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote />
      </ToolbarButton>
      <ToolbarButton label="Línea horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton
        label="Alinear a la izquierda"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft />
      </ToolbarButton>
      <ToolbarButton
        label="Centrar"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter />
      </ToolbarButton>
      <ToolbarButton
        label="Alinear a la derecha"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight />
      </ToolbarButton>
      <ToolbarButton
        label="Justificar"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <AlignJustify />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <LinkPopover editor={editor} />
      <ColorPopover
        icon={<Palette />}
        label="Color de texto"
        colors={TEXT_COLORS}
        isActive={editor.isActive("textStyle")}
        apply={(color) => editor.chain().focus().setColor(color).run()}
        clear={() => editor.chain().focus().unsetColor().run()}
      />
      <ColorPopover
        icon={<Highlighter />}
        label="Resaltado"
        colors={HIGHLIGHT_COLORS}
        isActive={editor.isActive("highlight")}
        apply={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
        clear={() => editor.chain().focus().unsetHighlight().run()}
      />
      <TableButton editor={editor} />
      <ImageButton editor={editor} />
    </div>
  )
}
