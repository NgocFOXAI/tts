import { useState, useEffect } from 'react';

/**
 * Custom hook to manage chat state with localStorage persistence
 * @param {string} storageKey - Unique key for localStorage
 * @returns {object} - Chat state and methods
 */
export const useChatState = (storageKey) => {
  // Load initial state from localStorage
  const loadInitialState = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        if (parsed.messages) {
          parsed.messages = parsed.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
        }
        return parsed;
      }
    } catch (error) {
      console.error('Error loading chat state:', error);
    }
    return { messages: [], inputMessage: '' };
  };

  const initialState = loadInitialState();

  const [messages, setMessages] = useState(initialState.messages);
  const [inputMessage, setInputMessage] = useState(initialState.inputMessage);

  // Save state to localStorage whenever messages or inputMessage changes
  useEffect(() => {
    try {
      const stateToSave = {
        messages,
        inputMessage
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Error saving chat state:', error);
    }
  }, [messages, inputMessage, storageKey]);

  // Clear chat history
  const clearChat = () => {
    setMessages([]);
    setInputMessage('');
    localStorage.removeItem(storageKey);
  };

  // Add a new message
  const addMessage = (message) => {
    setMessages(prev => [...prev, message]);
  };

  return {
    messages,
    setMessages,
    inputMessage,
    setInputMessage,
    clearChat,
    addMessage
  };
};
