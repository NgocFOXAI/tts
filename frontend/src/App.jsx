import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

import HomePage from './components/HomePage';
import ChatInterface from './components/ChatInterface';
import PodcastGenerator from './components/PodcastGenerator';
import FileManager from './components/FileManager';
import SmartReport from './components/SmartReport';
import DataAnalysis from './components/DataAnalysis';
import NotificationManager, { useNotifications } from './components/common/NotificationManager';
import GlobalProgressBar from './components/common/GlobalProgressBar';
import styles from './styles/App.module.css';

const foxaiLogo = '/static/logo/foxai-logo-3.png';

function AppContent() {
  const [generatedText, setGeneratedText] = useState('');
  const [activeSubTab, setActiveSubTab] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { notifications, notify, removeNotification } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);

  const tabs = [
    { 
      id: 'data-analysis', 
      label: 'Phân Tích Dữ Liệu', 
      path: '/data-analysis',
      subTabs: [
        { id: 'data-analysis-chart', label: 'Tạo Biểu Đồ Báo Cáo', path: '/data-analysis?mode=chart' }
      ]
    },
    { 
      id: 'podcast', 
      label: 'Podcast Thông Minh', 
      path: '/podcast',
      subTabs: [
        { id: 'podcast-text', label: 'Podcast Văn Bản', path: '/podcast?mode=text' },
        { id: 'podcast-docs', label: 'Podcast Tài Liệu', path: '/podcast?mode=documents' }
      ]
    },
    { 
      id: 'files', 
      label: 'Quản Lý File', 
      path: '/files',
      subTabs: [
        { id: 'files-docs', label: 'File Tài Liệu', path: '/files?tab=documents' },
        { id: 'files-audio', label: 'File Podcast', path: '/files?tab=audio' },
        { id: 'files-reports', label: 'File Báo cáo', path: '/files?tab=reports' }
      ]
    },
  ];

  // Handle click outside to hide sub-tabs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setActiveSubTab(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleTextGenerated = (text) => {
    setGeneratedText(text);
  };

  const isHomePage = location.pathname === '/';

  return (
    <div className={styles.app}>
      <NotificationManager 
        notifications={notifications} 
        onRemove={removeNotification} 
      />

      {/* Global Progress Bar - Shows on all pages */}
      <GlobalProgressBar />

      {!isHomePage && (
        <div className={styles.chatTabSwitcher} ref={navRef}>
          <div className={styles.container}>
            <div className={styles.headerLogo} onClick={() => navigate('/')} style={{ cursor: 'pointer' }} title="Về Trang Chủ">
              <img src={foxaiLogo} alt="FOXAI Logo" className={styles.logoImage} />
            </div>

            <div className={styles.tabs}>
              {tabs.map(tab => (
                <div key={tab.id} className={`${styles.tabContainer} ${location.pathname === tab.path ? styles.active : ''}`}>
                  <button
                    className={`${styles.tabButton} ${location.pathname === tab.path ? styles.active : ''}`}
                    onClick={() => {
                      if (tab.url) {
                        window.open(tab.url, '_blank');
                      } else {
                        navigate(tab.path);
                      }
                    }}
                    onMouseEnter={() => {
                      if (tab.subTabs) {
                        setActiveSubTab(tab.id);
                      }
                    }}
                  >
                    {tab.label}
                    {tab.subTabs && (
                      <span className={styles.dropdownArrow}>▼</span>
                    )}
                  </button>
                  {tab.subTabs && activeSubTab === tab.id && (
                    <div className={styles.subTabs}>
                    {tab.subTabs.map(subTab => (
                      <button
                        key={subTab.id}
                        className={`${styles.subTabButton} ${location.pathname + location.search === subTab.path ? styles.active : ''}`}
                        onClick={() => navigate(subTab.path)}
                      >
                        {subTab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <Routes>
          <Route path="/" element={<HomePage onNavigate={(path) => navigate(`/${path === 'generator' ? 'data-analysis' : path === 'tts' ? 'podcast' : path}`)} />} />
          <Route path="/data-analysis" element={<DataAnalysis notify={notify} />} />
          <Route path="/podcast" element={<PodcastGenerator notify={notify} />} />
          <Route path="/files" element={<FileManager notify={notify} />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
