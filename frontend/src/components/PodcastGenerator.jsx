import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { usePodcastStore } from '../stores/podcastStore';
import { apiService } from '../services/api';
import styles from '../styles/TextToSpeech.module.css';

import FeatureSettings from './common/FeatureSettings';
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
    startGeneration,
    updateProgress,
    completeGeneration,
    clearGeneration,
    setPodcastMode,
    setCustomText,
    setUploadedFiles
  } = usePodcastStore();
  
  // Local states
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Notifications
  const { notifications, removeNotification, notify } = useNotifications();

  // Warn user about unsaved files before leaving page
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Warn if there are uploaded files (they will be lost on reload)
      if (uploadedFiles.length > 0 || isGeneratingNotebook) {
        e.preventDefault();
        e.returnValue = 'Bạn có files đã tải lên hoặc đang tạo podcast. Bạn có chắc muốn rời khỏi trang này?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploadedFiles.length, isGeneratingNotebook]);

  // Show warning if page was reloaded with file metadata but no files
  useEffect(() => {
    if (uploadedFileMetadata.length > 0 && uploadedFiles.length === 0 && !isGeneratingNotebook) {
      notify.warning(
        `Trang đã được reload. ${uploadedFileMetadata.length} file trước đó đã bị mất. Vui lòng tải lại files.`
      );
      // Clear the metadata since files are gone
      setUploadedFiles([]);
    }
  }, [uploadedFileMetadata.length, uploadedFiles.length, isGeneratingNotebook, notify, setUploadedFiles]);

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
    const supportedExtensions = [
      '.pdf', '.txt', '.md',
      '.3g2', '.3gp', '.aac', '.aif', '.aifc', '.aiff', '.amr', '.au', 
      '.avi', '.cda', '.m4a', '.mid', '.mp3', '.mp4', '.mpeg', 
      '.ogg', '.opus', '.ra', '.ram', '.snd', '.wav', '.wma'
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

    // Validate file types by extension
    const invalidFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return !supportedExtensions.includes(ext);
    });
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

    // Start generation with Zustand store
    startGeneration(podcastMode, customText, uploadedFiles);

    try {
      updateProgress('Đang gửi yêu cầu đến hệ thống...');

      // Prepare form data based on podcast mode
      let response;
      
      if (podcastMode === 'documents') {
        const formData = new FormData();
        uploadedFiles.forEach(file => {
          formData.append('files', file);
        });
        
        updateProgress('Đang tải lên tài liệu và xử lý...');
        response = await apiService.generateAdvancedAudioWithFiles(formData);
      } else {
        updateProgress('Đang phân tích nội dung văn bản...');
        response = await apiService.generateAdvancedAudio({
          custom_text: customText.trim()
        });
      }

      // Complete generation (keep files/text for user to edit or reuse)
      completeGeneration();
      
      // Show success notification with actual result
      if (response.success) {
        notify.success(response.message, {
          title: '✅ Hoàn thành',
          duration: 10000
        });
      } else {
        notify.error(response.message, {
          title: '❌ Lỗi',
          duration: 10000
        });
      }

    } catch (error) {
      completeGeneration();
      notify.error(`Lỗi: ${error.message}`, {
        title: '❌ Lỗi hệ thống',
        duration: 10000
      });
    }
  };

  const settingsConfig = {
    title: "Cấu Hình Mô Hình AI",
    engineName: "FOXAi Advanced Podcast Engine",
    engineDescription: "Chuyển đổi văn bản và tài liệu thành podcast hội thoại tự nhiên với hai diễn giả AI chuyên nghiệp.",
    expertInfo: {
      title: "Chuyên Gia Podcast",
      name: "Senior Podcast Producer",
      description: "Chuyên gia sản xuất podcast với hơn 10 năm kinh nghiệm trong lĩnh vực audio và truyền thông.\n\nKhả năng:\n• Chuyển đổi nội dung văn bản thành podcast\n• Tạo hội thoại tự nhiên và hấp dẫn\n• Phân tích và tổng hợp nội dung chuyên sâu\n• Sản xuất audio chất lượng cao"
    },
    showClearButton: false
  };

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
        />
      </div>

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
                      {customText.length} ký tự {customText.length > 10000 && '( Nội dung rất dài)'}
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
                          accept=".pdf,.txt,.md,.3g2,.3gp,.aac,.aif,.aifc,.aiff,.amr,.au,.avi,.cda,.m4a,.mid,.mp3,.mp4,.mpeg,.ogg,.opus,.ra,.ram,.snd,.wav,.wma"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                          disabled={isGeneratingNotebook}
                        />
                        <label 
                          htmlFor="documentUpload" 
                          className={styles.browseButton}
                          style={{ pointerEvents: isGeneratingNotebook ? 'none' : 'auto', opacity: isGeneratingNotebook ? 0.6 : 1 }}
                        >
                          Chọn Tài Liệu
                        </label>
                      </div>
                      <div className={styles.dropZoneInfo}>
                        <p>Hỗ trợ: PDF, Text, Markdown, Audio (MP3, WAV, M4A, AAC, OGG...), Video (MP4, AVI, MPEG...)</p>
                        <p>Có thể chọn nhiều files cùng lúc</p>
                        <p>Tối đa 10 files, mỗi file không quá 10MB</p>
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
                          className={styles.clearFilesButton}
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
                      Đang Xử Lý...
                    </>
                  ) : (
                    'Tạo Podcast Thông Minh'
                  )}
                </button>
              </div>

              {/* Info */}
              <div className={styles.infoBox}>
                <div>
                  <strong>Công Nghệ Hoạt Động:</strong> {podcastMode === 'text' ? 'Dán nội dung chuyên sâu vào ô trên' : 'Tải lên tài liệu của bạn'} và nhấn "Tạo Podcast Thông Minh". Hệ thống AI sẽ tự động tạo ra podcast chất lượng cao.
                </div>
              </div>
              <div className={styles.alternativeBox}>
                <span>Thời gian xử lý: <strong>15-45 phút</strong> tùy thuộc độ dài nội dung</span>
              </div>
            </form>
          </div>
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