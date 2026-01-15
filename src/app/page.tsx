'use client'

import EditorTexto from '@/components/editor/EditorTexto';
import { useSidebarStore } from '@/store/useSidebarStore';
import { Juappy } from '@/components/Juappy';

export default function Home() {
  const { activeDefinition } = useSidebarStore();

  return (
    <main className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 print:block print:bg-white">
      {/* Main Content (Editor) */}
      <div className="flex-1 flex justify-center p-4 md:p-8 overflow-y-auto print:overflow-visible print:p-0 print:block print:h-auto">
        <EditorTexto />
      </div>

      {/* Right Sidebar */}
      <aside className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden xl:block print:hidden p-6 h-screen sticky top-0 overflow-y-auto transition-all duration-300">
        <h2 className="font-sans font-bold text-zinc-800 dark:text-zinc-100 mb-4 text-sm uppercase tracking-wider">Asistente Sociológico</h2>

        {activeDefinition ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                    <h3 className="font-serif font-bold text-xl text-indigo-900 dark:text-indigo-100 mb-2 capitalize">
                        {activeDefinition.term}
                    </h3>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed italic mb-3">
                        "{activeDefinition.definition}"
                    </p>
                    {activeDefinition.source && (
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold text-right">
                            — {activeDefinition.source}
                        </div>
                    )}
                </div>
                <div className="text-xs text-zinc-400 text-center">
                    Definición cargada del Diccionario Sociológico
                </div>
            </div>
        ) : (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Bienvenido a <strong>SocioFlow</strong>.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-zinc-500 list-disc pl-4">
                    <li>Selecciona texto para <strong>formalizar</strong>.</li>
                    <li>Usa el icono <span className="inline-block align-middle bg-zinc-200 rounded-full w-4 h-4"></span> para <strong>conectores</strong>.</li>
                    <li>Selecciona conceptos clave (ej: <em>anomia, habitus</em>) para ver su definición aquí.</li>
                </ul>
            </div>
        )}
      </aside>

      <Juappy />
    </main>
  );
}
