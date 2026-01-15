'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Color from '@tiptap/extension-color'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Wand2, Repeat, Loader2, GraduationCap, BookOpen, PenTool, Search, Link as LinkIcon, ArrowRight, Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { stopwords } from '@/lib/stopwords'
import { useSidebarStore } from '@/store/useSidebarStore'
import { sociDictionary } from '@/lib/dictionary'
import { EditorToolbar } from './EditorToolbar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

type Repetition = { word: string; count: number }

type Evaluation = {
    nota: number;
    comentario_general: string;
    puntos_fuertes: string[];
    puntos_mejora: string[];
    analisis_critico: string;
}

export default function EditorTexto() {
  const { setDefinition } = useSidebarStore();

  // Formalizer State
  const [isLoading, setIsLoading] = useState(false)
  const [options, setOptions] = useState<{ academica: string; universitario: string; escritor: string } | null>(null)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  // Repetition State
  const [isRepetitionOpen, setIsRepetitionOpen] = useState(false)
  const [repetitions, setRepetitions] = useState<Repetition[]>([])
  const [selectedRepetition, setSelectedRepetition] = useState<string | null>(null)
  const [synonyms, setSynonyms] = useState<string[]>([])
  const [isLoadingSynonyms, setIsLoadingSynonyms] = useState(false)
  const [analysisRange, setAnalysisRange] = useState<{ from: number; to: number } | null>(null)

  // Connector State
  const [isConnectorOpen, setIsConnectorOpen] = useState(false)
  const [connectors, setConnectors] = useState<string[]>([])
  const [isLoadingConnectors, setIsLoadingConnectors] = useState(false)

  // Evaluation State
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
            keepMarks: true,
            keepAttributes: false,
        },
        orderedList: {
            keepMarks: true,
            keepAttributes: false,
        },
        // We use our own Underline extension configuration if needed,
        // but StarterKit already includes it. Let's make sure it's enabled.
        underline: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Escribe tu texto sociológico aquí...',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image,
      TextStyle,
      FontFamily,
      Color,
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)] font-serif px-8 py-4',
      },
    },
    content: '<p>La sociedad moderna se caracteriza por...</p>',
    immediatelyRender: false,
    onCreate: ({ editor }) => {
        // Persistence: Load
        const saved = localStorage.getItem('socioflow-content')
        if (saved) {
            editor.commands.setContent(saved)
        }
    },
    onUpdate: ({ editor }) => {
        // Persistence: Save
        localStorage.setItem('socioflow-content', editor.getHTML())
    },
    onSelectionUpdate: ({ editor }) => {
        const { from, to, empty } = editor.state.selection;
        if (empty) return;

        // Optimization: Skip large selections to avoid performance hit on dictionary lookup
        if (to - from > 50) {
           if (to - from > 100) return; // Definitely not a word
           // Check if it contains spaces (multi-word)
           const slice = editor.state.doc.textBetween(from, to);
           if (slice.includes(' ')) return;
        }

        const text = editor.state.doc.textBetween(from, to).trim().toLowerCase();
        // Check for exact match or match inside the dictionary keys
        // Simple exact match first
        const definition = sociDictionary[text];

        if (definition) {
            setDefinition({ term: text, ...definition });
        } else {
            // Optional: clear if clicking away, but usually users want it to stay until they select something else
            // setDefinition(null);
            // Better behavior: clear only if selection is empty or not a word.
            // For now, let's keep it sticky unless we explicitly want to clear.
            // Actually, "onSelectionUpdate" runs a lot. If I select something that ISN'T a term, should I clear?
            // Yes, probably, to show the "welcome" state again.
            // Only clear if the selection length is reasonable for a word, or just clear always if not found.
            if (text.length < 50) setDefinition(null);
        }
    }
  })

  const handleExport = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'socioflow-documento.html';
    a.click();
    toast.success("Documento descargado");
  }

  const handleEvaluate = async () => {
    if (!editor) return;
    const text = editor.getText();

    if (text.length < 50) {
        toast.warning("El texto es muy corto para evaluar.");
        return;
    }

    setIsEvaluationOpen(true);
    setIsEvaluating(true);
    setEvaluation(null);

    try {
        const res = await fetch('/api/evaluar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        })

        if (!res.ok) {
             const err = await res.json();
             throw new Error(err.error || 'Error en la evaluación');
        }

        const data = await res.json();
        setEvaluation(data);

    } catch (error) {
        toast.error("No se pudo evaluar el texto", {
            description: error instanceof Error ? error.message : "Inténtalo de nuevo más tarde."
        });
        setIsEvaluationOpen(false); // Close if error
    } finally {
        setIsEvaluating(false);
    }
  }

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

      if (!res.ok) {
         if (res.status === 429) throw new Error('Demasiadas solicitudes. Espera un poco.')
         throw new Error('Error al conectar con el asistente.')
      }

      const data = await res.json()
      setOptions(data)
    } catch (error) {
      console.error(error)
      toast.error("No se pudo conectar con la IA", {
        description: error instanceof Error ? error.message : "Error desconocido",
        action: {
            label: "Probar Demo",
            onClick: () => {
                 setOptions({
                    academica: "En el contexto de la modernidad, la estructura social exhibe...",
                    universitario: "La sociedad actual muestra características definidas por...",
                    escritor: "Vivimos tiempos donde el tejido social se transforma en..."
                  })
            }
        }
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

  const handleAnalyzeRepetitions = () => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) return

    setAnalysisRange({ from, to }) // Store range for finding occurrences later

    const text = editor.state.doc.textBetween(from, to)
    const words = text.toLowerCase().match(/\b[\wáéíóúñ]+\b/g) || []
    const counts: Record<string, number> = {}

    words.forEach(word => {
        if (!stopwords.has(word) && word.length > 3) {
            counts[word] = (counts[word] || 0) + 1
        }
    })

    const sorted = Object.entries(counts)
        .map(([word, count]) => ({ word, count }))
        .filter(item => item.count > 1) // Only show repeated words
        .sort((a, b) => b.count - a.count)

    setRepetitions(sorted)
    setSynonyms([])
    setSelectedRepetition(null)
  }

  const handleFindRepetition = (word: string) => {
    if (!editor || !analysisRange) return

    let foundPos = -1
    const { from, to } = analysisRange

    editor.state.doc.nodesBetween(from, to, (node, pos) => {
        if (foundPos !== -1) return false
        if (node.isText && node.text) {
             const nodeStart = pos
             // Determine intersection
             const searchStart = Math.max(from, nodeStart)
             const searchEnd = Math.min(to, nodeStart + node.nodeSize)

             if (searchStart >= searchEnd) return

             const textSlice = node.text.slice(searchStart - nodeStart, searchEnd - nodeStart)
             // Find whole word to avoid partial matches inside other words if possible,
             // but 'indexOf' is simple. Ideally use regex but offsets are tricky.
             // We'll stick to simple index for now.
             const index = textSlice.toLowerCase().indexOf(word.toLowerCase())

             if (index !== -1) {
                 foundPos = searchStart + index
             }
        }
    })

    if (foundPos !== -1) {
        editor.chain().focus().setTextSelection({ from: foundPos, to: foundPos + word.length }).run()
    } else {
        toast.warning(`No se encontró "${word}" en el rango original.`)
    }
  }

  const handleFetchSynonyms = async (word: string) => {
    if (selectedRepetition === word) return

    // Select the word in the text so user sees it and can replace it
    handleFindRepetition(word)

    setSelectedRepetition(word)
    setIsLoadingSynonyms(true)
    setSynonyms([])

    try {
        const context = editor?.state.doc.textBetween(
            Math.max(0, editor.state.selection.from - 100),
            Math.min(editor.state.doc.content.size, editor.state.selection.to + 100)
        )

        const res = await fetch('/api/sinonimos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word, context })
        })

        if (!res.ok) throw new Error('Error al obtener sinónimos')

        const data = await res.json()
        setSynonyms(data.synonyms)
    } catch (error) {
        toast.error("Error obteniendo sinónimos")
        console.error(error)
        // Mock fallback
        setSynonyms(["término", "vocablo", "concepto", "expresión", "palabra"])
    } finally {
        setIsLoadingSynonyms(false)
    }
  }

  const handleReplaceSynonym = (syn: string) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;

      // Safety check: Don't replace if selection is too big (e.g. user selected whole paragraph again)
      if (to - from > syn.length + 20) {
          toast.warning("Selección demasiado larga. Selecciona solo la palabra a reemplazar.");
          return;
      }

      editor.chain().focus().insertContent(syn).run();
  }

  const handleFetchConnectors = async () => {
    setIsLoadingConnectors(true)
    setConnectors([])

    try {
        // Simple heuristic to get context
        const { $anchor } = editor!.state.selection

        // Previous Paragraph: Look backward from start of current block
        let previousParagraph = ""
        const currentBlockStart = $anchor.start()
        if (currentBlockStart > 0) {
             // Try to get text before
             previousParagraph = editor!.state.doc.textBetween(Math.max(0, currentBlockStart - 500), currentBlockStart, '\n')
        }

        const currentLine = "" // Empty since we are at start of line/paragraph usually with FloatingMenu

        const res = await fetch('/api/conectores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ previousParagraph, currentLine })
        })

         if (!res.ok) {
             if (res.status === 429) throw new Error('Demasiadas solicitudes.')
             throw new Error('Error al obtener conectores.')
         }

        const data = await res.json()
        setConnectors(data.connectors)

    } catch (error) {
        toast.error("Error obteniendo conectores")
        console.error(error)
        setConnectors(["Por lo tanto,", "En consecuencia,", "Sin embargo,"])
    } finally {
        setIsLoadingConnectors(false)
    }
  }

  if (!editor) return null

  return (
    <div className="w-full relative">
      {/* Floating Menu (Connectors) */}
      {editor && (
        <FloatingMenu
            editor={editor}
            className="flex items-center -ml-16"
        >
             <Popover open={isConnectorOpen} onOpenChange={(open) => { setIsConnectorOpen(open); if(open) handleFetchConnectors(); }}>
                <PopoverTrigger asChild>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Sugerir conectores"
                    >
                        <LinkIcon className="w-4 h-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 overflow-hidden shadow-lg ml-2" side="right" align="start">
                    <div className="bg-indigo-50 border-b border-indigo-100 p-2 text-xs font-medium text-indigo-700 uppercase tracking-wider">
                        Conectores Sugeridos
                    </div>
                    <div className="p-2 space-y-1">
                        {isLoadingConnectors ? (
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-full" />
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-6 w-full" />
                            </div>
                        ) : (
                            connectors.map((conn) => (
                                <button
                                    key={conn}
                                    onClick={() => {
                                        editor.chain().focus().insertContent(`${conn} `).run()
                                        setIsConnectorOpen(false)
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors flex items-center gap-2 group"
                                >
                                    <ArrowRight className="w-3 h-3 text-zinc-300 group-hover:text-indigo-500" />
                                    {conn}
                                </button>
                            ))
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </FloatingMenu>
      )}

      {/* Bubble Menu */}
      {editor && (
        <BubbleMenu
          editor={editor}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-lg p-1 flex gap-1 items-center z-50 max-w-[600px]"
        >
          {/* Formalizer Popover */}
          <Popover open={isPopoverOpen} onOpenChange={(open) => { setIsPopoverOpen(open); if(open) setIsRepetitionOpen(false); }}>
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
            <PopoverContent className="w-96 p-0 overflow-hidden shadow-2xl" align="start" side="bottom">
              <div className="bg-zinc-50 border-b border-zinc-100 p-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Sugerencias de Tono
              </div>
              <div className="flex flex-col max-h-[400px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 space-y-4">
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-24 bg-indigo-100" />
                        <Skeleton className="h-12 w-full" />
                     </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-24 bg-indigo-100" />
                        <Skeleton className="h-12 w-full" />
                     </div>
                  </div>
                ) : options ? (
                  <>
                    <button
                        onClick={() => applyOption(options.academica)}
                        className="text-left p-3 hover:bg-indigo-50 transition-colors border-b border-zinc-100 group focus:outline-none focus:bg-indigo-50"
                        autoFocus
                    >
                      <div className="flex items-center gap-2 mb-1 text-indigo-700 font-semibold text-xs uppercase tracking-wide">
                        <GraduationCap className="w-3.5 h-3.5" /> Académica
                      </div>
                      <p className="text-sm text-zinc-700 group-hover:text-zinc-900 font-serif leading-relaxed">
                        {options.academica}
                      </p>
                    </button>
                    <button
                        onClick={() => applyOption(options.universitario)}
                        className="text-left p-3 hover:bg-indigo-50 transition-colors border-b border-zinc-100 group focus:outline-none focus:bg-indigo-50"
                    >
                      <div className="flex items-center gap-2 mb-1 text-indigo-700 font-semibold text-xs uppercase tracking-wide">
                        <BookOpen className="w-3.5 h-3.5" /> Universitario
                      </div>
                      <p className="text-sm text-zinc-700 group-hover:text-zinc-900 font-serif leading-relaxed">
                        {options.universitario}
                      </p>
                    </button>
                    <button
                        onClick={() => applyOption(options.escritor)}
                        className="text-left p-3 hover:bg-indigo-50 transition-colors group focus:outline-none focus:bg-indigo-50"
                    >
                      <div className="flex items-center gap-2 mb-1 text-indigo-700 font-semibold text-xs uppercase tracking-wide">
                        <PenTool className="w-3.5 h-3.5" /> Escritor
                      </div>
                      <p className="text-sm text-zinc-700 group-hover:text-zinc-900 font-serif leading-relaxed">
                        {options.escritor}
                      </p>
                    </button>
                  </>
                ) : (
                    <div className="p-4 text-center text-sm text-zinc-400">
                        Selecciona una opción para mejorar tu texto.
                    </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-4 bg-zinc-200 mx-1" />

          {/* Repetition Popover */}
          <Popover open={isRepetitionOpen} onOpenChange={(open) => { setIsRepetitionOpen(open); if(open) { setIsPopoverOpen(false); handleAnalyzeRepetitions(); } }}>
            <PopoverTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 gap-2 h-8 px-2"
                >
                    <Repeat className="w-3.5 h-3.5" />
                    Analizar Repeticiones
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden shadow-2xl" align="start" side="bottom">
                 <div className="bg-zinc-50 border-b border-zinc-100 p-2 text-xs font-medium text-zinc-500 uppercase tracking-wider flex justify-between items-center">
                    <span>Palabras Repetidas</span>
                    <span className="text-[10px] bg-zinc-200 px-1.5 py-0.5 rounded text-zinc-600">{repetitions.length} encontradas</span>
                 </div>
                 <div className="flex flex-col max-h-[300px] overflow-y-auto">
                    {repetitions.length === 0 ? (
                        <div className="p-8 text-center text-zinc-400 text-sm">
                            <p>No se encontraron repeticiones significativas.</p>
                        </div>
                    ) : (
                        repetitions.map((rep) => (
                            <div key={rep.word} className="border-b border-zinc-50 last:border-0">
                                <button
                                    onClick={() => handleFetchSynonyms(rep.word)}
                                    className="w-full text-left px-3 py-2 hover:bg-zinc-50 flex items-center justify-between group transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-zinc-700">{rep.word}</span>
                                        <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded-full font-bold">{rep.count}</span>
                                    </div>
                                    <Search className="w-3 h-3 text-zinc-300 group-hover:text-indigo-500 transition-colors" />
                                </button>
                                {selectedRepetition === rep.word && (
                                    <div className="bg-indigo-50/50 p-3 animate-in slide-in-from-top-1 duration-200">
                                        <p className="text-[10px] uppercase font-bold text-indigo-400 mb-2">Sinónimos Sugeridos</p>
                                        {isLoadingSynonyms ? (
                                            <div className="space-y-1">
                                                <Skeleton className="h-4 w-full bg-indigo-100" />
                                                <Skeleton className="h-4 w-2/3 bg-indigo-100" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {synonyms.map(syn => (
                                                    <button
                                                        key={syn}
                                                        onClick={() => handleReplaceSynonym(syn)}
                                                        className="text-xs bg-white border border-indigo-100 px-2 py-1 rounded-md text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        {syn}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                 </div>
            </PopoverContent>
          </Popover>
        </BubbleMenu>
      )}

      {/* Editor Content */}
      <div className="relative bg-white dark:bg-zinc-950 min-h-screen shadow-sm border-x border-zinc-100 dark:border-zinc-900 mx-auto max-w-4xl flex flex-col">
         {/* Toolbar */}
         <EditorToolbar editor={editor} />

        <div className="absolute top-2 right-4 print:hidden z-20 flex gap-2">
            <Dialog open={isEvaluationOpen} onOpenChange={setIsEvaluationOpen}>
                <DialogTrigger asChild>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEvaluate}
                        className="h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 font-medium"
                    >
                        <GraduationCap className="w-4 h-4 mr-2" />
                        Evaluar Trabajo
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-2xl text-indigo-900 flex items-center gap-2">
                            <GraduationCap className="w-6 h-6" />
                            Evaluación del Profesor
                        </DialogTitle>
                        <DialogDescription>
                            Análisis automático de estructura, tono y contenido sociológico.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 pr-4">
                        {isEvaluating ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                <p className="text-zinc-500 text-lg font-medium animate-pulse">Leyendo tu trabajo...</p>
                                <div className="space-y-2 w-full max-w-sm">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4 mx-auto" />
                                </div>
                            </div>
                        ) : evaluation ? (
                            <div className="space-y-6 py-4">
                                {/* Nota */}
                                <div className="flex items-center justify-between bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                                    <div className="text-zinc-600 font-medium">Calificación Global</div>
                                    <div className={`text-4xl font-bold font-serif ${evaluation.nota >= 7 ? 'text-green-600' : evaluation.nota >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {evaluation.nota}<span className="text-lg text-zinc-400 font-sans">/10</span>
                                    </div>
                                </div>

                                {/* Comentario General */}
                                <div className="space-y-2">
                                    <h4 className="font-bold text-zinc-800 flex items-center gap-2">
                                        <Search className="w-4 h-4 text-indigo-500" />
                                        Comentario General
                                    </h4>
                                    <p className="text-zinc-700 leading-relaxed bg-white p-3 rounded-md border border-zinc-100 shadow-sm text-sm">
                                        {evaluation.comentario_general}
                                    </p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Puntos Fuertes */}
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-green-700 text-sm uppercase tracking-wide flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            Puntos Fuertes
                                        </h4>
                                        <ul className="space-y-2">
                                            {evaluation.puntos_fuertes.map((pf, i) => (
                                                <li key={i} className="text-sm text-zinc-600 bg-green-50/50 p-2 rounded border border-green-100">
                                                    {pf}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Puntos Mejora */}
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-red-700 text-sm uppercase tracking-wide flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-500" />
                                            A Mejorar
                                        </h4>
                                        <ul className="space-y-2">
                                            {evaluation.puntos_mejora.map((pm, i) => (
                                                <li key={i} className="text-sm text-zinc-600 bg-red-50/50 p-2 rounded border border-red-100">
                                                    {pm}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                {/* Análisis Crítico */}
                                <div className="space-y-2">
                                    <h4 className="font-bold text-zinc-800 flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-indigo-500" />
                                        Análisis Crítico
                                    </h4>
                                    <p className="text-zinc-700 leading-relaxed bg-indigo-50/30 p-3 rounded-md border border-indigo-100 text-sm italic">
                                        "{evaluation.analisis_critico}"
                                    </p>
                                </div>
                            </div>
                        ) : null}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <Button size="icon" variant="ghost" onClick={handleExport} title="Exportar HTML">
                <Download className="w-4 h-4 text-zinc-400 hover:text-indigo-600" />
            </Button>
        </div>
        <div className="flex-1">
             <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
