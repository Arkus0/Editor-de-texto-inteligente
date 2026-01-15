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
  Video,
  Type,
  Palette,
  Keyboard,
  Table as TableIcon,
  Search,
  Eye,
  FileText,
  Cloud,
  CloudOff,
  Loader2 as LoaderIcon
} from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FileMenu } from './FileMenu'
import { BibliographyManager } from '../bibliography/BibliographyManager'
import { AuthDialog } from '../auth/AuthDialog'
import { useDocumentStore } from '@/store/useDocumentStore'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)

  const { syncStatus, lastSyncTime } = useDocumentStore()

  if (!editor) return null

  // Update word and character count
  const updateCounts = () => {
    const text = editor.getText()
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length
    const chars = text.length
    setWordCount(words)
    setCharCount(chars)
  }

  // Update counts when editor content changes
  editor.on('update', updateCounts)

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

  const addVideo = () => {
    if (videoUrl) {
        editor.chain().focus().setYoutubeVideo({ src: videoUrl }).run()
        setVideoUrl('')
        toast.success('Video añadido')
    }
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    toast.success('Tabla insertada')
  }

  const handleSearch = () => {
    if (!searchTerm) return
    // Simple search: Find and select first occurrence
    const { doc } = editor.state
    const text = doc.textContent
    const index = text.toLowerCase().indexOf(searchTerm.toLowerCase())

    if (index !== -1) {
      // Find position in ProseMirror document
      let pos = 1 // Start position
      doc.descendants((node) => {
        if (node.isText && node.text) {
          const nodeText = node.text.toLowerCase()
          const localIndex = nodeText.indexOf(searchTerm.toLowerCase())
          if (localIndex !== -1 && pos + localIndex === index + 1) {
            editor.chain().focus().setTextSelection({
              from: pos + localIndex,
              to: pos + localIndex + searchTerm.length
            }).run()
            return false
          }
          pos += node.nodeSize
        }
        return true
      })
      toast.success(`Encontrado: "${searchTerm}"`)
    } else {
      toast.error('No se encontró el texto')
    }
  }

  const handleReplace = () => {
    if (!searchTerm || !replaceTerm) return
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to)

    if (selectedText.toLowerCase() === searchTerm.toLowerCase()) {
      editor.chain().focus().insertContent(replaceTerm).run()
      toast.success('Texto reemplazado')
    } else {
      toast.error('Primero busca el texto a reemplazar')
    }
  }

  const handleReplaceAll = () => {
    if (!searchTerm || !replaceTerm) return
    const html = editor.getHTML()
    const regex = new RegExp(searchTerm, 'gi')
    const newHtml = html.replace(regex, replaceTerm)
    editor.commands.setContent(newHtml)
    toast.success('Todos los textos reemplazados')
  }

  return (
    <div className={`border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10 flex flex-wrap items-center gap-1 p-2 print:hidden transition-opacity ${focusMode ? 'opacity-30 hover:opacity-100' : ''}`}>

      <FileMenu />

      <Separator orientation="vertical" className="h-6 mx-1" />

      <BibliographyManager editor={editor} />

      <Separator orientation="vertical" className="h-6 mx-1" />

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

         <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" title="Video de YouTube">
                    <Video className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
                 <div className="space-y-2">
                    <p className="text-xs text-zinc-500 font-medium uppercase">URL de YouTube</p>
                    <div className="flex gap-2">
                        <input
                            className="flex-1 px-2 py-1 text-sm border rounded"
                            placeholder="https://youtube.com/..."
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addVideo()}
                        />
                        <Button size="sm" onClick={addVideo}>Añadir</Button>
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

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Table Controls */}
      <div className="flex items-center gap-0.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" title="Insertar tabla">
              <TableIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="space-y-2">
              <Button size="sm" onClick={insertTable} className="w-full">
                Insertar tabla 3x3
              </Button>
              {editor.isActive('table') && (
                <>
                  <div className="grid grid-cols-2 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editor.chain().focus().addColumnBefore().run()}
                      className="text-xs"
                    >
                      + Col Izq
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editor.chain().focus().addColumnAfter().run()}
                      className="text-xs"
                    >
                      + Col Der
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editor.chain().focus().addRowBefore().run()}
                      className="text-xs"
                    >
                      + Fila Arriba
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editor.chain().focus().addRowAfter().run()}
                      className="text-xs"
                    >
                      + Fila Abajo
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => editor.chain().focus().deleteColumn().run()}
                      className="text-xs"
                    >
                      - Columna
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => editor.chain().focus().deleteRow().run()}
                      className="text-xs"
                    >
                      - Fila
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    className="w-full"
                  >
                    Eliminar tabla
                  </Button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Search & Replace */}
      <div className="flex items-center gap-0.5">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" title="Buscar y reemplazar" onClick={updateCounts}>
              <Search className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Buscar y Reemplazar</DialogTitle>
              <DialogDescription>
                Busca y reemplaza texto en el documento
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Buscar</label>
                <input
                  className="w-full px-3 py-2 text-sm border rounded mt-1"
                  placeholder="Texto a buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Reemplazar con</label>
                <input
                  className="w-full px-3 py-2 text-sm border rounded mt-1"
                  placeholder="Texto nuevo..."
                  value={replaceTerm}
                  onChange={(e) => setReplaceTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSearch} className="flex-1">
                  Buscar
                </Button>
                <Button onClick={handleReplace} variant="outline" className="flex-1">
                  Reemplazar
                </Button>
                <Button onClick={handleReplaceAll} variant="destructive" className="flex-1">
                  Reemplazar todo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Word Counter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" title="Estadísticas" onClick={updateCounts}>
              <FileText className="h-4 w-4 mr-1" />
              <span className="text-xs">{wordCount}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Palabras:</span>
                <span>{wordCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Caracteres:</span>
                <span>{charCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Sin espacios:</span>
                <span>{charCount - (editor.getText().match(/\s/g)?.length || 0)}</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Focus Mode */}
        <Toggle
          size="sm"
          pressed={focusMode}
          onPressedChange={setFocusMode}
          title="Modo enfoque"
        >
          <Eye className="h-4 w-4" />
        </Toggle>

        {/* Sync Status Indicator */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1 ${
                syncStatus === 'syncing' ? 'text-blue-600' :
                syncStatus === 'synced' ? 'text-green-600' :
                syncStatus === 'error' ? 'text-red-600' :
                'text-zinc-400'
              }`}
              title="Estado de sincronización"
            >
              {syncStatus === 'syncing' && <LoaderIcon className="h-4 w-4 animate-spin" />}
              {syncStatus === 'synced' && <Cloud className="h-4 w-4" />}
              {syncStatus === 'error' && <CloudOff className="h-4 w-4" />}
              {syncStatus === 'idle' && <Cloud className="h-4 w-4" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3">
            <div className="space-y-2">
              <div className="font-semibold text-sm">
                Estado de Sincronización
              </div>
              <div className="text-xs text-zinc-600">
                {syncStatus === 'syncing' && '🔄 Sincronizando con la nube...'}
                {syncStatus === 'synced' && '✅ Sincronizado'}
                {syncStatus === 'error' && '❌ Error de sincronización'}
                {syncStatus === 'idle' && 'ℹ️ Sin cambios pendientes'}
              </div>
              {lastSyncTime && syncStatus === 'synced' && (
                <div className="text-xs text-zinc-400">
                  Última sincronización: {new Date(lastSyncTime).toLocaleTimeString()}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <AuthDialog />
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
