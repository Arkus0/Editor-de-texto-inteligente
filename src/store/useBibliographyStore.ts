import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabaseClient';

export type ReferenceType = 'book' | 'article' | 'web';

export type Reference = {
  id: string;
  type: ReferenceType;
  title: string;
  author: string;
  year: string;
  source?: string; // Journal name or URL
};

type BibliographyStore = {
  references: Reference[];
  addReference: (ref: Omit<Reference, 'id'>) => void;
  deleteReference: (id: string) => void;
  syncReferencesWithCloud: () => Promise<void>;
};

export const useBibliographyStore = create<BibliographyStore>()(
  persist(
    (set, get) => ({
      references: [],
      addReference: (ref) => {
        const newRef: Reference = { ...ref, id: crypto.randomUUID() };
        set((state) => ({ references: [...state.references, newRef] }));

        // Cloud Save
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                supabase.from('references').upsert({
                    id: newRef.id,
                    user_id: session.user.id,
                    ...ref
                }).then(res => {
                    if(res.error) console.error("Error saving ref:", res.error);
                });
            }
        });
      },
      deleteReference: (id) => {
        set((state) => ({ references: state.references.filter((r) => r.id !== id) }));

        // Cloud Delete
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                supabase.from('references').delete().eq('id', id);
            }
        });
      },
      syncReferencesWithCloud: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) return;

          const { data, error } = await supabase.from('references').select('*');
          if (error) {
              console.error(error);
              return;
          }

          if (data) {
              // Merge: favor Cloud or Local?
              // Simple strategy: Union
              const localRefs = get().references;
              const merged = [...localRefs];

              data.forEach((cloudRef: any) => {
                  if (!merged.find(r => r.id === cloudRef.id)) {
                      merged.push({
                          id: cloudRef.id,
                          type: cloudRef.type as ReferenceType,
                          title: cloudRef.title,
                          author: cloudRef.author,
                          year: cloudRef.year,
                          source: cloudRef.source
                      });
                  }
              });
              set({ references: merged });
          }
      }
    }),
    {
      name: 'socioflow-bibliography',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
