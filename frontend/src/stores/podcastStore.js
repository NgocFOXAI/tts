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
      uploadedFileMetadata: [],
      startTime: null,
      generationId: null,
      generationProgress: null, // Progress message
      
      // Actions
      startGeneration: (mode, text = '', files = []) => {
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
          generationId,
          generationProgress: 'Đang gửi yêu cầu...'
        });
        
        return generationId;
      },
      
      updateProgress: (message) => set({ 
        generationProgress: message 
      }),
      
      completeGeneration: () => set({ 
        isGenerating: false,
        startTime: null,
        generationId: null,
        generationProgress: null
      }),
      
      clearGeneration: () => set({ 
        isGenerating: false,
        customText: '',
        uploadedFiles: [],
        uploadedFileMetadata: [],
        startTime: null,
        generationId: null,
        generationProgress: null
      }),
      
      setPodcastMode: (mode) => set({ podcastMode: mode }),
      
      setCustomText: (text) => set({ customText: text }),
      
      setUploadedFiles: (filesOrUpdater) => set((state) => {
        const newFiles = typeof filesOrUpdater === 'function' 
          ? filesOrUpdater(state.uploadedFiles) 
          : filesOrUpdater;
        
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
      
      // Get elapsed time in seconds
      getElapsedSeconds: () => {
        const { startTime } = get();
        if (!startTime) return 0;
        return Math.floor((Date.now() - startTime) / 1000);
      }
    }),
    {
      name: 'podcast-generation-storage',
      partialize: (state) => ({ 
        // Persist generation state but NOT uploadedFiles (File objects can't be serialized)
        isGenerating: state.isGenerating,
        podcastMode: state.podcastMode,
        customText: state.customText,
        uploadedFileMetadata: state.uploadedFileMetadata, // Metadata only
        startTime: state.startTime,
        generationId: state.generationId,
        generationProgress: state.generationProgress
        // uploadedFiles is NOT persisted - will be lost on refresh (expected behavior)
      }),
      // Add storage event listener to sync across tabs
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str);
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
