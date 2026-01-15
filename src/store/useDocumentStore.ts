import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabaseClient';

export type Document = {
  id: string;
  title: string;
  content: string;
  lastModified: number;
};

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

type DocumentStore = {
  documents: Document[];
  currentDocId: string | null;
  syncStatus: SyncStatus;
  lastSyncTime: number | null;

  createDocument: () => string;
  openDocument: (id: string) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  deleteDocument: (id: string) => void;
  getCurrentDocument: () => Document | undefined;
  checkLegacyData: () => void;
  syncWithCloud: (userId: string) => Promise<void>;
  syncLocalToCloud: (doc: Document) => Promise<void>;
  setSyncStatus: (status: SyncStatus) => void;
};

// Debounce timer for sync
let syncTimer: NodeJS.Timeout | null = null;
const SYNC_DEBOUNCE_MS = 2000; // 2 seconds

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set, get) => ({
      documents: [],
      currentDocId: null,
      syncStatus: 'idle' as SyncStatus,
      lastSyncTime: null,

      setSyncStatus: (status: SyncStatus) => {
        set({ syncStatus: status });
        if (status === 'synced') {
          set({ lastSyncTime: Date.now() });
        }
      },

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

        // Try to sync to cloud if user is logged in
        get().syncLocalToCloud(newDoc);

        return newDoc.id;
      },

      openDocument: (id) => {
        set({ currentDocId: id });
      },

      updateDocument: (id, updates) => {
        set((state) => {
             const updatedDocs = state.documents.map((doc) =>
                doc.id === id ? { ...doc, ...updates, lastModified: Date.now() } : doc
             );
             return { documents: updatedDocs };
        });

        // Debounced sync: wait 2 seconds after last edit
        if (syncTimer) clearTimeout(syncTimer);

        set({ syncStatus: 'syncing' });

        syncTimer = setTimeout(() => {
          const doc = get().documents.find(d => d.id === id);
          if (doc) {
            get().syncLocalToCloud(doc);
          }
        }, SYNC_DEBOUNCE_MS);
      },

      deleteDocument: (id) => {
        set((state) => {
          const newDocs = state.documents.filter((doc) => doc.id !== id);
          let newCurrentId = state.currentDocId;
          if (state.currentDocId === id) {
             newCurrentId = newDocs.length > 0 ? newDocs[0].id : null;
          }
          return {
            documents: newDocs,
            currentDocId: newCurrentId,
          };
        });

        // Delete from cloud
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                supabase.from('documents').delete().eq('id', id).then(res => {
                    if (res.error) console.error("Error deleting from cloud", res.error);
                });
            }
        });
      },

      getCurrentDocument: () => {
        const { documents, currentDocId } = get();
        return documents.find((doc) => doc.id === currentDocId);
      },

      checkLegacyData: () => {
        if (typeof window === 'undefined') return;
        const legacyContent = localStorage.getItem('socioflow-content');
        if (legacyContent) {
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
               get().syncLocalToCloud(newDoc);
           }
        } else {
            const { documents } = get();
             if (documents.length === 0) {
                 get().createDocument();
             }
        }
      },

      syncWithCloud: async (userId: string) => {
          if (!userId) return;

          // 1. Fetch cloud documents
          const { data: cloudDocs, error } = await supabase
              .from('documents')
              .select('*');

          if (error) {
              console.error("Error fetching cloud docs:", error);
              return;
          }

          if (!cloudDocs) return;

          // 2. Merge strategies are hard. For now, Cloud wins if it has data?
          // Or we simple union?
          // Let's take Cloud docs and add them to local if they don't exist.
          // If they exist locally, we keep the one with higher lastModified?
          // Since we use 'upsert' on save, let's trust Cloud as the "latest session".

          const localDocs = get().documents;
          const mergedDocs = [...localDocs];

          cloudDocs.forEach((cDoc: any) => {
              const existingIndex = mergedDocs.findIndex(l => l.id === cDoc.id);

              const mappedDoc: Document = {
                  id: cDoc.id,
                  title: cDoc.title,
                  content: cDoc.content,
                  lastModified: cDoc.last_modified
              };

              if (existingIndex === -1) {
                  mergedDocs.push(mappedDoc);
              } else {
                  // Conflict resolution: most recent wins
                  if (mappedDoc.lastModified > mergedDocs[existingIndex].lastModified) {
                      mergedDocs[existingIndex] = mappedDoc;
                  }
              }
          });

          set({ documents: mergedDocs });

          // 3. Upload any local docs that aren't in cloud?
          // Just simplistic trigger:
          // mergedDocs.forEach(d => get().syncLocalToCloud(d)); // This might be too heavy on login
      },

      syncLocalToCloud: async (doc: Document) => {
          try {
            // Check if logged in
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
              get().setSyncStatus('idle');
              return;
            }

            const { error } = await supabase.from('documents').upsert({
                id: doc.id,
                user_id: session.user.id,
                title: doc.title,
                content: doc.content,
                last_modified: doc.lastModified
            });

            if (error) {
              console.error("Error saving to cloud:", error);
              get().setSyncStatus('error');
            } else {
              get().setSyncStatus('synced');
            }
          } catch (error) {
            console.error("Sync error:", error);
            get().setSyncStatus('error');
          }
      }
    }),
    {
      name: 'juord-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
