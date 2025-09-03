import { create } from "zustand";

interface EditorStore {
  template: any;
  setTemplate: (template: any) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  template: null,
  setTemplate: (template) => set({ template }),
}));
