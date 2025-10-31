import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useChatState } from '../hooks/useChatState';
import env from '../config/environment';
import styles from '../styles/TextToSpeech.module.css';

import Sidebar from './common/Sidebar';
import { SettingsSection } from './common/SettingsSection';

const SmartReport = ({ notify }) => {
  // Use chat state hook with localStorage persistence
  const { messages, setMessages, inputMessage, setInputMessage, clearChat, addMessage } = useChatState('smartReport_chatState');
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [maxSlides, setMaxSlides] = useState(5);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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

  return (
    <div className={styles.textToSpeech}>
      {/* Left Sidebar */}
      <Sidebar className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>📊 Cài Đặt Báo Cáo</h2>
        </div>
        
        <div className={styles.sidebarContent}>
          <SettingsSection title="Cấu Hình Báo Cáo Thông Minh">
            <div className={styles.infoBox} style={{ marginTop: '1rem' }}>
              <div>
                <strong>FOXAi Smart Report:</strong> Tạo slide báo cáo chuyên nghiệp từ tài liệu PDF/DOCX với biểu đồ và số liệu trực quan.
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Số trang slide
              </label>
              <input
                type="number"
                min="3"
                max="5"
                value={maxSlides}
                onChange={(e) => {
                  let val = parseInt(e.target.value) || 5;
                  // Giới hạn từ 3-5
                  if (val < 3) val = 3;
                  if (val > 5) val = 5;
                  setMaxSlides(val);
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Giới hạn: 3-5 trang. Mỗi slide có 2-4 biểu đồ.
              </p>
            </div>
          </SettingsSection>
        </div>
      </Sidebar>

      {/* Right Content Area */}
      <div className={styles.contentArea}>
        <div className={styles.contentHeader}>
          <h1 className={styles.contentTitle}>Nền Tảng Tạo Báo Cáo Thông Minh</h1>
        </div>

        <div className={styles.contentBody}>
          {/* Create Report View */}
          <div className={styles.podcastContainer}>
              {/* Clear Chat Button */}
              {messages.length > 0 && (
                <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={handleClearChat}
                    className={styles.generateButton}
                    style={{ fontSize: '13px', padding: '6px 12px', background: '#ef4444' }}
                  >
                    Xóa Lịch Sử Chat
                  </button>
                </div>
              )}
              
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                  <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 10px 0', color: '#1f2937' }}>Tạo báo cáo slide chuyên nghiệp</p>
                  <p style={{ margin: '5px 0' }}>• Tải lên tài liệu PDF hoặc DOCX</p>
                  <p style={{ margin: '5px 0' }}>• Yêu cầu tạo slide với biểu đồ và số liệu</p>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} style={{ 
                  marginBottom: '20px', 
                  padding: '15px', 
                  background: message.type === 'user' ? '#f9fafb' : message.type === 'error' ? '#fef2f2' : '#f0f9ff',
                  borderRadius: '6px',
                  border: '1px solid ' + (message.type === 'user' ? '#e5e7eb' : message.type === 'error' ? '#fecaca' : '#bfdbfe')
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600', fontSize: '13px', color: '#374151' }}>
                      {message.type === 'user' ? 'Bạn' : message.type === 'assistant' ? 'AI Assistant' : 'Lỗi'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: '#1f2937', fontSize: '14px', lineHeight: '1.5' }}>
                    {message.content}
                    {message.file && (
                      <div style={{ marginTop: '8px', padding: '6px 10px', background: '#f3f4f6', borderRadius: '4px', fontSize: '13px', color: '#4b5563' }}>
                        File: {message.file}
                      </div>
                    )}
                    {message.pdfUrl && (
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                        <button
                          className={styles.generateButton}
                          onClick={() => handleViewReport(message.pdfUrl)}
                          style={{ fontSize: '13px', padding: '6px 12px' }}
                        >
                          Xem Báo Cáo
                        </button>
                        <button
                          className={styles.generateButton}
                          onClick={() => handleDownloadReport(message.pdfUrl, 'bao-cao.pdf')}
                          style={{ fontSize: '13px', padding: '6px 12px' }}
                        >
                          Tải Xuống
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ padding: '15px', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bfdbfe', marginBottom: '20px' }}>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#374151', marginBottom: '8px' }}>AI Assistant</div>
                  <div style={{ color: '#1f2937', fontSize: '14px' }}>
                    Đang phân tích tài liệu và tạo báo cáo...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />

              {/* Input Area */}
              <div style={{ marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
                {file && (
                  <div style={{ marginBottom: '12px', padding: '10px', background: '#f9fafb', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>File: {file.name}</span>
                    <button 
                      onClick={handleRemoveFile}
                      className={styles.generateButton}
                      style={{ fontSize: '12px', padding: '4px 10px', background: '#ef4444' }}
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
                  
                  <button
                    type="button"
                    className={styles.generateButton}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    title="Đính kèm file PDF/DOCX"
                    style={{ minWidth: '120px', maxWidth: '120px', width: '120px', fontSize: '14px' }}
                  >
                    Chọn File
                  </button>

                  <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Nhập yêu cầu tạo báo cáo..."
                      disabled={loading}
                      style={{ 
                        width: '100%',
                        padding: '10px 50px 10px 15px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px', 
                        fontSize: '14px',
                        outline: 'none'
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
                        title={isListening ? "Nhấn để dừng ghi âm" : "Nhấn để bắt đầu nói"}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          background: 'transparent',
                          border: 'none',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: loading ? 0.5 : 1
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

                  <button
                    type="submit"
                    className={styles.generateButton}
                    disabled={loading || !inputMessage.trim()}
                    style={{ minWidth: '120px', maxWidth: '120px', width: '120px', fontSize: '14px' }}
                  >
                    {loading ? 'Đang tạo...' : 'Tạo Báo Cáo'}
                  </button>
                </form>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SmartReport;
