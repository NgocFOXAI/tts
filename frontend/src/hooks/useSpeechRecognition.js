import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for Real-time Speech Recognition
 * @param {Function} onResult - Callback when speech is recognized
 * @param {Function} onError - Callback when error occurs
 * @returns {Object} - Speech recognition state and controls
 */
export const useSpeechRecognition = (onResult, onError) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const restartAfterClearRef = useRef(false);
  const extractionJustCompletedRef = useRef(false);
  const isStartingRef = useRef(false); // Thêm flag để ngăn double-click
  const shouldStopRef = useRef(false); // Flag để dừng hoàn toàn

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
      isStartingRef.current = false; // Reset flag khi đã start thành công
      shouldStopRef.current = false; // Reset flag dừng

      // Nếu vừa hoàn thành extraction, xóa transcript
      if (extractionJustCompletedRef.current) {
        finalTranscriptRef.current = '';
        setTranscript('');
        extractionJustCompletedRef.current = false;
      } else {
        // Giữ lại transcript hiện tại và thêm khoảng trắng nếu cần
        if (finalTranscriptRef.current.length > 0 && !finalTranscriptRef.current.endsWith(' ')) {
          finalTranscriptRef.current += ' ';
        }
      }
    };

    recognition.onresult = (event) => {
      // Nếu cờ restart đang bật, PHỚT LỜ tất cả kết quả cũ
      if (restartAfterClearRef.current) {
        return;
      }

      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcriptText + ' ';
        } else {
          interimTranscript += transcriptText;
        }
      }

      // Update transcript với cả final và interim
      const fullTranscript = finalTranscriptRef.current + interimTranscript;
      setTranscript(fullTranscript);

      // Call onResult với full transcript (bao gồm cả interim)
      if (onResult) {
        onResult(fullTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      restartAfterClearRef.current = false;
      isStartingRef.current = false; // Reset flag khi có lỗi
      
      if (onError) {
        onError(event.error);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended, shouldStop:', shouldStopRef.current);
      setIsListening(false);
      isStartingRef.current = false; // Reset flag

      // Chỉ restart nếu không phải dừng thủ công
      if (restartAfterClearRef.current && !shouldStopRef.current) {
        restartAfterClearRef.current = false;
        finalTranscriptRef.current = '';
        setTranscript('');
        
        try {
          recognition.start();
        } catch (e) {
          console.error('Lỗi khi tự động restart:', e);
          if (onError) {
            onError('Lỗi restart. Hãy nhấn nút.');
          }
        }
      } else {
        // Reset các flag
        restartAfterClearRef.current = false;
        shouldStopRef.current = false;
      }
    };

    recognitionRef.current = recognition;

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult, onError]);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;

    // Nếu đang trong quá trình start hoặc đang listening, bỏ qua
    if (isStartingRef.current || isListening) {
      console.log('Already starting or listening, skipping start');
      return;
    }

    try {
      isStartingRef.current = true; // Đánh dấu đang start để ngăn double-click
      shouldStopRef.current = false; // Reset flag dừng
      recognitionRef.current.start();
      console.log('Recognition start called');
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
      isStartingRef.current = false;
      if (onError) {
        onError(error.message);
      }
    }
  }, [isListening, onError]);

  // Stop listening (dừng thủ công, không restart)
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    console.log('Stop listening called');
    try {
      // Đánh dấu là dừng thủ công để ngăn tự động restart
      shouldStopRef.current = true;
      restartAfterClearRef.current = false;
      isStartingRef.current = false;
      
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
      // Vẫn set state về false để UI consistent
      setIsListening(false);
      shouldStopRef.current = false;
      isStartingRef.current = false;
    }
  }, []);

  // Clear transcript và restart nếu đang listening
  const clearTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    extractionJustCompletedRef.current = false;

    if (isListening && recognitionRef.current) {
      restartAfterClearRef.current = true;
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Toggle listening với debounce
  const toggleListening = useCallback(() => {
    console.log('Toggle listening, current state:', isListening, 'isStarting:', isStartingRef.current);
    
    // Ngăn chặn double-click
    if (isStartingRef.current) {
      console.log('Still starting, ignoring toggle');
      return;
    }

    if (isListening) {
      console.log('Stopping...');
      stopListening();
    } else {
      console.log('Starting...');
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript
  };
};

export default useSpeechRecognition;
