'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Wand2, Repeat, Loader2, GraduationCap, BookOpen, PenTool } from 'lucide-react'
import { useState } from 'react'

export default function EditorTexto() {
  const [isLoading, setIsLoading] = useState(false)
  const [options, setOptions] = useState<{ academica: string; universitario: string; escritor: string } | null>(null)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Escribe tu texto sociológico aquí...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)] font-serif',
      },
    },
    content: '<p>La sociedad moderna se caracteriza por...</p>',
    immediatelyRender: false
  })

  const handleFormalize = async () => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return

    const text = editor.state.doc.textBetween(from, to)
    setIsLoading(true)
    setOptions(null)

    try {
      const res = await fetch('/api/formalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) throw new Error('Error al formalizar')

      const data = await res.json()
      setOptions(data)
    } catch (error) {
      console.error(error)
      // Mock data for demo if API fails (e.g. no key)
      setOptions({
        academica: "En el contexto de la modernidad, la estructura social exhibe...",
        universitario: "La sociedad actual muestra características definidas por...",
        escritor: "Vivimos tiempos donde el tejido social se transforma en..."
      })
    } finally {
      setIsLoading(false)
    }
  }

  const applyOption = (text: string) => {
    if (editor) {
      editor.chain().focus().insertContent(text).run()
      setIsPopoverOpen(false)
    }
  }

  if (!editor) return null

  return (
    <div className="w-full relative">
      {/* Bubble Menu */}
      {editor && (
        <BubbleMenu
          editor={editor}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-lg p-1 flex gap-1 items-center z-50 max-w-[500px]"
        >
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleFormalize}
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-2 h-8 px-2 font-medium"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Formalizar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0 overflow-hidden" align="start" side="bottom">
              <div className="bg-zinc-50 border-b border-zinc-100 p-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Sugerencias de Tono
              </div>
              <div className="flex flex-col max-h-[400px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-8 flex flex-col items-center gap-2 text-zinc-500 text-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span>Analizando texto...</span>
                  </div>
                ) : options ? (
                  <>
                    <button onClick={() => applyOption(options.academica)} className="text-left p-3 hover:bg-indigo-50 transition-colors border-b border-zinc-100 group">
                      <div className="flex items-center gap-2 mb-1 text-indigo-700 font-semibold text-xs uppercase tracking-wide">
                        <GraduationCap className="w-3.5 h-3.5" /> Académica
                      </div>
                      <p className="text-sm text-zinc-700 group-hover:text-zinc-900 font-serif leading-relaxed">
                        {options.academica}
                      </p>
                    </button>
                    <button onClick={() => applyOption(options.universitario)} className="text-left p-3 hover:bg-indigo-50 transition-colors border-b border-zinc-100 group">
                      <div className="flex items-center gap-2 mb-1 text-indigo-700 font-semibold text-xs uppercase tracking-wide">
                        <BookOpen className="w-3.5 h-3.5" /> Universitario
                      </div>
                      <p className="text-sm text-zinc-700 group-hover:text-zinc-900 font-serif leading-relaxed">
                        {options.universitario}
                      </p>
                    </button>
                    <button onClick={() => applyOption(options.escritor)} className="text-left p-3 hover:bg-indigo-50 transition-colors group">
                      <div className="flex items-center gap-2 mb-1 text-indigo-700 font-semibold text-xs uppercase tracking-wide">
                        <PenTool className="w-3.5 h-3.5" /> Escritor
                      </div>
                      <p className="text-sm text-zinc-700 group-hover:text-zinc-900 font-serif leading-relaxed">
                        {options.escritor}
                      </p>
                    </button>
                  </>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-4 bg-zinc-200 mx-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const text = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)
              const count = text.split(/\s+/).filter(w => w.length > 0).length
              alert(`Funcionalidad en desarrollo.\nPalabras seleccionadas: ${count}\nAquí se mostrarán las repeticiones léxicas.`)
            }}
            className="text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 gap-2 h-8 px-2"
          >
            <Repeat className="w-3.5 h-3.5" />
            Analizar Repeticiones
          </Button>
        </BubbleMenu>
      )}

      {/* Editor Content */}
      <div className="bg-white dark:bg-zinc-950 p-8 md:p-12 min-h-screen shadow-sm border-x border-zinc-100 dark:border-zinc-900 mx-auto max-w-3xl">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
