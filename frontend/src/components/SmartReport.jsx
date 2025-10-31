import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useChatState } from '../hooks/useChatState';
import env from '../config/environment';
import styles from '../styles/TextToSpeech.module.css';

import Sidebar from './common/Sidebar';
import { SettingsSection } from './common/SettingsSection';

const SmartReport = ({ notify }) => {
  const location = useLocation();
  const [view, setView] = useState('create'); // 'create' or 'manage'
  
  // Use chat state hook with localStorage persistence
  const { messages, setMessages, inputMessage, setInputMessage, clearChat, addMessage } = useChatState('smartReport_chatState');
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedReports, setSavedReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  
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

  // URL parameter handling
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const mode = urlParams.get('mode');
    
    if (mode === 'manage') {
      setView('manage');
    } else {
      setView('create');
    }
  }, [location.search]);

  // Listen for URL changes
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      
      if (mode === 'manage') {
        setView('manage');
      } else {
        setView('create');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    const handleLocationChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      
      if (mode === 'manage') {
        setView('manage');
      } else {
        setView('create');
      }
    };

    const interval = setInterval(handleLocationChange, 100);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, []);

  // Load saved reports when switching to manage view
  useEffect(() => {
    if (view === 'manage') {
      loadSavedReports();
    }
  }, [view]);

  const loadSavedReports = async () => {
    setLoadingReports(true);
    try {
      const response = await fetch(`${env.api.baseUrl}/claude/dashboard`);
      const data = await response.json();
      
      if (data.files) {
        setSavedReports(data.files);
        if (notify) {
          notify.success(`Đã tải ${data.total} báo cáo`, { duration: 2000 });
        }
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      if (notify) {
        notify.error('Lỗi khi tải danh sách báo cáo', { duration: 3000 });
      }
    } finally {
      setLoadingReports(false);
    }
  };

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

  const handleDeleteReport = async (filename) => {
    if (!window.confirm(`Bạn có chắc muốn xóa báo cáo "${filename}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${env.api.baseUrl}/claude/dashboard/${filename}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Lỗi khi xóa báo cáo');
      }

      // Reload reports
      await loadSavedReports();

      if (notify) {
        notify.success('Đã xóa báo cáo thành công', { duration: 2000 });
      }

    } catch (error) {
      console.error('Error deleting report:', error);
      if (notify) {
        notify.error('Lỗi khi xóa báo cáo', { duration: 3000 });
      }
    }
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
          {view === 'create' && (
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
          )}

          {/* Manage View */}
          {view === 'manage' && (
            <div className={styles.podcastContainer}>
              {/* Actions */}
              <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <button onClick={loadSavedReports} className={styles.generateButton}>
                  Làm Mới
                </button>
                <button 
                  onClick={handleClearChat} 
                  className={styles.generateButton}
                  style={{ background: '#ef4444' }}
                >
                  Xóa Lịch Sử Chat
                </button>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div style={{ padding: '15px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '5px' }}>Tổng Báo Cáo</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>{savedReports.length}</div>
                </div>
                <div style={{ padding: '15px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '5px' }}>Tổng Dung Lượng</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
                    {savedReports.reduce((sum, r) => sum + (r.size_kb || 0), 0).toFixed(0)} KB
                  </div>
                </div>
              </div>

              {loadingReports ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Đang tải danh sách báo cáo...</div>
              ) : savedReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Chưa có báo cáo nào</p>
                  <p>Tạo báo cáo đầu tiên của bạn ở tab "Tạo Báo Cáo"</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Tên File</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Kích Thước</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Ngày Tạo</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedReports.map((report) => (
                        <tr key={report.filename} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#1f2937' }}>
                            <strong>{report.filename}</strong>
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                            {report.size_kb} KB
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                            {new Date(report.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                className={styles.generateButton}
                                onClick={() => handleViewReport(`${env.api.baseUrl.replace('/api', '')}${report.pdf_url}`)}
                                title="Xem PDF"
                                style={{ fontSize: '13px', padding: '6px 12px' }}
                              >
                                Xem PDF
                              </button>
                              <a
                                href={`${env.api.baseUrl.replace('/api', '')}${report.pdf_url}`}
                                download
                                className={styles.generateButton}
                                title="Tải xuống PDF"
                                style={{ fontSize: '13px', padding: '6px 12px', textDecoration: 'none', display: 'inline-block' }}
                              >
                                Tải PDF
                              </a>
                              <button
                                className={styles.generateButton}
                                onClick={() => handleDeleteReport(report.filename)}
                                title="Xóa"
                                style={{ fontSize: '13px', padding: '6px 12px', background: '#ef4444' }}
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartReport;
