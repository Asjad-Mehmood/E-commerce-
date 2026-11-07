import { create } from "zustand";

interface UiState {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

/** Client-only UI state (drawers). Server data lives in TanStack Query. */
export const useUi = create<UiState>((set) => ({
  cartOpen: false,
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
  menuOpen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
}));
