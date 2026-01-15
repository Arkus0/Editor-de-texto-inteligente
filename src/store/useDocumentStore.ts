import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Document = {
  id: string;
  title: string;
  content: string;
  lastModified: number;
};

type DocumentStore = {
  documents: Document[];
  currentDocId: string | null;

  createDocument: () => string; // Returns new doc ID
  openDocument: (id: string) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  deleteDocument: (id: string) => void;
  getCurrentDocument: () => Document | undefined;

  // Special action to check for old data
  checkLegacyData: () => void;
};

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set, get) => ({
      documents: [],
      currentDocId: null,

      createDocument: () => {
        const newDoc: Document = {
          id: crypto.randomUUID(),
          title: 'Nuevo Documento',
          content: '',
          lastModified: Date.now(),
        };
        set((state) => ({
          documents: [newDoc, ...state.documents],
          currentDocId: newDoc.id,
        }));
        return newDoc.id;
      },

      openDocument: (id) => {
        set({ currentDocId: id });
      },

      updateDocument: (id, updates) => {
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, ...updates, lastModified: Date.now() } : doc
          ),
        }));
      },

      deleteDocument: (id) => {
        set((state) => {
          const newDocs = state.documents.filter((doc) => doc.id !== id);
          // If we deleted the current doc, close it or open the first available
          let newCurrentId = state.currentDocId;
          if (state.currentDocId === id) {
             newCurrentId = newDocs.length > 0 ? newDocs[0].id : null;
          }
          return {
            documents: newDocs,
            currentDocId: newCurrentId,
          };
        });
      },

      getCurrentDocument: () => {
        const { documents, currentDocId } = get();
        return documents.find((doc) => doc.id === currentDocId);
      },

      checkLegacyData: () => {
        // Only run if we are in the browser
        if (typeof window === 'undefined') return;

        const legacyContent = localStorage.getItem('socioflow-content');
        if (legacyContent) {
           // Check if we already migrated it (heuristic: do we have docs?)
           // Or maybe just strictly if documents is empty?
           // Let's say if documents is empty, we import it.
           const { documents } = get();
           if (documents.length === 0) {
               const newDoc: Document = {
                   id: crypto.randomUUID(),
                   title: 'Documento Recuperado',
                   content: legacyContent,
                   lastModified: Date.now(),
               };
               set({
                   documents: [newDoc],
                   currentDocId: newDoc.id
               });
               // Optional: clear legacy key so we don't re-import?
               // localStorage.removeItem('socioflow-content');
               // Better keep it for safety for now.
           }
        } else {
            // If no legacy content and no documents, create a fresh one
            const { documents } = get();
             if (documents.length === 0) {
                 get().createDocument();
             }
        }
      }
    }),
    {
      name: 'socioflow-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage),
    }
  )
);
