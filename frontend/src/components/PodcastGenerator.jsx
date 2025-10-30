import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { usePodcastStore } from '../stores/podcastStore';
import { apiService } from '../services/api';
import styles from '../styles/TextToSpeech.module.css';

import Sidebar from './common/Sidebar';
import { SettingsSection } from './common/SettingsSection';
import NotificationManager, { useNotifications } from './common/NotificationManager';

const PodcastGenerator = () => {
  const location = useLocation();
  
  // Use Zustand store for persistent state
  const { 
    isGenerating: isGeneratingNotebook,
    podcastMode,
    customText,
    uploadedFiles,
    uploadedFileMetadata,
    generationId,
    startGeneration,
    completeGeneration,
    clearGeneration,
    setPodcastMode,
    setCustomText,
    setUploadedFiles,
    isTimedOut,
    getElapsedMinutes
  } = usePodcastStore();
  
  // Local states
  const [notebookResult, setNotebookResult] = useState(null);
  const [notebookError, setNotebookError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentGenerationId, setCurrentGenerationId] = useState(null);

  // Notifications
  const { notifications, removeNotification, notify } = useNotifications();

  // Clear any stuck generation state on mount (since backend returns immediately now)
  useEffect(() => {
    if (isGeneratingNotebook) {
      clearGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL parameter handling
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const mode = urlParams.get('mode');
    
    // eslint-disable-next-line no-console
    console.log('PodcastGenerator URL params:', mode);
    
    if (mode === 'documents') {
      setPodcastMode('documents');
    } else {
      setPodcastMode('text');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]); // Listen to URL changes

  // Listen for URL changes (when sub-tabs are clicked from header)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      
      if (mode === 'documents') {
        setPodcastMode('documents');
      } else {
        setPodcastMode('text');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Also listen for direct URL changes
    const handleLocationChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      
      if (mode === 'documents') {
        setPodcastMode('documents');
      } else {
        setPodcastMode('text');
      }
    };

    // Check URL changes every 100ms (for navigation via sub-tabs)
    const interval = setInterval(handleLocationChange, 100);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, [setPodcastMode]);

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const processFiles = (files) => {
    const maxFiles = 10;
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown'
    ];

    // Check file count limit
    if (files.length > maxFiles) {
      notify.error(`Chỉ được phép tải lên tối đa ${maxFiles} file`);
      return;
    }

    if (uploadedFiles.length + files.length > maxFiles) {
      notify.error(`Tổng số file không được vượt quá ${maxFiles} file`);
      return;
    }

    // Validate file types
    const invalidFiles = files.filter(file => !supportedTypes.includes(file.type));
    if (invalidFiles.length > 0) {
      notify.error(`File không được hỗ trợ: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // Check file sizes (10MB max each)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      notify.error(`File quá lớn (max 10MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    setUploadedFiles(prev => [...prev, ...files]);
    notify.success(`Đã thêm ${files.length} file thành công`);
  };

  // File upload handlers
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Advanced Audio Generation
  const handleGenerateAdvancedAudio = async () => {
    // Validation based on podcast mode
    if (podcastMode === 'text' && !customText.trim()) {
      notify.error('Vui lòng nhập nội dung văn bản để tạo podcast');
      return;
    }
    
    if (podcastMode === 'documents' && uploadedFiles.length === 0) {
      notify.error('Vui lòng tải lên ít nhất một tài liệu để tạo podcast');
      return;
    }

    // Start generation with Zustand store and get generation ID
    const genId = startGeneration(podcastMode, customText, uploadedFiles);
    setCurrentGenerationId(genId);
    
    setNotebookError(null);
    setNotebookResult(null);

    try {
      // Show initial notification
      notify.info('🚀 Đang gửi yêu cầu đến hệ thống...', {
        duration: 2000
      });

      // Prepare form data based on podcast mode
      let response;
      
      if (podcastMode === 'documents') {
        const formData = new FormData();
        
        // Only add files for documents mode
        uploadedFiles.forEach(file => {
          formData.append('files', file);
        });

        // Call API with files
        response = await apiService.generateAdvancedAudioWithFiles(formData);
      } else {
        // Call API with text only for text mode
        response = await apiService.generateAdvancedAudio({
          custom_text: customText.trim()
        });
      }

      // API returns immediately, show fake progress then complete
      if (currentGenerationId === genId) {
        // Simulate processing with progress notifications
        notify.info(' Đang xử lý yêu cầu...', { duration: 2000 });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        notify.info('📊 Đang phân tích nội dung...', { duration: 2000 });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Complete generation FIRST to clear the banner
        completeGeneration(response);
        
        // Then show result
        setNotebookResult(response);
        
        // Show success notification
        notify.success(
          ' Đã gửi yêu cầu thành công!\n\n' +
          '🎧 Podcast sẽ được tạo trong 15-30 phút.\n' +
          'Kiểm tra trong phần Quản Lý Âm Thanh sau.',
          {
            title: 'Yêu cầu đã được tiếp nhận',
            duration: 10000
          }
        );
      }

    } catch (error) {
      // Only show error if this is still the current generation
      if (currentGenerationId === genId) {
        setNotebookError(error.message);
        notify.error(`❌ Lỗi gửi yêu cầu: ${error.message}`, {
          title: 'Lỗi',
          duration: 10000
        });
        completeGeneration();
      }
    }
  };

  const formatProcessingTime = (seconds) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  return (
    <div className={styles.textToSpeech}>
      {/* Left Sidebar */}
      <Sidebar className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>🎙️ Cài Đặt Podcast</h2>
        </div>
        
        <div className={styles.sidebarContent}>
          <SettingsSection title="Cấu Hình Podcast Thông Minh">
            <div className={styles.infoBox} style={{ marginTop: '1rem' }}>
              <div>
                <strong>FOXAi Advanced Engine:</strong> Chuyển đổi văn bản thành podcast hội thoại tự nhiên với hai diễn giả AI chuyên nghiệp.
              </div>
            </div>
          </SettingsSection>
        </div>
      </Sidebar>

      {/* Right Content Area */}
      <div className={styles.contentArea}>
        <div className={styles.contentHeader}>
          <h1 className={styles.contentTitle}>Nền Tảng Tổng Hợp Podcast Thông Minh</h1>
        </div>

        <div className={styles.contentBody}>
          {/* Podcast Container */}
          <div className={styles.podcastContainer}>
            <form onSubmit={(e) => { e.preventDefault(); handleGenerateAdvancedAudio(); }} className={styles.form}>
              {/* Text Input Tab */}
              {podcastMode === 'text' && (
                <div className={styles.formGroup}>
                  <label htmlFor="customText" className={styles.label}>Nội Dung Nguồn Để Tạo Podcast</label>
                  <textarea
                    id="customText"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Dán nội dung của bạn vào đây để chuyển đổi thành podcast hội thoại chuyên nghiệp...

Loại nội dung phù hợp:
• Bài viết chuyên môn hoặc blog
• Báo cáo nghiên cứu và phân tích
• Tài liệu hướng dẫn và giáo dục
• Ghi chú cuộc họp quan trọng
• Nội dung marketing và truyền thông
"
                    rows={12}
                    className={styles.textarea}
                    disabled={isGeneratingNotebook}
                  />
                  <div className={styles.textStats}>
                    <small className={styles.textHelp}>
                      Dán bất kỳ nội dung chuyên sâu nào để tạo podcast hội thoại chất lượng cao
                    </small>
                    <small className={`${styles.charCount} ${customText.length > 10000 ? styles.warning : ''}`}>
                      {customText.length} ký tự {customText.length > 10000 && '(⚠️ Nội dung rất dài)'}
                    </small>
                  </div>
                </div>
              )}

              {/* Documents Upload Tab */}
              {podcastMode === 'documents' && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Tải Lên Tài Liệu
                    {uploadedFileMetadata && uploadedFileMetadata.length > 0 && uploadedFiles.length === 0 && (
                      <span style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>
                        ({uploadedFileMetadata.length} file đã chọn trước đó)
                      </span>
                    )}
                  </label>
                  
                  {/* Drag and Drop Area */}
                  <div 
                    className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className={styles.dropZoneContent}>
                      <div className={styles.dropZoneIcon}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className={styles.dropZoneText}>
                        <h3>Kéo thả tài liệu vào đây</h3>
                        <p>hoặc</p>
                        <input
                          type="file"
                          id="documentUpload"
                          multiple
                          accept=".pdf,.doc,.docx,.txt,.md"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="documentUpload" className={styles.browseButton}>
                          Chọn Tài Liệu
                        </label>
                      </div>
                      <div className={styles.dropZoneInfo}>
                        <p>Hỗ trợ: PDF, Word (.doc, .docx), Text (.txt), Markdown (.md)</p>
                        <p>Tối đa 10 file, mỗi file không quá 10MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Uploaded Files List */}
                  {uploadedFiles.length > 0 && (
                    <div className={styles.uploadedFiles}>
                      <div className={styles.filesHeader}>
                        <span>{uploadedFiles.length} tài liệu đã chọn</span>
                        <button
                          type="button"
                          onClick={clearAllFiles}
                          className={styles.clearButton}
                        >
                          Xóa Tất Cả
                        </button>
                      </div>
                      <div className={styles.filesList}>
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className={styles.fileItem}>
                            <div className={styles.fileInfo}>
                              <span className={styles.fileName}>{file.name}</span>
                              <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className={styles.removeButton}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generate Button */}
              <div className={styles.buttonGroup}>
                <button
                  type="submit"
                  disabled={isGeneratingNotebook || (podcastMode === 'text' && !customText.trim()) || (podcastMode === 'documents' && uploadedFiles.length === 0)}
                  className={styles.notebookButton}
                >
                  {isGeneratingNotebook ? (
                    <>
                      <span className={styles.loadingSpinner}></span>
                      Đang Gửi Yêu Cầu...
                    </>
                  ) : (
                    'Gửi Yêu Cầu Tạo Podcast'
                  )}
                </button>
              </div>

              {/* Info */}
              <div className={styles.infoBox}>
                <div>
                  <strong>Công Nghệ Hoạt Động:</strong> {podcastMode === 'text' ? 'Dán nội dung chuyên sâu vào ô trên' : 'Tải lên tài liệu của bạn'} và nhấn "Khởi Tạo Podcast Thông Minh". Hệ thống AI sẽ tự động tạo ra podcast chất lượng cao.
                </div>
              </div>
              <div className={styles.alternativeBox}>
                <span>Thời gian xử lý ước tính từ <strong>15-50 phút</strong> tùy thuộc độ dài nội dung</span>
              </div>
            </form>
          </div>

          {/* Results */}
          {notebookResult && (
            <div className={styles.resultContainer}>
              {notebookResult.success ? (
                <div className={styles.successResult}>
                  <h3> Yêu cầu đã được gửi thành công!</h3>
                  <div className={styles.resultInfo}>
                    <div className={styles.convertedText} style={{ 
                      whiteSpace: 'pre-line',
                      background: '#f0f9ff',
                      padding: '20px',
                      borderRadius: '8px',
                      border: '1px solid #0284c7'
                    }}>
                      <p style={{ fontSize: '1.1em', lineHeight: '1.8' }}>
                        {notebookResult.message}
                      </p>
                      
                      <div style={{ 
                        marginTop: '20px', 
                        padding: '15px',
                        background: '#fff',
                        borderRadius: '6px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#0284c7' }}>
                          📍 Hướng dẫn tiếp theo:
                        </p>
                        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                          <li>Hệ thống đang xử lý yêu cầu của bạn</li>
                          <li>Thời gian hoàn thành: 15-30 phút</li>
                          <li>File âm thanh sẽ được lưu tự động</li>
                          <li>Kiểm tra trong phần <strong>Quản Lý Âm Thanh</strong></li>
                        </ul>
                      </div>

                      <div style={{ 
                        marginTop: '20px',
                        display: 'flex',
                        gap: '10px',
                        justifyContent: 'center'
                      }}>
                        <button
                          onClick={() => window.location.href = '/'}
                          style={{
                            padding: '12px 24px',
                            background: '#0284c7',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '1em',
                            fontWeight: '500'
                          }}
                        >
                          🏠 Về Trang Chủ
                        </button>
                        <button
                          onClick={() => {
                            setNotebookResult(null);
                            setNotebookError(null);
                            clearGeneration();
                            setCustomText('');
                            setUploadedFiles([]);
                          }}
                          style={{
                            padding: '12px 24px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '1em',
                            fontWeight: '500'
                          }}
                        >
                          ➕ Tạo Podcast Mới
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.errorResult}>
                  ❌ Lỗi gửi yêu cầu: {notebookResult.message}
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {notebookError && (
            <div className={styles.errorResult}>
              Podcast Generation Error: {notebookError}
            </div>
          )}
        </div>
      </div>

      {/* Notification Manager */}
      <NotificationManager 
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  );
};

export default PodcastGenerator;