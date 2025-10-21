import React, { useState, useEffect, useCallback } from 'react';

import env from '../config/environment';
import './AudioManager.css';

const AudioManager = () => {
    const [files, setFiles] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showCleanupModal, setShowCleanupModal] = useState(false);
    const [showResultModal, setShowResultModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [modalMessage, setModalMessage] = useState('');
    const [resultMessage, setResultMessage] = useState('');

    const API_BASE = env.api.baseUrl;

    // Fetch files from API
    const fetchFiles = useCallback(async () => {
        try {
            setLoading(true);
            const url = `${API_BASE}/audio/files`;
            console.log('🔍 Fetching files from:', url);
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
            setFiles(data);
            setError(null);
        } catch (err) {
            setError(`Failed to fetch files: ${err.message}`);
            console.error('Error fetching files:', err);
        } finally {
            setLoading(false);
        }
    }, [API_BASE]);

    // Fetch statistics
    const fetchStats = useCallback(async () => {
        try {
            const url = `${API_BASE}/audio/stats`;
            console.log('🔍 Fetching stats from:', url);
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
            setStats(data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, [API_BASE]);

    // Delete a file
    const deleteFile = async (filename) => {
        setSelectedFile(filename);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!selectedFile) return;

        try {
            const url = `${API_BASE}/audio/files/${encodeURIComponent(selectedFile)}`;
            console.log('Deleting file:', url);
            const response = await fetch(url, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            setShowDeleteModal(false);
            setSelectedFile(null);
            
            // Show success result
            setResultMessage(`Đã xóa thành công file "${selectedFile}"`);
            setShowResultModal(true);
            
            // Refresh the file list
            await fetchFiles();
            await fetchStats();
        } catch (err) {
            setShowDeleteModal(false);
            setResultMessage(`Lỗi khi xóa file: ${err.message}`);
            setShowResultModal(true);
        }
    };

    // Cleanup old files
    const cleanupOldFiles = async (days = 7) => {
        setShowCleanupModal(true);
    };

    const confirmCleanup = async () => {
        try {
            const url = `${API_BASE}/audio/cleanup?days=7`;
            console.log('Cleanup URL:', url);
            const response = await fetch(url, {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            setShowCleanupModal(false);
            
            // Show result
            if (result.count > 0) {
                setResultMessage(`Dọn dẹp hoàn tất! Đã xóa ${result.count} file cũ hơn 7 ngày.`);
            } else {
                setResultMessage('Không có file nào cần dọn dẹp. Tất cả file đều còn mới.');
            }
            setShowResultModal(true);
            
            // Refresh the file list
            await fetchFiles();
            await fetchStats();
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

    useEffect(() => {
        fetchFiles();
        fetchStats();
    }, [fetchFiles, fetchStats]);

    if (loading) {
        return (
            <div className="audio-manager">
                <div className="loading">Đang tải thư viện âm thanh...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="audio-manager">
                <div className="error">
                    <p>Lỗi: {error}</p>
                    <button onClick={fetchFiles} className="retry-btn">
                        Thử Lại
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="audio-manager">
            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Xác nhận xóa file</h3>
                        <p>Bạn có chắc chắn muốn xóa file này?</p>
                        <p className="modal-filename">"{selectedFile}"</p>
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

            {/* Cleanup Confirmation Modal */}
            {showCleanupModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Dọn dẹp file cũ</h3>
                        <p>Xóa tất cả file đã tồn tại trên hệ thống hơn 7 ngày.</p>
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

            {/* Result Modal */}
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

            <div className="header">
                <div className="header-title">
                    <h2>Thư Viện Âm Thanh</h2>
                    <p className="header-subtitle">Quản lý và tải xuống các file âm thanh đã tạo</p>
                </div>
                <div className="actions">
                    <button onClick={fetchFiles} className="refresh-btn">
                        Làm Mới
                    </button>
                    <button onClick={() => cleanupOldFiles(7)} className="cleanup-btn">
                        Dọn Dẹp (7+ ngày)
                    </button>
                </div>
            </div>

            <div className="stats-container">
                <div className="stat-card">
                    <div className="stat-label">Tổng File</div>
                    <div className="stat-value">{stats.total_files || 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">File Âm Thanh</div>
                    <div className="stat-value">{stats.audio_files || 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Dung Lượng</div>
                    <div className="stat-value">{formatFileSize(stats.total_size_bytes || 0)}</div>
                </div>
            </div>

            {files.length === 0 ? (
                <div className="no-files">
                    <p>Thư viện âm thanh hiện đang trống</p>
                    <p className="tip">Các file sẽ xuất hiện tại đây sau khi bạn tạo nội dung âm thanh</p>
                </div>
            ) : (
                <div className="file-list">
                    <div className="file-list-header">
                        <div className="col-name">Tên File</div>
                        <div className="col-info">Thông Tin</div>
                        <div className="col-actions">Thao Tác</div>
                    </div>
                    {files.map((file, index) => (
                        <div key={index} className={`file-item ${file.is_audio ? 'audio-file' : ''}`}>
                            <div className="file-name-col">
                                <strong>{file.name}</strong>
                            </div>
                            <div className="file-info-col">
                                <span className="file-size">{formatFileSize(file.size)}</span>
                                <span className="file-date">{formatDate(file.modified)}</span>
                            </div>
                            <div className="file-actions-col">
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
                                <button
                                    onClick={() => deleteFile(file.name)}
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

export default AudioManager;