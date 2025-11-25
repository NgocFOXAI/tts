import { useEffect, useState } from 'react';

import { usePodcastStore } from '../../stores/podcastStore';
import styles from '../../styles/GlobalProgressBar.module.css';

const GlobalProgressBar = () => {
  const { 
    isGenerating,
    generationProgress,
    getElapsedSeconds
  } = usePodcastStore();

  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Initialize elapsed time on mount (in case of page reload)
  useEffect(() => {
    if (isGenerating) {
      setElapsedTime(getElapsedSeconds());
    }
  }, []);

  // Update elapsed time every second
  useEffect(() => {
    if (!isGenerating) {
      setElapsedTime(0);
      return;
    }

    // Set initial time
    setElapsedTime(getElapsedSeconds());

    const interval = setInterval(() => {
      setElapsedTime(getElapsedSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating, getElapsedSeconds]);

  if (!isGenerating) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`${styles.bottomProgressBar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.progressContent}>
        <div className={styles.progressIcon}>
          <span className={styles.loadingSpinner}></span>
        </div>
        {!isCollapsed && (
          <div className={styles.progressText}>
            <div className={styles.progressTitle}>
              {generationProgress || 'Đang xử lý yêu cầu tạo podcast...'}
            </div>
            <div className={styles.progressSubtitle}>
              Thời gian: {formatTime(elapsedTime)} | Bạn có thể tiếp tục sử dụng các tính năng khác
            </div>
          </div>
        )}
        <button 
          className={styles.collapseButton}
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Mở rộng' : 'Thu nhỏ'}
        >
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>
    </div>
  );
};

export default GlobalProgressBar;
