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
      
      if (onError) {
        onError(event.error);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);

      // Xử lý restart sau khi clear
      if (restartAfterClearRef.current) {
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

    // Nếu đang listening rồi, bỏ qua
    if (isListening) {
      console.log('Already listening, skipping start');
      return;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true); // Set ngay để tránh double-click
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
      if (onError) {
        onError(error.message);
      }
    }
  }, [isListening, onError]);

  // Stop listening (dừng thủ công, không restart)
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    // Không check isListening nữa - cứ gọi stop() để đảm bảo dừng
    try {
      restartAfterClearRef.current = false; // Dừng thủ công, không restart
      recognitionRef.current.stop();
      setIsListening(false); // Force update state
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
      // Vẫn set state về false để UI consistent
      setIsListening(false);
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
    toggleListening,
    clearTranscript
  };
};

export default useSpeechRecognition;
