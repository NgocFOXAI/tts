import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useConversationStore = create(
  persist(
    (set, get) => ({
      // State
      generating: false,
      selectedFiles: [],
      startTime: null,
      
      // Actions
      startGeneration: (files) => set({ 
        generating: true, 
        selectedFiles: files,
        startTime: Date.now() 
      }),
      
      completeGeneration: () => set({ 
        generating: false, 
        selectedFiles: [],
        startTime: null 
      }),
      
      clearGeneration: () => set({ 
        generating: false, 
        selectedFiles: [],
        startTime: null 
      }),
      
      // Check if generation has timed out (50 minutes)
      isTimedOut: () => {
        const { startTime } = get();
        if (!startTime) return false;
        const elapsed = Date.now() - startTime;
        return elapsed > 50 * 60 * 1000; // 50 minutes
      },
      
      // Get elapsed time in minutes
      getElapsedMinutes: () => {
        const { startTime } = get();
        if (!startTime) return 0;
        return Math.floor((Date.now() - startTime) / 60000);
      }
    }),
    {
      name: 'conversation-generation-storage',
      // Only persist these fields
      partialize: (state) => ({ 
        generating: state.generating,
        selectedFiles: state.selectedFiles,
        startTime: state.startTime
      })
    }
  )
);
