import { create } from 'zustand';

interface LocationStore {
  pendingCount: number;
  isTracking: boolean;
  setPendingCount: (count: number) => void;
  setTracking: (tracking: boolean) => void;
}

export const useLocationStore = create<LocationStore>((set) => ({
  pendingCount: 0,
  isTracking: false,
  setPendingCount: (count) => set({ pendingCount: count }),
  setTracking: (tracking) => set({ isTracking: tracking }),
}));
