'use client'

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, X } from 'lucide-react';
import { useDocumentStore } from '@/store/useDocumentStore';

export function Juappy() {
    const { documents, currentDocId } = useDocumentStore();
    const [isOpen, setIsOpen] = useState(false);

    const currentContent = currentDocId
        ? documents.find(d => d.id === currentDocId)?.content || ''
        : '';

    // Strip HTML for context
    const plainText = currentContent.replace(/<[^>]+>/g, ' ');

    const [input, setInput] = useState('');
    const { messages, status, sendMessage } = useChat({
        body: {
            context: plainText
        }
    });
    const isLoading = status === 'streaming' || status === 'submitted';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        sendMessage({ text: input });
        setInput('');
    };

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 print:hidden">
            {/* Chat Window */}
            {isOpen && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl w-80 h-[450px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 origin-bottom-right">
                    <div className="bg-indigo-600 p-3 flex justify-between items-center text-white shrink-0">
                        <div className="flex items-center gap-2">
                             <span className="font-bold font-serif tracking-wide text-sm">Juappy Assistant</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-indigo-700 rounded-full" onClick={() => setIsOpen(false)}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950/50" ref={scrollRef}>
                         {messages.length === 0 && (
                             <div className="flex flex-col items-center justify-center h-full text-center text-sm text-zinc-500 space-y-2">
                                 <div className="text-4xl animate-bounce">📎</div>
                                 <p className="font-medium text-zinc-700">¡Hola! Soy Juappy.</p>
                                 <p className="max-w-[200px] text-xs">Estoy aquí para ayudarte con tu ensayo, explicar conceptos o darte ideas.</p>
                             </div>
                         )}
                         {messages.map(m => (
                             <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                 <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                                     m.role === 'user'
                                     ? 'bg-indigo-600 text-white rounded-br-none'
                                     : 'bg-white border border-zinc-200 text-zinc-800 shadow-sm rounded-bl-none'
                                 }`}>
                                     {m.content}
                                 </div>
                             </div>
                         ))}
                         {isLoading && (
                             <div className="flex justify-start">
                                 <div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-none p-3 px-4 text-zinc-400 text-xs shadow-sm flex gap-1 items-center">
                                     <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                                     <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-100"></span>
                                     <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-200"></span>
                                 </div>
                             </div>
                         )}
                    </div>

                    <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-zinc-100 flex gap-2 shrink-0">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe aquí..."
                            className="text-sm focus-visible:ring-indigo-500 rounded-full px-4"
                        />
                        <Button type="submit" size="icon" disabled={isLoading || !input?.trim()} className="bg-indigo-600 hover:bg-indigo-700 shrink-0 rounded-full w-10 h-10">
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            )}

            {/* Avatar Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative group transition-all hover:-translate-y-1 focus:outline-none"
                title="Abrir a Juappy"
            >
                 <div className="w-16 h-16 relative filter drop-shadow-xl hover:drop-shadow-2xl transition-all">
                     <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                         <defs>
                             <filter id="glow">
                                 <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                 <feMerge>
                                     <feMergeNode in="coloredBlur"/>
                                     <feMergeNode in="SourceGraphic"/>
                                 </feMerge>
                             </filter>
                         </defs>

                         {/* Body */}
                         <path
                            d="M 35 65 L 35 30 A 15 15 0 0 1 65 30 L 65 75 A 10 10 0 0 1 45 75 L 45 40"
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="group-hover:stroke-indigo-500 transition-colors"
                         />

                         {/* Eyes Container - Moves with mouse? simpler: moves on hover */}
                         <g className="group-hover:translate-y-[-2px] transition-transform duration-300">
                             {/* Eyes */}
                             <circle cx="42" cy="35" r="4" fill="black" />
                             <circle cx="58" cy="35" r="4" fill="black" />
                             {/* Shine */}
                             <circle cx="43" cy="34" r="1.5" fill="white" />
                             <circle cx="59" cy="34" r="1.5" fill="white" />

                             {/* Eyebrows */}
                             <path d="M 38 28 Q 42 25 46 28" fill="none" stroke="black" strokeWidth="1.5" className="group-hover:-translate-y-1 transition-transform"/>
                             <path d="M 54 28 Q 58 25 62 28" fill="none" stroke="black" strokeWidth="1.5" className="group-hover:-translate-y-1 transition-transform"/>
                         </g>

                     </svg>

                     {/* Notification Badge */}
                     {!isOpen && (
                         <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce shadow-sm border border-white">
                             Hola!
                         </div>
                     )}
                 </div>
            </button>
        </div>
    );
}
