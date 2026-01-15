'use client'

import { useState } from 'react';
import { useBibliographyStore, ReferenceType } from '@/store/useBibliographyStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from '@/components/ui/scroll-area';
import { Book, FileText, Globe, Plus, Trash2, Quote } from 'lucide-react';
import { Editor } from '@tiptap/react';

interface BibliographyManagerProps {
    editor: Editor | null;
}

export function BibliographyManager({ editor }: BibliographyManagerProps) {
    const { references, addReference, deleteReference } = useBibliographyStore();
    const [isOpen, setIsOpen] = useState(false);

    // Form State
    const [type, setType] = useState<ReferenceType>('book');
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [year, setYear] = useState('');
    const [source, setSource] = useState('');

    // DOI State
    const [doi, setDoi] = useState('');
    const [isLoadingDoi, setIsLoadingDoi] = useState(false);

    const handleDoiSearch = async () => {
        if (!doi) return;
        setIsLoadingDoi(true);
        try {
            // Clean DOI
            const cleanDoi = doi.replace('https://doi.org/', '').trim();
            const res = await fetch(`https://api.crossref.org/works/${cleanDoi}`);
            if (!res.ok) throw new Error('DOI no encontrado');

            const data = await res.json();
            const work = data.message;

            // Map to our fields
            setTitle(work.title ? work.title[0] : '');

            if (work.author) {
                const authors = work.author.map((a: any) => `${a.given} ${a.family}`).join(', ');
                setAuthor(authors);
            }

            if (work.created) {
                setYear(work.created['date-parts'][0][0].toString());
            }

            if (work['container-title']) {
                setSource(work['container-title'][0]);
            }

            // Infer type
            if (work.type === 'journal-article') setType('article');
            else if (work.type === 'book') setType('book');
            else setType('web');

        } catch (error) {
            console.error(error);
            alert("No se pudo obtener información de ese DOI.");
        } finally {
            setIsLoadingDoi(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !author || !year) return;

        addReference({ type, title, author, year, source });

        // Reset form
        setTitle('');
        setAuthor('');
        setYear('');
        setSource('');
    };

    const handleInsert = (author: string, year: string) => {
        if (editor) {
            // APA style mostly: (Author, Year)
            // Just extracting surname roughly
            const surname = author.split(',')[0].split(' ').pop() || author;
            editor.chain().focus().insertContent(` (${surname}, ${year}) `).run();
            setIsOpen(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" title="Gestor Bibliográfico">
                    <Book className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden">
                <div className="flex h-full">
                    {/* Left: List */}
                    <div className="w-1/2 border-r border-zinc-200 bg-zinc-50 flex flex-col">
                        <div className="p-4 border-b border-zinc-200 bg-white">
                            <h3 className="font-serif font-bold text-zinc-800 flex items-center gap-2">
                                <Book className="w-4 h-4 text-indigo-600" />
                                Mis Referencias
                            </h3>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            {references.length === 0 ? (
                                <div className="text-center text-zinc-400 text-sm mt-10">
                                    <p>No tienes referencias guardadas.</p>
                                    <p className="text-xs mt-2">Añade una a la derecha.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {references.map((ref) => (
                                        <div key={ref.id} className="bg-white p-3 rounded-md border border-zinc-200 shadow-sm hover:border-indigo-300 transition-colors group relative">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {ref.type === 'book' && <Book className="w-3 h-3 text-zinc-400" />}
                                                        {ref.type === 'article' && <FileText className="w-3 h-3 text-zinc-400" />}
                                                        {ref.type === 'web' && <Globe className="w-3 h-3 text-zinc-400" />}
                                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{ref.type}</span>
                                                    </div>
                                                    <h4 className="font-bold text-zinc-800 text-sm leading-tight">{ref.title}</h4>
                                                    <p className="text-xs text-zinc-600 mt-1">{ref.author} ({ref.year})</p>
                                                    {ref.source && <p className="text-[10px] text-zinc-400 italic mt-0.5">{ref.source}</p>}
                                                </div>
                                            </div>

                                            <div className="mt-3 flex gap-2 pt-2 border-t border-zinc-50">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-7 text-xs flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                                    onClick={() => handleInsert(ref.author, ref.year)}
                                                >
                                                    <Quote className="w-3 h-3 mr-1.5" /> Citar
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => deleteReference(ref.id)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Right: Add Form */}
                    <div className="w-1/2 p-6 flex flex-col bg-white">
                        <h3 className="font-bold text-zinc-800 mb-6 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Añadir Nueva Referencia
                        </h3>

                        {/* DOI Search */}
                        <div className="mb-6 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                             <Label className="text-xs uppercase text-zinc-500 mb-2 block">Autocompletar con DOI</Label>
                             <div className="flex gap-2">
                                 <Input
                                    placeholder="Ej: 10.1080/00380253..."
                                    value={doi}
                                    onChange={e => setDoi(e.target.value)}
                                    className="bg-white text-sm"
                                 />
                                 <Button onClick={handleDoiSearch} disabled={isLoadingDoi} variant="outline" className="shrink-0">
                                     {isLoadingDoi ? 'Buscando...' : 'Buscar'}
                                 </Button>
                             </div>
                        </div>

                        <Tabs value={type} onValueChange={(v) => setType(v as ReferenceType)} className="flex-1 flex flex-col">
                            <TabsList className="grid w-full grid-cols-3 mb-4">
                                <TabsTrigger value="book">Libro</TabsTrigger>
                                <TabsTrigger value="article">Artículo</TabsTrigger>
                                <TabsTrigger value="web">Web</TabsTrigger>
                            </TabsList>

                            <form onSubmit={handleSubmit} className="space-y-4 flex-1">
                                <div className="space-y-2">
                                    <Label htmlFor="title" className="text-xs uppercase text-zinc-500">Título</Label>
                                    <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: La Ética Protestante..." required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="author" className="text-xs uppercase text-zinc-500">Autor(es)</Label>
                                        <Input id="author" value={author} onChange={e => setAuthor(e.target.value)} placeholder="Ej: Max Weber" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="year" className="text-xs uppercase text-zinc-500">Año</Label>
                                        <Input id="year" value={year} onChange={e => setYear(e.target.value)} placeholder="Ej: 1905" required />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="source" className="text-xs uppercase text-zinc-500">
                                        {type === 'book' ? 'Editorial' : type === 'article' ? 'Revista / Journal' : 'URL'}
                                    </Label>
                                    <Input id="source" value={source} onChange={e => setSource(e.target.value)} placeholder="..." />
                                </div>

                                <div className="pt-4">
                                    <Button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800">Guardar Referencia</Button>
                                </div>
                            </form>
                        </Tabs>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
