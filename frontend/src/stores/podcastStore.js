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
      uploadedFileMetadata: [], // Serializable file info for persistence
      startTime: null,
      generationId: null, // Track current generation request
      
      // Actions
      startGeneration: (mode, text = '', files = []) => {
        // Store file metadata for persistence
        const fileMetadata = files.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type,
          lastModified: f.lastModified
        }));
        
        const generationId = Date.now().toString();
        
        set({ 
          isGenerating: true,
          podcastMode: mode,
          customText: text,
          uploadedFiles: files,
          uploadedFileMetadata: fileMetadata,
          startTime: Date.now(),
          generationId
        });
        
        return generationId;
      },
      
      completeGeneration: (result = null) => set({ 
        isGenerating: false,
        startTime: null,
        generationId: null
      }),
      
      clearGeneration: () => set({ 
        isGenerating: false,
        customText: '',
        uploadedFiles: [],
        uploadedFileMetadata: [],
        startTime: null,
        generationId: null
      }),
      
      setPodcastMode: (mode) => set({ podcastMode: mode }),
      
      setCustomText: (text) => set({ customText: text }),
      
      setUploadedFiles: (filesOrUpdater) => set((state) => {
        const newFiles = typeof filesOrUpdater === 'function' 
          ? filesOrUpdater(state.uploadedFiles) 
          : filesOrUpdater;
        
        // Update metadata too
        const fileMetadata = Array.isArray(newFiles) ? newFiles.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type,
          lastModified: f.lastModified
        })) : [];
        
        return { 
          uploadedFiles: Array.isArray(newFiles) ? newFiles : [],
          uploadedFileMetadata: fileMetadata
        };
      }),
      
      // Check if generation has timed out (5 minutes since we return immediately now)
      isTimedOut: () => {
        const { startTime } = get();
        if (!startTime) return false;
        const elapsed = Date.now() - startTime;
        return elapsed > 5 * 60 * 1000; // 5 minutes
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
      // Persist serializable data (exclude uploadedFiles, include metadata)
      partialize: (state) => ({ 
        isGenerating: state.isGenerating,
        podcastMode: state.podcastMode,
        customText: state.customText,
        uploadedFileMetadata: state.uploadedFileMetadata,
        startTime: state.startTime,
        generationId: state.generationId
      })
    }
  )
);
