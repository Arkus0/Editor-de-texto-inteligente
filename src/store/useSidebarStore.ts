import { create } from 'zustand';

type Definition = {
    term: string;
    definition: string;
    source?: string;
}

type SidebarStore = {
    activeDefinition: Definition | null;
    setDefinition: (def: Definition | null) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
    activeDefinition: null,
    setDefinition: (def) => set({ activeDefinition: def }),
}));
