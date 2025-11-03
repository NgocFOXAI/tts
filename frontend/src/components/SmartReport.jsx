import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useChatState } from '../hooks/useChatState';
import env from '../config/environment';
import styles from '../styles/TextToSpeech.module.css';

import FeatureSettings from './common/FeatureSettings';

const SmartReport = ({ notify }) => {
  // Use chat state hook with localStorage persistence
  const { messages, setMessages, inputMessage, setInputMessage, clearChat, addMessage } = useChatState('smartReport_chatState');
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [maxSlides, setMaxSlides] = useState(5);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const podcastContainerRef = useRef(null);

  // Speech recognition hook
  const {
    isListening,
    transcript,
    isSupported,
    toggleListening,
    clearTranscript
  } = useSpeechRecognition(
    (fullText) => {
      // Cập nhật inputMessage realtime
      setInputMessage(fullText);
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
    const podcastContainer = podcastContainerRef.current;
    if (!podcastContainer) return;

    const handleScroll = () => {
      const currentScrollY = podcastContainer.scrollTop;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down - hide header
        setShowHeader(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up - show header
        setShowHeader(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    podcastContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      podcastContainer.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  const handleFileSelect = (files) => {
    if (files && files.length > 0) {
      const selectedFile = files[0];
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(selectedFile.type)) {
        if (notify) {
          notify.error('Chỉ hỗ trợ file PDF hoặc DOCX', { duration: 3000 });
        }
        return;
      }
      
      setFile(selectedFile);
      if (notify) {
        notify.success(`Đã chọn file: ${selectedFile.name}`, { duration: 2000 });
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
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
    
    // Only hide overlay if we're leaving the drop zone entirely
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

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) {
      if (notify) {
        notify.warning('Vui lòng nhập yêu cầu tạo báo cáo', { duration: 2000 });
      }
      return;
    }

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      file: file ? file.name : null,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Clear input
    setInputMessage('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', inputMessage);
      formData.append('output_format', 'pdf');
      formData.append('max_slides', maxSlides);
      
      if (file) {
        formData.append('file', file);
      }

      const response = await fetch(`${env.api.baseUrl}/claude/chat`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Lỗi khi tạo báo cáo');
      }

      // Get PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Add assistant message with PDF
      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'Đã tạo báo cáo thành công!',
        pdfUrl: url,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Clear file
      setFile(null);

      if (notify) {
        notify.success('Tạo báo cáo thành công!', { duration: 3000 });
      }

    } catch (error) {
      console.error('Error generating report:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: error.message || 'Đã xảy ra lỗi khi tạo báo cáo',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);

      if (notify) {
        notify.error('Lỗi khi tạo báo cáo', { duration: 3000 });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = (pdfUrl, filename) => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename || 'bao-cao.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewReport = (pdfUrl) => {
    window.open(pdfUrl, '_blank');
  };

  const handleClearChat = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat?')) {
      clearChat(); // Use hook's clearChat method
      setFile(null);
      
      if (notify) {
        notify.success('Đã xóa lịch sử chat', { duration: 2000 });
      }
    }
  };

  const settingsConfig = {
    title: "Cấu Hình Mô Hình AI",
    engineName: "FOXAi Chart Generator",
    engineDescription: "Tạo báo cáo slide PDF với biểu đồ và số liệu trực quan từ tài liệu PDF/DOCX của bạn.",
    expertInfo: {
      title: "Chuyên Gia Biểu Đồ",
      name: "Senior Data Visualization Specialist",
      description: "Chuyên gia trực quan hóa dữ liệu với hơn 10 năm kinh nghiệm trong việc tạo các biểu đồ và báo cáo chuyên nghiệp.\n\nKhả năng:\n• Phân tích dữ liệu từ tài liệu PDF/DOCX\n• Tạo biểu đồ trực quan chuyên nghiệp\n• Thiết kế slide báo cáo đẹp mắt\n• Tổng hợp và trình bày số liệu hiệu quả"
    },
    showClearButton: false
  };

  const customInputs = [
    {
      sectionTitle: "Tùy Chỉnh",
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
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
        />
      ),
      helpText: "Giới hạn: 3-5 trang | Mỗi slide: 2-4 biểu đồ"
    }
  ];

  return (
    <div className={styles.textToSpeech}>
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
          customInputs={customInputs}
        />
      </div>

      {/* Right Content Area */}
      <div className={styles.contentArea}>
        <div className={styles.contentBody}>
          {/* Create Report View */}
          <div 
            className={styles.podcastContainer}
            ref={podcastContainerRef}
            style={{ position: 'relative', overflow: 'auto', height: '100%' }}
          >
              {/* Content with drag drop */}
              <div 
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{ position: 'relative', minHeight: '100%' }}
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
                      Hỗ trợ PDF và DOCX
                    </div>
                  </div>
                </div>
              )}

              {/* Clear Chat Button */}
              {messages.length > 0 && (
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={handleClearChat}
                    className={styles.generateButton}
                    style={{ 
                      fontSize: '14px', 
                      padding: '10px 20px', 
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      border: '2px solid #dc2626',
                      borderRadius: '8px',
                      fontWeight: '600',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Xóa Lịch Sử
                  </button>
                </div>
              )}
              
              {messages.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '60px 40px',
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderRadius: '16px',
                  border: '2px dashed #3b82f6',
                  margin: '20px 0'
                }}>
                  <p style={{ 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    margin: '0 0 20px 0', 
                    color: '#1e3a8a',
                    letterSpacing: '0.5px'
                  }}>
                    Tạo Báo Cáo Biểu Đồ Chuyên Nghiệp
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    textAlign: 'left',
                    maxWidth: '500px',
                    margin: '0 auto',
                    fontSize: '15px',
                    color: '#1e40af'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>Tải lên tài liệu PDF hoặc DOCX</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>Mô tả yêu cầu tạo biểu đồ và báo cáo</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>Nhận báo cáo PDF với biểu đồ trực quan</span>
                    </div>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} style={{ 
                  marginBottom: '20px', 
                  padding: '18px 20px', 
                  background: message.type === 'user' 
                    ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' 
                    : message.type === 'error' 
                    ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' 
                    : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderRadius: '12px',
                  border: '2px solid ' + (message.type === 'user' ? '#cbd5e1' : message.type === 'error' ? '#fca5a5' : '#3b82f6'),
                  boxShadow: '0 4px 12px ' + (message.type === 'user' ? 'rgba(0,0,0,0.08)' : message.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'),
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {message.type === 'user' ? 'Bạn' : message.type === 'assistant' ? 'AI Assistant' : 'Lỗi'}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                      {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: '#1f2937', fontSize: '15px', lineHeight: '1.7', fontWeight: '500' }}>
                    {message.content}
                    {message.file && (
                      <div style={{ 
                        marginTop: '12px', 
                        padding: '10px 14px', 
                        background: 'rgba(255,255,255,0.7)', 
                        borderRadius: '8px', 
                        fontSize: '14px', 
                        color: '#374151',
                        border: '1px solid rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <strong>File:</strong> {message.file}
                      </div>
                    )}
                    {message.pdfUrl && (
                      <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                          className={styles.generateButton}
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
                            boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
                          }}
                        >
                          Xem Báo Cáo
                        </button>
                        <button
                          className={styles.generateButton}
                          onClick={() => handleDownloadReport(message.pdfUrl, 'bao-cao.pdf')}
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
                            boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                          }}
                        >
                          Tải Xuống
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ 
                  padding: '20px', 
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
                  borderRadius: '12px', 
                  border: '2px solid #3b82f6', 
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(59,130,246,0.2)',
                  animation: 'pulse 2s ease-in-out infinite'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '700', fontSize: '15px', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      AI Assistant
                    </span>
                  </div>
                  <div style={{ color: '#1e40af', fontSize: '15px', fontWeight: '500', lineHeight: '1.6' }}>
                    Đang phân tích tài liệu và tạo báo cáo với biểu đồ trực quan...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />

              {/* Input Area */}
              <div style={{ 
                marginTop: '20px', 
                borderTop: '2px solid #e5e7eb', 
                paddingTop: '20px',
                background: 'linear-gradient(135deg, #fafbfc 0%, #f8fafc 100%)',
                borderRadius: '12px',
                padding: '20px'
              }}>
                {file && (
                  <div 
                    className={styles.filePreviewCompact}
                    style={{ 
                      marginBottom: '16px', 
                      padding: '14px 18px', 
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
                      borderRadius: '10px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      border: '2px solid #3b82f6',
                      boxShadow: '0 4px 12px rgba(59,130,246,0.15)'
                    }}
                  >
                    <div className="fileIcon">📄</div>
                    <div className="fileDetails" style={{ flex: 1, minWidth: 0, marginLeft: '10px' }}>
                      <div className="fileName" style={{ fontSize: '15px', color: '#1e3a8a', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div className="fileSize" style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '500' }}>
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button 
                      onClick={handleRemoveFile}
                      className={styles.generateButton}
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
                        marginLeft: '10px'
                      }}
                    >
                      Xóa
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf,.docx"
                    onChange={(e) => handleFileSelect(Array.from(e.target.files))}
                  />
                  
                  {/* File Upload Button - Small Pin Icon */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    title="Đính kèm file PDF/DOCX"
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
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Nhập yêu cầu tạo báo cáo PDF..."
                      disabled={loading}
                      style={{ 
                        width: '100%',
                        padding: '12px 50px 12px 16px', 
                        border: '2px solid #d1d5db', 
                        borderRadius: '10px', 
                        fontSize: '15px',
                        fontWeight: '500',
                        outline: 'none',
                        transition: 'all 0.3s ease',
                        background: 'white'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    
                    {/* Speech Recognition Button */}
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
                    disabled={loading || !inputMessage.trim()}
                    title={loading ? "Đang tạo PDF..." : "Tạo PDF"}
                    style={{
                      background: loading || !inputMessage.trim() 
                        ? '#d1d5db' 
                        : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      border: 'none',
                      borderRadius: '10px',
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                      boxShadow: loading || !inputMessage.trim() ? 'none' : '0 4px 12px rgba(59,130,246,0.3)'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartReport;
