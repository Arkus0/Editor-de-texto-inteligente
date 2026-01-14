import EditorTexto from '@/components/editor/EditorTexto';

export default function Home() {
  return (
    <main className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Main Content (Editor) */}
      <div className="flex-1 flex justify-center p-4 md:p-8 overflow-y-auto">
        <EditorTexto />
      </div>

      {/* Right Sidebar (Collapsible placeholder) */}
      <aside className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden xl:block p-6 h-screen sticky top-0 overflow-y-auto">
        <h2 className="font-sans font-bold text-zinc-800 dark:text-zinc-100 mb-4 text-sm uppercase tracking-wider">Asistente Sociológico</h2>
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
          <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
            Bienvenido a <strong>SocioFlow</strong>. Selecciona texto para ver opciones de formalización académica, o usa los conectores sugeridos al empezar un párrafo.
          </p>
        </div>
      </aside>
    </main>
  );
}
