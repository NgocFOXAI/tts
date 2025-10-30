import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for Speech Recognition with auto-stop after 10 seconds
 * @param {Function} onResult - Callback when speech is recognized
 * @param {Function} onError - Callback when error occurs
 * @returns {Object} - Speech recognition state and controls
 */
export const useSpeechRecognition = (onResult, onError) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef(null);
  const autoStopTimerRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    // Check browser support (with webkit prefix for Safari)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      console.warn('Speech Recognition API is not supported in this browser');
      return;
    }

    setIsSupported(true);

    // Create recognition instance
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN'; // Vietnamese
    recognition.interimResults = true; // Get interim results
    recognition.maxAlternatives = 1;
    recognition.continuous = true; // Keep listening

    // Event handlers
    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      
      // Set auto-stop timer for 10 seconds
      autoStopTimerRef.current = setTimeout(() => {
        console.log('Auto-stopping speech recognition after 10 seconds');
        recognition.stop();
      }, 10000);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update transcript
      const fullTranscript = (finalTranscript || interimTranscript).trim();
      setTranscript(fullTranscript);

      // Call onResult with final transcript
      if (finalTranscript && onResult) {
        onResult(finalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Clear auto-stop timer on error
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      
      setIsListening(false);
      
      if (onError) {
        onError(event.error);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      
      // Clear auto-stop timer
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }
    };
  }, [onResult, onError]);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    try {
      setTranscript('');
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      if (onError) {
        onError(error.message);
      }
    }
  }, [isListening, onError]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;

    try {
      recognitionRef.current.stop();
      
      // Clear auto-stop timer
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }, [isListening]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening
  };
};

export default useSpeechRecognition;
