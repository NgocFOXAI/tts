import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

import { useTextGeneration } from '../hooks/useApi';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useChatState } from '../hooks/useChatState';
import env from '../config/environment';
import styles from '../styles/ChatInterface.module.css';

import FeatureSettings from './common/FeatureSettings';
import AutoResizeTextarea from './common/AutoResizeTextarea';
import TypingAnimation from './common/TypingAnimation';

const ChatInterface = ({ onTextGenerated, notify }) => {
  // Use chat state hook with localStorage persistence
  const { messages, setMessages, inputMessage: prompt, setInputMessage: setPrompt, clearChat, addMessage } = useChatState('chatInterface_chatState');
  
  const [files, setFiles] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [outputMode, setOutputMode] = useState('text'); // 'text' or 'pdf'
  const [maxSlides, setMaxSlides] = useState(5);
  const [isDragging, setIsDragging] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const messagesEndRef = useRef(null);
  const dropZoneRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Non-streaming hook only
  const { result, loading, error, generateText, reset } = useTextGeneration();

  // Speech recognition hook
  const {
    isListening,
    transcript,
    isSupported,
    toggleListening,
    clearTranscript
  } = useSpeechRecognition(
    (fullText) => {
      // Cập nhật prompt realtime với cả final và interim transcript
      setPrompt(fullText);
    },
    (error) => {
      // Xử lý lỗi
      if (notify) {
        const errorMessages = {
          'no-speech': 'Không nghe thấy giọng nói nào',
          'audio-capture': 'Không thể truy cập microphone',
          'not-allowed': 'Quyền truy cập microphone bị từ chối',
          'network': 'Lỗi kết nối mạng'
        };
        notify.error(errorMessages[error] || `Lỗi nhận diện giọng nói: ${error}`, {
          duration: 3000
        });
      }
    }
  );

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle scroll to show/hide header
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) return;

    const handleScroll = () => {
      const currentScrollY = messagesContainer.scrollTop;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down - hide header
        setShowHeader(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up - show header
        setShowHeader(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    messagesContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      messagesContainer.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  // Handle response
  useEffect(() => {
    if (result && result.response) {
      const newMessage = {
        id: Date.now(),
        type: 'assistant',
        content: result.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);

      if (onTextGenerated) {
        onTextGenerated(result.response);
      }

      reset();
    }
  }, [result, onTextGenerated, reset]);

  const handleFileSelect = (selectedFiles) => {
    const newFiles = Array.from(selectedFiles);
    setFiles(prev => [...prev, ...newFiles]);
    
    if (notify && newFiles.length > 0) {
      notify.success(`Đã thêm ${newFiles.length} file!`, { duration: 2000 });
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 Chat form submitted!');

    if (!prompt.trim()) {
      return;
    }

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: prompt.trim(),
      timestamp: new Date(),
      files: files.length > 0 ? [...files] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);

    // Check if PDF mode
    if (outputMode === 'pdf') {
      try {
        const formData = new FormData();
        formData.append('message', prompt.trim());
        formData.append('output_format', 'pdf');
        formData.append('max_slides', maxSlides);
        
        if (files.length > 0) {
          formData.append('file', files[0]);
        }

        const response = await fetch(`${env.api.baseUrl}/claude/chat`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Lỗi khi tạo báo cáo PDF');
        }

        // Get PDF blob
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        // Add assistant message with PDF
        const assistantMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: 'Đã tạo báo cáo PDF thành công!',
          pdfUrl: url,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);

        if (notify) {
          notify.success('Tạo báo cáo PDF thành công!', { duration: 3000 });
        }
      } catch (err) {
        console.error('PDF generation failed:', err);

        const errorMessage = {
          id: Date.now() + 1,
          type: 'error',
          content: `Lỗi: ${err.message}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);

        if (notify) {
          notify.error('Lỗi khi tạo báo cáo PDF', { duration: 3000 });
        }
      }
    } else {
      // Text mode - original behavior
      const params = {
        prompt: prompt.trim(),
        files,
      };

      try {
        console.log('🚀 Submitting chat with params:', params);
        await generateText(params);
      } catch (err) {
        console.error('Chat generation failed:', err);

        // Add error message
        const errorMessage = {
          id: Date.now(),
          type: 'error',
          content: `Lỗi: ${err.message}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    }

    // Clear input
    setPrompt('');
    setFiles([]);
  };

  const handleClearChat = () => {
    clearChat(); // Use hook's clearChat method
    setFiles([]);
    reset();
  };

  // Drag and Drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.target === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    handleFileSelect(droppedFiles);
  };

  const handleDownloadReport = (pdfUrl, filename) => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename || 'bao-cao-phan-tich.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewReport = (pdfUrl) => {
    window.open(pdfUrl, '_blank');
  };

  const handleCopyMessage = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      if (notify) {
        notify.success('Đã copy tin nhắn!', { duration: 2000 });
      }
    } catch (err) {
      console.error('Failed to copy message:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (notify) {
        notify.success('Đã copy tin nhắn!', { duration: 2000 });
      }
    }
  };

  const settingsConfig = {
    title: "Cấu Hình Mô Hình AI",
    engineName: "FOXAi Data Analyst",
    expertInfo: {
      title: "Chuyên Gia Phân Tích",
      name: "Senior Data Analyst",
      description: `Chuyên gia phân tích dữ liệu với hơn 10 năm kinh nghiệm
Phân tích chuyên sâu dữ liệu văn bản và tài liệu
Tạo báo cáo insight với 7 phần: Giới thiệu, Tóm tắt, Phân tích, Insight, Dự báo, Đề xuất, Kết luận`
    },
    showClearButton: true,
    clearButtonText: "Xóa Lịch Sử Phân Tích"
  };

  const customInputs = [
    {
      sectionTitle: "Định Dạng Đầu Ra",
      label: "Chế Độ",
      render: () => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setOutputMode('text')}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px',
              border: outputMode === 'text' ? '2px solid #3b82f6' : '2px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              background: outputMode === 'text' ? '#eff6ff' : 'white',
              color: outputMode === 'text' ? '#1e40af' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
             Văn Bản
          </button>
          <button
            onClick={() => setOutputMode('pdf')}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px',
              border: outputMode === 'pdf' ? '2px solid #3b82f6' : '2px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              background: outputMode === 'pdf' ? '#eff6ff' : 'white',
              color: outputMode === 'pdf' ? '#1e40af' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📊 PDF
          </button>
        </div>
      ),
      helpText: "Văn bản: Phân tích chi tiết | PDF: Báo cáo slide trực quan"
    },
    ...(outputMode === 'pdf' ? [{
      sectionTitle: "Tùy Chỉnh PDF",
      label: "Số Trang Slide",
      render: () => (
        <input
          type="number"
          min="3"
          max="5"
          value={maxSlides}
          onChange={(e) => {
            let val = parseInt(e.target.value) || 5;
            if (val < 3) val = 3;
            if (val > 5) val = 5;
            setMaxSlides(val);
          }}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            outline: 'none',
            transition: 'all 0.3s ease',
            background: 'white',
            textAlign: 'center',
            color: '#1e40af'
          }}
        />
      ),
      helpText: "Giới hạn: 3-5 trang | Mỗi slide: 2-4 biểu đồ"
    }] : [])
  ];

  return (
    <div className={styles.chatInterface}>
      {/* Backdrop overlay */}
      {isSidebarOpen && (
        <div 
          className={styles.backdrop}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Toggle Button */}
      <button
        className={styles.toggleButton}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        title={isSidebarOpen ? "Ẩn tùy chỉnh" : "Hiện tùy chỉnh"}
      >
        {isSidebarOpen ? '✕' : '⚙'}
      </button>

      {/* Left Sidebar */}
      <div className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ''}`}>
        <FeatureSettings 
          config={settingsConfig}
          onClearHistory={handleClearChat}
          customInputs={customInputs}
        />
      </div>

      {/* Right Chat Area */}
      <div 
        className={styles.chatArea}
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ position: 'relative' }}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(59, 130, 246, 0.15)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: '16px',
            border: '3px dashed #3b82f6',
            pointerEvents: 'none'
          }}>
            <div style={{
              background: 'white',
              padding: '40px 60px',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(59, 130, 246, 0.4)',
              border: '3px solid #3b82f6',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>📄</div>
              <div style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1e40af',
                marginBottom: '8px'
              }}>
                Thả file vào đây
              </div>
              <div style={{
                fontSize: '16px',
                color: '#3b82f6',
                fontWeight: '500'
              }}>
                Hỗ trợ tất cả định dạng tài liệu
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className={styles.messagesContainer} ref={messagesContainerRef}>
        {messages.length === 0 && (
          <div className={styles.welcomeMessage}>
            <TypingAnimation />
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`${styles.message} ${styles[message.type]}`}>
            <div className={styles.messageHeader}>
              <span className={styles.messageRole}>
                {message.type === 'user' ? 'User' : message.type === 'assistant' ? 'AI' : 'Lỗi'}
              </span>
              <span className={styles.messageTime}>
                {message.timestamp.toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className={styles.messageContent}>
              {message.type === 'assistant' ? (
                <div className={styles.messageContentWrapper}>
                  <div className={styles.markdown}>
                    <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {!message.pdfUrl && (
                    <button
                      className={styles.copyButton}
                      onClick={() => handleCopyMessage(message.content)}
                      title="Copy message"
                    >
                    </button>
                  )}
                  {message.pdfUrl && (
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleViewReport(message.pdfUrl)}
                        style={{ 
                          fontSize: '14px', 
                          padding: '10px 20px',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          border: '2px solid #2563eb',
                          borderRadius: '8px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                          color: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        📄 Xem Báo Cáo
                      </button>
                      <button
                        onClick={() => handleDownloadReport(message.pdfUrl, 'bao-cao-phan-tich.pdf')}
                        style={{ 
                          fontSize: '14px', 
                          padding: '10px 20px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: '2px solid #059669',
                          borderRadius: '8px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                          color: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        💾 Tải Xuống
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.plainText}>
                  {message.content}
                </div>
              )}
            </div>

            {message.files && (
              <div className={styles.messageFiles}>
                <strong>Tập tin:</strong> {message.files.map(f => f.name).join(', ')}
              </div>
            )}

            {message.usage && (
              <div className={styles.messageUsage}>
                Sử dụng: {JSON.stringify(message.usage)}
              </div>
            )}
          </div>
        ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          {/* Compact File Preview - Same as SmartReport */}
          {files.length > 0 && (
            <div style={{ 
              marginBottom: '16px', 
              padding: '14px 18px', 
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
              borderRadius: '10px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              border: '2px solid #3b82f6',
              boxShadow: '0 4px 12px rgba(59,130,246,0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '24px' }}>📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', color: '#1e3a8a', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {files[0].name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '500' }}>
                    {(files[0].size / 1024).toFixed(1)} KB {files.length > 1 && `+ ${files.length - 1} file khác`}
                  </div>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setFiles([])}
                style={{ 
                  fontSize: '13px', 
                  padding: '6px 14px', 
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: '2px solid #dc2626',
                  borderRadius: '6px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0,
                  marginLeft: '10px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Xóa
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            {/* File Upload Button - Small Pin Icon */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Đính kèm file"
              style={{
                background: 'none',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading ? 0.5 : 0.7,
                transition: 'opacity 0.2s',
                fontSize: '20px',
                flexShrink: 0
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
            >
              📎
            </button>

            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <AutoResizeTextarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  outputMode === 'pdf' 
                    ? "Nhập yêu cầu tạo báo cáo PDF..."
                    : "Nhập yêu cầu phân tích dữ liệu..."
                }
                className={styles.messageInput}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                minRows={1}
                maxRows={1}
                style={{
                  width: '100%',
                  padding: '12px 50px 12px 16px',
                  border: '2px solid #d1d5db',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: '500',
                  outline: 'none',
                  resize: 'none',
                  background: 'white'
                }}
              />

              {/* Speech Recognition Button - inside textarea */}
              {isSupported && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleListening();
                  }}
                  disabled={loading}
                  title={isListening ? "Dừng ghi âm" : "Bắt đầu nói"}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: loading ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isListening ? (
                    <span style={{ fontSize: '24px', color: '#ef4444', lineHeight: 1 }}>⏹</span>
                  ) : (
                    <img src="./static/mic.png" alt="Mic" style={{ width: '24px', height: '24px' }} />
                  )}
                </button>
              )}
            </div>

            {/* Send Button - Arrow SVG */}
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              title={loading ? "Đang xử lý..." : (outputMode === 'pdf' ? 'Tạo PDF' : 'Phân tích')}
              style={{
                background: loading || !prompt.trim() 
                  ? '#d1d5db' 
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                borderRadius: '10px',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0,
                boxShadow: loading || !prompt.trim() ? 'none' : '0 4px 12px rgba(59,130,246,0.3)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          {error && (
            <div className={styles.error}>
              Lỗi: {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;