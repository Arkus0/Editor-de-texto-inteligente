'use client'

import { type Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Subscript as SubIcon,
  Superscript as SupIcon,
  CheckSquare,
  Undo,
  Redo,
  RemoveFormatting,
  Link as LinkIcon,
  Image as ImageIcon,
  Type,
  Palette,
  Keyboard
} from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  if (!editor) return null

  const setLink = () => {
    if (linkUrl) {
        // If it doesn't start with http/https, maybe add it, but for now let's trust user or simple validation
        const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        setLinkUrl('')
        toast.success('Enlace añadido')
    }
  }

  const addImage = () => {
    if (imageUrl) {
        editor.chain().focus().setImage({ src: imageUrl }).run()
        setImageUrl('')
        toast.success('Imagen añadida')
    }
  }

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10 flex flex-wrap items-center gap-1 p-2">

      {/* History */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
          title="Deshacer"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
          title="Rehacer"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Insert */}
      <div className="flex items-center gap-0.5">
         <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className={editor.isActive('link') ? 'bg-zinc-100' : ''} title="Enlace">
                    <LinkIcon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
                <div className="flex gap-2">
                    <input
                        className="flex-1 px-2 py-1 text-sm border rounded"
                        placeholder="https://google.com"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && setLink()}
                    />
                    <Button size="sm" onClick={setLink}>OK</Button>
                </div>
                {editor.isActive('link') && (
                     <Button
                        size="sm"
                        variant="destructive"
                        className="w-full mt-2 h-6 text-xs"
                        onClick={() => editor.chain().focus().unsetLink().run()}
                     >
                        Quitar enlace
                     </Button>
                )}
            </PopoverContent>
         </Popover>

         <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" title="Imagen">
                    <ImageIcon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
                 <div className="space-y-2">
                    <p className="text-xs text-zinc-500 font-medium uppercase">URL de la imagen</p>
                    <div className="flex gap-2">
                        <input
                            className="flex-1 px-2 py-1 text-sm border rounded"
                            placeholder="https://..."
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addImage()}
                        />
                        <Button size="sm" onClick={addImage}>Añadir</Button>
                    </div>
                 </div>
            </PopoverContent>
         </Popover>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Font & Color */}
      <div className="flex items-center gap-0.5">
         <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" title="Fuente">
                    <Type className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1">
                <div className="grid gap-1">
                    <button onClick={() => editor.chain().focus().setFontFamily('Inter').run()} className="text-left px-2 py-1 text-sm hover:bg-zinc-100 rounded font-sans">Sans Serif</button>
                    <button onClick={() => editor.chain().focus().setFontFamily('Merriweather').run()} className="text-left px-2 py-1 text-sm hover:bg-zinc-100 rounded font-serif">Serif</button>
                    <button onClick={() => editor.chain().focus().setFontFamily('monospace').run()} className="text-left px-2 py-1 text-sm hover:bg-zinc-100 rounded font-mono">Monospace</button>
                </div>
            </PopoverContent>
         </Popover>

         <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" title="Color">
                    <Palette className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
                <div className="flex gap-1">
                    {['#000000', '#4338ca', '#ef4444', '#10b981', '#f59e0b', '#6b7280'].map(color => (
                        <button
                            key={color}
                            onClick={() => editor.chain().focus().setColor(color).run()}
                            className="w-6 h-6 rounded-full border border-zinc-200"
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                </div>
            </PopoverContent>
         </Popover>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Text Style */}
      <div className="flex items-center gap-0.5">
        <Toggle
          size="sm"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Toggle bold"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Toggle italic"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Toggle underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('strike')}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Toggle strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('highlight')}
          onPressedChange={() => editor.chain().focus().toggleHighlight().run()}
          aria-label="Toggle highlight"
        >
          <Highlighter className="h-4 w-4" />
        </Toggle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          className="h-8 w-8 p-0"
          title="Borrar formato"
        >
          <RemoveFormatting className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Script */}
      <div className="flex items-center gap-0.5">
         <Toggle
          size="sm"
          pressed={editor.isActive('superscript')}
          onPressedChange={() => editor.chain().focus().toggleSuperscript().run()}
          aria-label="Toggle superscript"
        >
          <SupIcon className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('subscript')}
          onPressedChange={() => editor.chain().focus().toggleSubscript().run()}
          aria-label="Toggle subscript"
        >
          <SubIcon className="h-4 w-4" />
        </Toggle>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Alignment */}
      <div className="flex items-center gap-0.5">
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: 'left' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
          aria-label="Align left"
        >
          <AlignLeft className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: 'center' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
          aria-label="Align center"
        >
          <AlignCenter className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: 'right' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
          aria-label="Align right"
        >
          <AlignRight className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: 'justify' })}
          onPressedChange={() => editor.chain().focus().setTextAlign('justify').run()}
          aria-label="Align justify"
        >
          <AlignJustify className="h-4 w-4" />
        </Toggle>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings */}
      <div className="flex items-center gap-0.5">
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Toggle>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists & Block */}
      <div className="flex items-center gap-0.5">
        <Toggle
          size="sm"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('taskList')}
          onPressedChange={() => editor.chain().focus().toggleTaskList().run()}
          aria-label="Task list"
        >
          <CheckSquare className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('blockquote')}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </Toggle>
      </div>

      <div className="ml-auto">
        <Dialog>
             <DialogTrigger asChild>
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" title="Atajos de teclado">
                     <Keyboard className="h-4 w-4" />
                 </Button>
             </DialogTrigger>
             <DialogContent>
                 <DialogHeader>
                     <DialogTitle>Atajos de Teclado</DialogTitle>
                     <DialogDescription>
                         Mejora tu velocidad con estos atajos comunes.
                     </DialogDescription>
                 </DialogHeader>
                 <div className="grid grid-cols-2 gap-4 py-4">
                     <div className="space-y-2">
                         <div className="flex justify-between text-sm border-b pb-1"><span>Negrita</span> <kbd className="bg-zinc-100 px-1 rounded">Ctrl+B</kbd></div>
                         <div className="flex justify-between text-sm border-b pb-1"><span>Cursiva</span> <kbd className="bg-zinc-100 px-1 rounded">Ctrl+I</kbd></div>
                         <div className="flex justify-between text-sm border-b pb-1"><span>Subrayado</span> <kbd className="bg-zinc-100 px-1 rounded">Ctrl+U</kbd></div>
                         <div className="flex justify-between text-sm border-b pb-1"><span>Tachado</span> <kbd className="bg-zinc-100 px-1 rounded">Ctrl+Shift+X</kbd></div>
                     </div>
                     <div className="space-y-2">
                         <div className="flex justify-between text-sm border-b pb-1"><span>Deshacer</span> <kbd className="bg-zinc-100 px-1 rounded">Ctrl+Z</kbd></div>
                         <div className="flex justify-between text-sm border-b pb-1"><span>Rehacer</span> <kbd className="bg-zinc-100 px-1 rounded">Ctrl+Y</kbd></div>
                         <div className="flex justify-between text-sm border-b pb-1"><span>Enlace</span> <kbd className="bg-zinc-100 px-1 rounded">No def.</kbd></div>
                         <div className="flex justify-between text-sm border-b pb-1"><span>H1</span> <kbd className="bg-zinc-100 px-1 rounded">Ctrl+Alt+1</kbd></div>
                     </div>
                 </div>
             </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
