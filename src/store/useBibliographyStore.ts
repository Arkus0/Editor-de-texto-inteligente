import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
};

export const useBibliographyStore = create<BibliographyStore>()(
  persist(
    (set) => ({
      references: [],
      addReference: (ref) => {
        const newRef: Reference = { ...ref, id: crypto.randomUUID() };
        set((state) => ({ references: [...state.references, newRef] }));
      },
      deleteReference: (id) => {
        set((state) => ({ references: state.references.filter((r) => r.id !== id) }));
      },
    }),
    {
      name: 'socioflow-bibliography',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
