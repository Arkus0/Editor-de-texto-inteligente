import { useDocumentStore } from '@/store/useDocumentStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Save, Trash2, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

export function FileMenu() {
    const {
        documents,
        currentDocId,
        createDocument,
        openDocument,
        deleteDocument,
        updateDocument,
        getCurrentDocument
    } = useDocumentStore();

    const [isOpen, setIsOpen] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [tempTitle, setTempTitle] = useState('');

    const currentDoc = getCurrentDocument();

    const handleNew = () => {
        createDocument();
        setIsOpen(false);
        toast.success("Nuevo documento creado");
    };

    const handleOpen = (id: string) => {
        openDocument(id);
        setIsOpen(false);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('¿Estás seguro de querer eliminar este documento?')) {
            deleteDocument(id);
            toast.success("Documento eliminado");
        }
    };

    const startRenaming = () => {
        if (currentDoc) {
            setTempTitle(currentDoc.title);
            setIsRenaming(true);
        }
    };

    const saveTitle = () => {
        if (currentDoc && tempTitle.trim()) {
            updateDocument(currentDoc.id, { title: tempTitle });
            setIsRenaming(false);
            toast.success("Nombre guardado");
        }
    };

    // Sort by lastModified desc
    const recentDocs = [...documents].sort((a, b) => b.lastModified - a.lastModified).slice(0, 5);

    return (
        <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) setIsRenaming(false); }}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-zinc-200 text-zinc-700 h-8 font-normal bg-white/50 backdrop-blur-sm hover:bg-zinc-100">
                    <FolderOpen className="w-4 h-4 text-indigo-600" />
                    <span className="max-w-[150px] truncate">
                        {currentDoc ? currentDoc.title : "Mis Trabajos"}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                 {/* Header / Actions */}
                 <div className="p-2 border-b border-zinc-100 bg-zinc-50 flex gap-2">
                    <Button onClick={handleNew} size="sm" className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                        <Plus className="w-4 h-4" /> Nuevo Documento
                    </Button>
                 </div>

                 {/* Rename Current */}
                 {currentDoc && (
                     <div className="p-3 border-b border-zinc-100 bg-white">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2">Documento Actual</div>
                        {isRenaming ? (
                            <div className="flex gap-2 animate-in fade-in duration-200">
                                <Input
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    className="h-8 text-sm"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                                />
                                <Button size="sm" onClick={saveTitle}><Save className="w-3 h-3" /></Button>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center group">
                                <span className="font-medium text-zinc-800 truncate text-sm px-1 border border-transparent">{currentDoc.title}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 group-hover:opacity-100 hover:bg-zinc-100" onClick={startRenaming} title="Renombrar">
                                    <Save className="w-3 h-3 text-zinc-500" />
                                </Button>
                            </div>
                        )}
                     </div>
                 )}

                 {/* Recent List */}
                 <div className="p-2 bg-white">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2 px-2">Recientes</div>
                    {recentDocs.length === 0 ? (
                        <div className="text-center text-sm text-zinc-400 py-6 italic">No hay documentos guardados.</div>
                    ) : (
                        <div className="space-y-1">
                            {recentDocs.map(doc => (
                                <div
                                    key={doc.id}
                                    onClick={() => handleOpen(doc.id)}
                                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-sm group transition-all duration-200 ${doc.id === currentDocId ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-zinc-50 border border-transparent'}`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`p-1.5 rounded-full ${doc.id === currentDocId ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-400'}`}>
                                            <FileText className="w-3 h-3" />
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className={`truncate font-medium ${doc.id === currentDocId ? 'text-indigo-900' : 'text-zinc-700'}`}>{doc.title}</span>
                                            <span className="text-[10px] text-zinc-400">
                                                {new Date(doc.lastModified).toLocaleDateString()} {new Date(doc.lastModified).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                         {doc.id !== currentDocId && (
                                            <button
                                                onClick={(e) => handleDelete(e, doc.id)}
                                                className="p-1.5 text-zinc-300 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                         )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
            </PopoverContent>
        </Popover>
    );
}
