import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

import { useTextGeneration } from '../hooks/useApi';
import { useImagePaste } from '../hooks/useImageUpload';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import env from '../config/environment';
import styles from '../styles/ChatInterface.module.css';

import Sidebar from './common/Sidebar';
import { SettingsSection } from './common/SettingsSection';
import AutoResizeTextarea from './common/AutoResizeTextarea';
import TypingAnimation from './common/TypingAnimation';
import FileUploadZone from './FileUploadZone';

const ChatInterface = ({ onTextGenerated, notify }) => {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState([]);
  const [showImageUpload, setShowImageUpload] = useState(false);

  const messagesEndRef = useRef(null);

  // Non-streaming hook only
  const { result, loading, error, generateText, reset } = useTextGeneration();

  // Image paste hook
  const { clearPastedImages } = useImagePaste((newFiles) => {
    setFiles(prev => [...prev, ...newFiles]);
    setShowImageUpload(true);
    
    // Show notification
    if (notify) {
      notify.success(`Đã paste ${newFiles.length} file từ clipboard!`, {
        duration: 3000
      });
    }
  });

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

  // Handler for FileUploadZone
  const handleImagesAdd = (newFiles) => {
    const validFiles = newFiles.slice(0, env.upload.maxFiles);
    
    // Validate file sizes
    const oversizedFiles = validFiles.filter(file => file.size > env.upload.maxFileSize);
    if (oversizedFiles.length > 0) {
      const maxSizeMB = (env.upload.maxFileSize / 1024 / 1024).toFixed(1);
      const errorMessage = `Một số file quá lớn (tối đa: ${maxSizeMB}MB): ${oversizedFiles.map(f => f.name).join(', ')}`;
      
      if (notify) {
        notify.warning(errorMessage, { duration: 6000 });
      } else {
        alert(errorMessage);
      }
      
      // Filter out oversized files
      const validSizedFiles = validFiles.filter(file => file.size <= env.upload.maxFileSize);
      setFiles(prev => [...prev, ...validSizedFiles]);
      
      if (validSizedFiles.length > 0 && notify) {
        notify.success(`Đã thêm ${validSizedFiles.length} file hợp lệ`);
      }
    } else {
      setFiles(prev => [...prev, ...validFiles]);
      
      if (notify) {
        notify.success(`Đã thêm ${validFiles.length} file!`);
      }
    }
    
    // Show the upload zone if not already visible
    if (!showImageUpload) {
      setShowImageUpload(true);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    
    // Hide upload zone if no files left
    if (files.length <= 1) {
      setShowImageUpload(false);
    }
  };

  const handleToggleImageUpload = () => {
    setShowImageUpload(prev => !prev);
    
    // Clear files if hiding
    if (showImageUpload) {
      setFiles([]);
      clearPastedImages();
    }
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

    // Clear input
    setPrompt('');
    setFiles([]);
    clearPastedImages();
    setShowImageUpload(false);
  };

  const handleClearChat = () => {
    setMessages([]);
    setFiles([]);
    clearPastedImages();
    setShowImageUpload(false);
    reset();
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

  return (
    <div className={styles.chatInterface}>
      {/* Left Sidebar */}
      <Sidebar title="Trung Tâm Điều Khiển AI">
        <SettingsSection title="Cấu Hình Mô Hình Trí Tuệ">
          <div className={styles.settingGroup}>
            <label>Engine Xử Lý Ngôn Ngữ</label>
            <div style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #1e5799 0%, #2989d8 50%, #207cca 51%, #7db9e8 100%)',
              borderRadius: '8px',
              color: 'white',
              textAlign: 'center',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(30, 87, 153, 0.3)',
              margin: '8px 0'
            }}>
              FOXAi Assistant
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Chế Độ Chuyên Gia (Cố Định)">
          <div className={styles.settingGroup}>
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f0f9ff', 
              border: '1px solid #0ea5e9', 
              borderRadius: '8px',
              color: '#0c4a6e',
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              <strong> FoxAI Senior Data Analyst</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                Chuyên gia phân tích dữ liệu cấp cao với hơn 10 năm kinh nghiệm.<br/>
                Tạo báo cáo phân tích chuyên sâu bằng tiếng Việt với cấu trúc 7 phần:<br/>
                Giới thiệu, Tóm tắt, Phân tích chuyên sâu, Insight, Dự báo, Đề xuất, Kết luận.
              </p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Thao Tác Quản Lý">
          <button
            type="button"
            onClick={handleClearChat}
            className={styles.clearButton}
          >
            Xóa Lịch Sử Hội Thoại
          </button>
        </SettingsSection>
      </Sidebar>

      {/* Right Chat Area */}
      <div className={styles.chatArea}>
        {/* Chat Messages */}
        <div className={styles.messagesContainer}>
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
                  <button
                    className={styles.copyButton}
                    onClick={() => handleCopyMessage(message.content)}
                    title="Copy message"
                  >
                  </button>
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
          {/* File Upload Zone */}
          {showImageUpload && (
            <FileUploadZone
              files={files}
              onFilesAdd={handleImagesAdd}
              onFileRemove={handleRemoveFile}
              maxFiles={env.upload.maxFiles}
              maxFileSize={env.upload.maxFileSize}
              disabled={!env.features.fileUpload}
            />
          )}

          {/* Legacy File Preview (keep for backwards compatibility) */}
          {!showImageUpload && files.length > 0 && (
            <div className={styles.filePreview}>
              {files.map((file, index) => (
                <div key={index} className={styles.fileItem}>
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className={styles.removeFile}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.inputContainer}>
            {/* File Upload Toggle Button */}
            <button
              type="button"
              onClick={handleToggleImageUpload}
              className={`${styles.fileButton} ${showImageUpload ? styles.active : ''}`}
              disabled={!env.features.fileUpload || loading}
              title={showImageUpload ? "Ẩn khu vực upload tài liệu" : "Hiện khu vực upload tài liệu"}
            >
              <img src="./static/upload.png" alt="Upload" style={{ width: '32px', height: '32px' }} />
            </button>

            <div className={styles.textareaWrapper}>
              <AutoResizeTextarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={showImageUpload ? 
                  "Mô tả yêu cầu phân tích chuyên sâu cho các tài liệu đã upload... (Shift+Enter để xuống dòng)" :
                  "Nhập câu hỏi hoặc yêu cầu của bạn tại đây... (Shift+Enter để xuống dòng)"
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
              />

              {/* Speech Recognition Button - inside textarea */}
              {isSupported && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Mic button clicked, isListening:', isListening);
                    toggleListening();
                  }}
                  className={`${styles.micButtonInside} ${isListening ? styles.listening : ''}`}
                  disabled={loading}
                  title={isListening ? "Nhấn để dừng ghi âm" : "Nhấn để bắt đầu nói"}
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
              disabled={loading || !prompt.trim()}
              className={styles.sendButton}
            >
              {loading ? 'Đang Xử Lý...' : 'Gửi Yêu Cầu'}
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