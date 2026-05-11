import { create } from 'zustand';
import { WeddingConfig } from '../lib/weddingConfig';

interface WeddingState {
  config: WeddingConfig | null;
  loading: boolean;
  setConfig: (config: WeddingConfig | null) => void;
  setLoading: (loading: boolean) => void;
  getDaysUntilWedding: () => number;
  getCountdownParts: () => { days: number; hours: number; mins: number };
}

export const useWeddingStore = create<WeddingState>((set, get) => ({
  config: null,
  loading: true,
  setConfig: (config) => set({ config, loading: false }),
  setLoading: (loading) => set({ loading }),
  getDaysUntilWedding: () => {
    const { config } = get();
    if (!config) return 0;
    const diff = config.weddingDate.getTime() - Date.now();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  },
  getCountdownParts: () => {
    const { config } = get();
    if (!config) return { days: 0, hours: 0, mins: 0 };
    const diff = config.weddingDate.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, mins: 0 };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, mins };
  },
}));
