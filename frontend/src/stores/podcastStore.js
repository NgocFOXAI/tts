import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const usePodcastStore = create(
  persist(
    (set, get) => ({
      // State
      isGenerating: false,
      podcastMode: 'text',
      customText: '',
      uploadedFiles: [],
      startTime: null,
      
      // Actions
      startGeneration: (mode, text = '', files = []) => set({ 
        isGenerating: true,
        podcastMode: mode,
        customText: text,
        uploadedFiles: files,
        startTime: Date.now() 
      }),
      
      completeGeneration: () => set({ 
        isGenerating: false,
        startTime: null 
      }),
      
      clearGeneration: () => set({ 
        isGenerating: false,
        customText: '',
        uploadedFiles: [],
        startTime: null 
      }),
      
      setPodcastMode: (mode) => set({ podcastMode: mode }),
      
      setCustomText: (text) => set({ customText: text }),
      
      setUploadedFiles: (filesOrUpdater) => set((state) => {
        const newFiles = typeof filesOrUpdater === 'function' 
          ? filesOrUpdater(state.uploadedFiles) 
          : filesOrUpdater;
        return { uploadedFiles: Array.isArray(newFiles) ? newFiles : [] };
      }),
      
      // Check if generation has timed out (60 minutes for podcast)
      isTimedOut: () => {
        const { startTime } = get();
        if (!startTime) return false;
        const elapsed = Date.now() - startTime;
        return elapsed > 60 * 60 * 1000; // 60 minutes
      },
      
      // Get elapsed time in minutes
      getElapsedMinutes: () => {
        const { startTime } = get();
        if (!startTime) return 0;
        return Math.floor((Date.now() - startTime) / 60000);
      }
    }),
    {
      name: 'podcast-generation-storage',
      // Only persist these fields (exclude uploadedFiles as File objects can't be serialized)
      partialize: (state) => ({ 
        isGenerating: state.isGenerating,
        podcastMode: state.podcastMode,
        customText: state.customText,
        startTime: state.startTime
      })
    }
  )
);
