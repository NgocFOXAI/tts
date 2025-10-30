import React, { useState, useRef, useEffect } from 'react';

import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useChatState } from '../hooks/useChatState';
import env from '../config/environment';
import './FileManager.css';

const SmartReport = ({ notify }) => {
  const [view, setView] = useState('chat'); // 'chat' or 'manage'
  
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
    <div className="file-manager">
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <h2>Báo Cáo Thông Minh</h2>
          <p className="header-subtitle">Tạo slide báo cáo chuyên nghiệp từ tài liệu PDF/DOCX</p>
        </div>
        <div className="tab-navigation">
          <button
            className={`tab-btn ${view === 'chat' ? 'active' : ''}`}
            onClick={() => setView('chat')}
          >
            Tạo Báo Cáo
          </button>
          <button
            className={`tab-btn ${view === 'manage' ? 'active' : ''}`}
            onClick={() => setView('manage')}
          >
            Quản Lý File ({savedReports.length})
          </button>
        </div>
      </div>

      {/* Chat View */}
      {view === 'chat' && (
        <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          {messages.length === 0 && (
            <div className="no-files" style={{ padding: '40px 20px' }}>
              <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 10px 0' }}>Tạo báo cáo slide chuyên nghiệp</p>
              <p className="tip" style={{ margin: '5px 0' }}>• Tải lên tài liệu PDF hoặc DOCX</p>
              <p className="tip" style={{ margin: '5px 0' }}>• Yêu cầu tạo slide với biểu đồ và số liệu</p>
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
                      className="download-btn"
                      onClick={() => handleViewReport(message.pdfUrl)}
                    >
                      Xem Báo Cáo
                    </button>
                    <button
                      className="download-btn"
                      onClick={() => handleDownloadReport(message.pdfUrl, 'bao-cao.pdf')}
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
                  style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
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
                className="refresh-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Đính kèm file PDF/DOCX"
                style={{ minWidth: '120px', maxWidth: '120px', width: '120px' }}
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
                className="generate-btn"
                disabled={loading || !inputMessage.trim()}
                style={{ minWidth: '120px', maxWidth: '120px', width: '120px' }}
              >
                {loading ? 'Đang tạo...' : 'Tạo Báo Cáo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Manage View */}
      {view === 'manage' && (
        <>
          {/* Actions */}
          <div className="actions">
            <button onClick={loadSavedReports} className="refresh-btn">
              Làm Mới
            </button>
          </div>

          {/* Stats */}
          <div className="stats-container">
            <div className="stat-card">
              <div className="stat-label">Tổng Báo Cáo</div>
              <div className="stat-value">{savedReports.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Tổng Dung Lượng</div>
              <div className="stat-value">
                {savedReports.reduce((sum, r) => sum + (r.size_kb || 0), 0).toFixed(0)} KB
              </div>
            </div>
          </div>

          {loadingReports ? (
            <div className="loading">Đang tải danh sách báo cáo...</div>
          ) : savedReports.length === 0 ? (
            <div className="no-files">
              <p>Chưa có báo cáo nào</p>
              <p className="tip">Tạo báo cáo đầu tiên của bạn ở tab "Tạo Báo Cáo"</p>
            </div>
          ) : (
            <div className="file-list">
              <div className="file-list-header">
                <div className="col-name">Tên File</div>
                <div className="col-info">Thông Tin</div>
                <div className="col-actions">Thao Tác</div>
              </div>
              {savedReports.map((report) => (
                <div key={report.filename} className="file-item document-file">
                  <div className="file-name-col">
                    <strong>{report.filename}</strong>
                  </div>
                  <div className="file-info-col">
                    <span className="file-size">{report.size_kb} KB</span>
                    <span className="file-date">{new Date(report.created_at).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="file-actions-col">
                    <button
                      className="view-btn"
                      onClick={() => handleViewReport(`${env.api.baseUrl.replace('/api', '')}${report.html_url}`)}
                      title="Xem trước"
                    >
                      Xem trước
                    </button>
                    <button
                      className="preview-btn"
                      onClick={() => handleViewReport(`${env.api.baseUrl.replace('/api', '')}${report.pdf_url}`)}
                      title="Xem PDF"
                    >
                      Xem PDF
                    </button>
                    <a
                      href={`${env.api.baseUrl.replace('/api', '')}${report.pdf_url}`}
                      download
                      className="download-btn"
                      title="Tải xuống PDF"
                    >
                      Tải PDF
                    </a>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteReport(report.filename)}
                      title="Xóa"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SmartReport;
