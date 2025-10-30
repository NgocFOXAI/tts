import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

import env from '../config/environment';
import './FileManager.css';

const FileManager = ({ notify }) => {
    const location = useLocation();
    
    // Get tab from URL parameters
    const getTabFromUrl = () => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        return ['audio', 'documents'].includes(tab) ? tab : 'documents';
    };

    const [activeTab, setActiveTab] = useState(getTabFromUrl());
    const [audioFiles, setAudioFiles] = useState([]);
    const [documentFiles, setDocumentFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showCleanupModal, setShowCleanupModal] = useState(false);
    const [showResultModal, setShowResultModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [modalMessage, setModalMessage] = useState('');
    const [resultMessage, setResultMessage] = useState('');
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [showFileSelector, setShowFileSelector] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    const API_BASE = env.api.baseUrl;

    // Handle tab change and update URL
    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        const params = new URLSearchParams(window.location.search);
        params.set('tab', newTab);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ tab: newTab }, '', newUrl);
    };

    // Listen for browser back/forward navigation
    useEffect(() => {
        const handlePopState = () => {
            setActiveTab(getTabFromUrl());
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Listen for URL changes (when sub-tabs are clicked from header)
    useEffect(() => {
        setActiveTab(getTabFromUrl());
    }, [location.search]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.simple-dropdown') && !event.target.closest('.generate-btn')) {
                setShowFileSelector(false);
            }
        };

        if (showFileSelector) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showFileSelector]);

    // Calculate stats from audio files
    const calculateAudioStats = () => {
        const totalFiles = audioFiles.length;
        const audioFilesCount = audioFiles.filter(file => file.is_audio).length;
        const totalSize = audioFiles.reduce((sum, file) => sum + (file.size || 0), 0);
        
        return {
            total_files: totalFiles,
            audio_files: audioFilesCount,
            total_size_bytes: totalSize
        };
    };

    // Fetch audio files from API
    const fetchAudioFiles = useCallback(async () => {
        try {
            const url = `${API_BASE}/audio/files`;
            console.log('🔍 Fetching audio files from:', url);
            const response = await fetch(url, {
                headers: {
                    'ngrok-skip-browser-warning': 'true',
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setAudioFiles(data);
        } catch (err) {
            console.error('Error fetching audio files:', err);
            if (activeTab === 'audio') {
                setError(`Failed to fetch audio files: ${err.message}`);
            }
        }
    }, [API_BASE, activeTab]);

    // Fetch document files
    const fetchDocumentFiles = useCallback(async () => {
        try {
            const url = `${API_BASE}/documents/list`;
            console.log('🔍 Fetching documents from:', url);
            const response = await fetch(url, {
                headers: {
                    'ngrok-skip-browser-warning': 'true',
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('📄 Documents response:', data);
            
            // Handle different response formats
            if (data.success && data.documents) {
                console.log('📄 Using data.documents:', data.documents);
                setDocumentFiles(data.documents);
            } else if (data.files) {
                console.log('📄 Using data.files:', data.files);
                setDocumentFiles(data.files);
            } else if (Array.isArray(data)) {
                console.log('📄 Using array data:', data);
                setDocumentFiles(data);
            } else {
                console.log('📄 No files found, setting empty array. Full response:', data);
                setDocumentFiles([]);
            }
        } catch (err) {
            console.error('Error fetching documents:', err);
            if (activeTab === 'documents') {
                setError(`Failed to fetch documents: ${err.message}`);
            }
        }
    }, [API_BASE, activeTab]);

    // Delete audio file
    const deleteAudioFile = async (filename) => {
        try {
            const url = `${API_BASE}/audio/files/${encodeURIComponent(filename)}`;
            const response = await fetch(url, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            setResultMessage(`Đã xóa thành công file âm thanh "${filename}"`);
            setShowResultModal(true);
            await fetchAudioFiles();
        } catch (err) {
            setResultMessage(`Lỗi khi xóa file âm thanh: ${err.message}`);
            setShowResultModal(true);
        }
    };

    // Delete document file
    const deleteDocumentFile = async (filename) => {
        try {
            const url = `${API_BASE}/documents/delete`;
            const response = await fetch(url, { 
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([filename])  // Send as array
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success) {
                setResultMessage(`Đã xóa thành công tài liệu "${filename}"`);
            } else {
                setResultMessage(`Xóa tài liệu thất bại: ${result.message}`);
            }
            setShowResultModal(true);
            await fetchDocumentFiles();
        } catch (err) {
            setResultMessage(`Lỗi khi xóa tài liệu: ${err.message}`);
            setShowResultModal(true);
        }
    };

    // Handle file delete
    const deleteFile = async (filename, type = 'audio') => {
        setSelectedFile({ name: filename, type });
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!selectedFile) return;

        setShowDeleteModal(false);
        
        if (selectedFile.type === 'audio') {
            await deleteAudioFile(selectedFile.name);
        } else {
            await deleteDocumentFile(selectedFile.name);
        }
        
        setSelectedFile(null);
    };

    // Upload documents
    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
        setUploadFiles(files);
        setShowUploadModal(true);
    };

    const confirmUpload = async () => {
        if (uploadFiles.length === 0) return;

        setUploading(true);
        try {
            const formData = new FormData();
            uploadFiles.forEach(file => {
                formData.append('files', file);
            });

            const url = `${API_BASE}/documents/upload`;
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            setShowUploadModal(false);
            setUploadFiles([]);
            
            if (result.success) {
                setResultMessage(`Đã tải lên thành công ${result.uploaded_files?.length || uploadFiles.length} tài liệu!`);
                if (notify && typeof notify === 'function') {
                    notify(`Đã tải lên ${result.uploaded_files?.length || uploadFiles.length} tài liệu`, 'success');
                }
            } else {
                setResultMessage(`Tải lên thất bại: ${result.message}`);
            }
            setShowResultModal(true);
            
            await fetchDocumentFiles();
        } catch (err) {
            setResultMessage(`Lỗi khi tải lên: ${err.message}`);
            setShowResultModal(true);
        } finally {
            setUploading(false);
        }
    };

    // Generate conversation from documents
    const generateConversation = () => {
        if (documentFiles.length === 0) {
            setResultMessage('Không có tài liệu nào để tạo cuộc trò chuyện!');
            setShowResultModal(true);
            return;
        }
        // Only reset if no files selected yet
        if (selectedFiles.length === 0) {
            setSelectedFiles([]);
        }
        setShowFileSelector(true);
    };

    const confirmGenerate = async () => {
        if (selectedFiles.length === 0) return;

        setGenerating(true);
        try {
            const url = `${API_BASE}/documents/generate-conversation`;
            
            // Create AbortController for custom timeout (50 minutes to match backend + buffer)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000000); // 50 minutes
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filenames: selectedFiles
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            setShowGenerateModal(false);
            
            if (result.success) {
                setResultMessage(`Bắt đầu tạo cuộc trò chuyện từ ${selectedFiles.length} tài liệu! Quá trình có thể mất 15-40 phút. Hãy kiểm tra thư mục Downloads khi hoàn thành.`);
                if (notify && typeof notify === 'function') {
                    notify('Đang tạo cuộc trò chuyện...', 'info');
                }
            } else {
                setResultMessage(`Tạo cuộc trò chuyện thất bại: ${result.message}`);
            }
            setShowResultModal(true);
            
        } catch (err) {
            if (err.name === 'AbortError') {
                setResultMessage(`Timeout: Quá trình tạo cuộc trò chuyện đã vượt quá thời gian chờ (50 phút). Vui lòng thử lại hoặc giảm số lượng tài liệu.`);
            } else {
                setResultMessage(`Lỗi khi tạo cuộc trò chuyện: ${err.message}`);
            }
            setShowResultModal(true);
        } finally {
            setGenerating(false);
        }
    };

    // Cleanup old audio files
    const cleanupOldFiles = async () => {
        setShowCleanupModal(true);
    };

    const confirmCleanup = async () => {
        try {
            const url = `${API_BASE}/audio/cleanup?days=7`;
            const response = await fetch(url, { method: 'POST' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            setShowCleanupModal(false);
            
            if (result.count > 0) {
                setResultMessage(`Dọn dẹp hoàn tất! Đã xóa ${result.count} file âm thanh cũ hơn 7 ngày.`);
            } else {
                setResultMessage('Không có file âm thanh nào cần dọn dẹp.');
            }
            setShowResultModal(true);
            
            await fetchAudioFiles();
        } catch (err) {
            setShowCleanupModal(false);
            setResultMessage(`Lỗi khi dọn dẹp: ${err.message}`);
            setShowResultModal(true);
        }
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format date
    const formatDate = (isoString) => {
        return new Date(isoString).toLocaleString();
    };

    // Load data based on active tab
    useEffect(() => {
        setLoading(true);
        setError(null);
        
        const loadData = async () => {
            try {
                if (activeTab === 'audio') {
                    await fetchAudioFiles();
                } else {
                    await fetchDocumentFiles();
                }
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [activeTab, fetchAudioFiles, fetchDocumentFiles]);

    const currentFiles = activeTab === 'audio' ? audioFiles : documentFiles;
    const audioStats = calculateAudioStats();

    if (loading) {
        return (
            <div className="file-manager">
                <div className="loading">Đang tải quản lý file...</div>
            </div>
        );
    }

    return (
        <div className="file-manager">
            {/* Modals */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Xác nhận xóa file</h3>
                        <p>Bạn có chắc chắn muốn xóa file này?</p>
                        <p className="modal-filename">"{selectedFile?.name}"</p>
                        <p className="modal-warning">Hành động này không thể hoàn tác.</p>
                        <div className="modal-actions">
                            <button onClick={() => { setShowDeleteModal(false); setSelectedFile(null); }} className="modal-btn cancel">
                                Hủy
                            </button>
                            <button onClick={confirmDelete} className="modal-btn confirm">
                                Xóa File
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showUploadModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Tải lên tài liệu</h3>
                        <p>Bạn sắp tải lên {uploadFiles.length} file:</p>
                        <ul className="upload-file-list">
                            {uploadFiles.map((file, index) => (
                                <li key={index}>{file.name} ({formatFileSize(file.size)})</li>
                            ))}
                        </ul>
                        <div className="modal-actions">
                            <button onClick={() => { setShowUploadModal(false); setUploadFiles([]); }} className="modal-btn cancel" disabled={uploading}>
                                Hủy
                            </button>
                            <button onClick={confirmUpload} className="modal-btn confirm" disabled={uploading}>
                                {uploading ? 'Đang tải lên...' : 'Tải lên'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showGenerateModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Tạo cuộc trò chuyện</h3>
                        <p>Tạo cuộc trò chuyện âm thanh từ các tài liệu đã chọn:</p>
                        <div className="selected-files">
                            {selectedFiles.map((filename, index) => (
                                <label key={index} className="file-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={true}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedFiles([...selectedFiles, filename]);
                                            } else {
                                                setSelectedFiles(selectedFiles.filter(f => f !== filename));
                                            }
                                        }}
                                    />
                                    {filename}
                                </label>
                            ))}
                        </div>
                        <p className="modal-warning">Quá trình tạo có thể mất 15-40 phút.</p>
                        <div className="modal-actions">
                            <button onClick={() => setShowGenerateModal(false)} className="modal-btn cancel" disabled={generating}>
                                Hủy
                            </button>
                            <button onClick={confirmGenerate} className="modal-btn confirm" disabled={generating || selectedFiles.length === 0}>
                                {generating ? 'Đang tạo...' : 'Tạo cuộc trò chuyện'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCleanupModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Dọn dẹp file cũ</h3>
                        <p>Xóa tất cả file âm thanh đã tồn tại trên hệ thống hơn 7 ngày.</p>
                        <p className="modal-warning">Hành động này không thể hoàn tác.</p>
                        <div className="modal-actions">
                            <button onClick={() => setShowCleanupModal(false)} className="modal-btn cancel">
                                Hủy
                            </button>
                            <button onClick={confirmCleanup} className="modal-btn confirm">
                                Xác nhận dọn dẹp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showResultModal && (
                <div className="modal-overlay" onClick={() => setShowResultModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Thông báo</h3>
                        <p className="modal-result-message">{resultMessage}</p>
                        <div className="modal-actions">
                            <button onClick={() => setShowResultModal(false)} className="modal-btn confirm">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="header">
                <div className="header-title">
                    <h2>Quản Lý File</h2>
                    <p className="header-subtitle">Quản lý tài liệu và file âm thanh</p>
                </div>
            </div>

            {/* Actions */}
            <div className="actions">
                {activeTab === 'documents' && (
                    <>
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.txt,.md"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            id="file-upload"
                        />
                        <label htmlFor="file-upload" className="upload-btn">
                            Tải Lên Tài Liệu
                        </label>
                        <button 
                            onClick={() => setShowFileSelector(!showFileSelector)} 
                            className="generate-btn"
                            disabled={documentFiles.length === 0}
                        >
                            Tạo Cuộc Trò Chuyện {documentFiles.length > 0 && '▼'}
                        </button>
                        {showFileSelector && documentFiles.length > 0 && (
                            <div className="simple-dropdown">
                                <div className="dropdown-content">
                                    <div className="file-selection">
                                        <p><strong>Chọn tài liệu ({documentFiles.length} files):</strong></p>
                                        {documentFiles.map((file, index) => {
                                            const fileName = file.name || file.filename;
                                            const isSelected = selectedFiles.includes(fileName);
                                            return (
                                                <div key={index} className="file-selection-item">
                                                    <input
                                                        type="checkbox"
                                                        id={`file-${index}`}
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedFiles([...selectedFiles, fileName]);
                                                            } else {
                                                                setSelectedFiles(selectedFiles.filter(f => f !== fileName));
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor={`file-${index}`} className="file-selection-name">
                                                        {fileName}
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="dropdown-buttons">
                                        <button 
                                            onClick={() => {
                                                if (selectedFiles.length > 0) {
                                                    setShowGenerateModal(true);
                                                    setShowFileSelector(false);
                                                }
                                            }}
                                            disabled={selectedFiles.length === 0}
                                            className="start-btn"
                                        >
                                            Bắt đầu ({selectedFiles.length})
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const allFileNames = documentFiles.map(f => f.name || f.filename);
                                                console.log('Select all clicked, files:', allFileNames);
                                                setSelectedFiles(allFileNames);
                                            }}
                                            className="select-all"
                                        >
                                            Chọn tất cả
                                        </button>
                                        <button 
                                            onClick={() => {
                                                console.log('Current selectedFiles:', selectedFiles);
                                                alert(`Selected: ${selectedFiles.length} files: ${selectedFiles.join(', ')}`);
                                            }}
                                            className="test-btn"
                                        >
                                            Test Selection
                                        </button>
                                        <button 
                                            onClick={() => setSelectedFiles([])}
                                            className="clear-all"
                                        >
                                            Bỏ chọn
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <button onClick={fetchDocumentFiles} className="refresh-btn">
                            Làm Mới
                        </button>
                    </>
                )}
                {activeTab === 'audio' && (
                    <>
                        <button onClick={fetchAudioFiles} className="refresh-btn">
                            Làm Mới
                        </button>
                        <button onClick={cleanupOldFiles} className="cleanup-btn">
                            Dọn Dẹp (7+ ngày)
                        </button>
                    </>
                )}
            </div>

            {/* Stats */}
            {activeTab === 'audio' && (
                <div className="stats-container">
                    <div className="stat-card">
                        <div className="stat-label">Tổng File</div>
                        <div className="stat-value">{audioStats.total_files || 0}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">File Âm Thanh</div>
                        <div className="stat-value">{audioStats.audio_files || 0}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Dung Lượng</div>
                        <div className="stat-value">{formatFileSize(audioStats.total_size_bytes || 0)}</div>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="error">
                    <p>Lỗi: {error}</p>
                    <button onClick={() => window.location.reload()} className="retry-btn">
                        Thử Lại
                    </button>
                </div>
            )}

            {/* File List */}
            {currentFiles.length === 0 ? (
                <div className="no-files">
                    <p>{activeTab === 'audio' ? 'Thư viện âm thanh hiện đang trống' : 'Chưa có tài liệu nào được tải lên'}</p>
                    <p className="tip">
                        {activeTab === 'audio' 
                            ? 'Các file âm thanh sẽ xuất hiện tại đây sau khi bạn tạo nội dung âm thanh'
                            : 'Tải lên tài liệu để bắt đầu tạo cuộc trò chuyện âm thanh'
                        }
                    </p>
                </div>
            ) : (
                <div className="file-list">
                    <div className="file-list-header">
                        <div className="col-name">Tên File</div>
                        <div className="col-info">Thông Tin</div>
                        <div className="col-actions">Thao Tác</div>
                    </div>
                    {currentFiles.map((file, index) => (
                        <div key={index} className={`file-item ${file.is_audio || activeTab === 'audio' ? 'audio-file' : 'document-file'}`}>
                            <div className="file-name-col">
                                <strong>{file.name || file.filename}</strong>
                                {activeTab === 'documents' && (file.type || file.file_type) && (
                                    <span className="file-type">{file.type || file.file_type}</span>
                                )}
                            </div>
                            <div className="file-info-col">
                                <span className="file-size">{formatFileSize(file.size || file.file_size)}</span>
                                <span className="file-date">{formatDate(file.modified || file.upload_time)}</span>
                            </div>
                            <div className="file-actions-col">
                                {activeTab === 'audio' && (
                                    <>
                                        <a
                                            href={`${API_BASE}${file.download_url}`}
                                            download
                                            className="download-btn"
                                            title="Tải xuống"
                                        >
                                            Tải Xuống
                                        </a>
                                        {file.is_audio && (
                                            <audio controls className="audio-player">
                                                <source src={`${API_BASE}${file.download_url}`} type={file.mime_type} />
                                                Trình duyệt không hỗ trợ
                                            </audio>
                                        )}
                                    </>
                                )}
                                {activeTab === 'documents' && (
                                    <a
                                        href={`${API_BASE}${file.download_url || `/documents/download/${encodeURIComponent(file.name || file.filename)}`}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="download-btn"
                                        title="Tải xuống tài liệu"
                                    >
                                        Tải Xuống
                                    </a>
                                )}
                                <button
                                    onClick={() => deleteFile(file.name || file.filename, activeTab)}
                                    className="delete-btn"
                                    title="Xóa file"
                                >
                                    Xóa
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FileManager;