import React, { useState, useEffect, useCallback } from 'react';

import env from '../config/environment';
import './AudioManager.css';

const AudioManager = () => {
    const [files, setFiles] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
        if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa vĩnh viễn tài liệu "${filename}"?\n\n📋 Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            const url = `${API_BASE}/audio/files/${encodeURIComponent(filename)}`;
            console.log('🔍 Deleting file:', url);
            const response = await fetch(url, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Refresh the file list
            await fetchFiles();
            await fetchStats();
        } catch (err) {
            alert(`❌ Lỗi xóa tài liệu: ${err.message}\n\n🔧 Vui lòng thử lại hoặc liên hệ hỗ trợ kỹ thuật.`);
        }
    };

    // Cleanup old files
    const cleanupOldFiles = async (days = 7) => {
        if (!window.confirm(`🗑️ Xác nhận dọn dẹp tự động?\n\n📅 Sẽ xóa tất cả tài liệu cũ hơn ${days} ngày.\n⚠️ Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            const url = `${API_BASE}/audio/cleanup?days=${days}`;
            console.log('🔍 Cleanup URL:', url);
            const response = await fetch(url, {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            alert(`✅ Dọn dẹp hoàn tất!\n\n📊 Đã xóa ${result.count} tài liệu cũ.\n💾 Dung lượng đã được tối ưu hóa.`);
            // Refresh the file list
            await fetchFiles();
            await fetchStats();
        } catch (err) {
            alert(`❌ Dọn dẹp thất bại: ${err.message}\n\n🔧 Vui lòng kiểm tra kết nối mạng và thử lại.`);
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
                <div className="loading">⏳ Đang tải thư viện âm thanh...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="audio-manager">
                <div className="error">
                    <p>❌ Lỗi hệ thống: {error}</p>
                    <button onClick={fetchFiles} className="retry-btn">
                        🔄 Thử Lại
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="audio-manager">
            <div className="header">
                <h2>🎵 Trung Tâm Quản Lý Thư Viện Âm Thanh Chuyên Nghiệp</h2>
                <div className="stats">
                    <span className="stat">📁 Tổng Tài Liệu: {stats.total_files || 0}</span>
                    <span className="stat">🎶 File Âm Thanh: {stats.audio_files || 0}</span>
                    <span className="stat">💾 Dung Lượng Sử Dụng: {formatFileSize(stats.total_size_bytes || 0)}</span>
                </div>
                <div className="actions">
                    <button onClick={fetchFiles} className="refresh-btn">
                        🔄 Làm Mới Dữ Liệu
                    </button>
                    <button onClick={() => cleanupOldFiles(7)} className="cleanup-btn">
                        🗑️ Dọn Dẹp Tự Động (7+ ngày)
                    </button>
                </div>
            </div>

            {files.length === 0 ? (
                <div className="no-files">
                    <p>📂 Thư viện âm thanh hiện đang trống</p>
                    <p className="tip">💡 Các file sẽ xuất hiện tại đây sau khi bạn tạo nội dung âm thanh thông qua hệ thống</p>
                </div>
            ) : (
                <div className="file-list">
                    {files.map((file, index) => (
                        <div key={index} className={`file-item ${file.is_audio ? 'audio-file' : ''}`}>
                            <div className="file-info">
                                <div className="file-name">
                                    {file.is_audio && <span className="audio-icon">🎵</span>}
                                    <strong>{file.name}</strong>
                                </div>
                                <div className="file-meta">
                                    <span className="file-size">{formatFileSize(file.size)}</span>
                                    <span className="file-date">{formatDate(file.modified)}</span>
                                    <span className="file-type">{file.mime_type}</span>
                                </div>
                            </div>
                            <div className="file-actions">
                                <a
                                    href={`${API_BASE}${file.download_url}`}
                                    download
                                    className="download-btn"
                                    title="Tải xuống tài liệu"
                                >
                                    📥 Tải Xuống
                                </a>
                                {file.is_audio && (
                                    <audio controls className="audio-player">
                                        <source src={`${API_BASE}${file.download_url}`} type={file.mime_type} />
                                        🔊 Trình duyệt không hỗ trợ phát nhạc trực tiếp
                                    </audio>
                                )}
                                <button
                                    onClick={() => deleteFile(file.name)}
                                    className="delete-btn"
                                    title="Xóa tài liệu vĩnh viễn"
                                >
                                    🗑️ Xóa Bỏ
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="footer">
                <p className="storage-path">💾 Vị Trí Lưu Trữ: {stats.directory}</p>
            </div>
        </div>
    );
};

export default AudioManager;