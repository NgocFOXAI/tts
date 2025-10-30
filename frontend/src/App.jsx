import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

import HomePage from './components/HomePage';
import ChatInterface from './components/ChatInterface';
import PodcastGenerator from './components/PodcastGenerator';
import FileManager from './components/FileManager';
import SmartReport from './components/SmartReport';
import NotificationManager, { useNotifications } from './components/common/NotificationManager';
import styles from './styles/App.module.css';

const foxaiLogo = '/static/logo/foxai-logo-3.png';

function AppContent() {
  const [generatedText, setGeneratedText] = useState('');
  const [activeSubTab, setActiveSubTab] = useState(null);
  const { notifications, notify, removeNotification } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);

  const tabs = [
    { id: 'chat', label: 'Trí Tuệ Nhân Tạo', path: '/chat' },
    { 
      id: 'podcast', 
      label: 'Tạo Podcast Thông Minh', 
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
      component: <FileManager notify={notify} />,
      subTabs: [
        { id: 'files-docs', label: 'Tài Liệu', path: '/files?tab=documents' },
        { id: 'files-audio', label: 'Âm Thanh', path: '/files?tab=audio' }
      ]
    },
    { 
      id: 'report', 
      label: 'Báo Cáo Thông Minh', 
      path: '/report',
      subTabs: [
        { id: 'report-create', label: 'Tạo Báo Cáo', path: '/report?mode=create' },
        { id: 'report-manage', label: 'Quản Lý File', path: '/report?mode=manage' }
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

      {!isHomePage && (
        <div className={styles.chatTabSwitcher} ref={navRef}>
          <div className={styles.container}>
            <div className={styles.headerLogo}>
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
          <Route path="/" element={<HomePage onNavigate={(path) => navigate(`/${path === 'generator' ? 'chat' : path === 'tts' ? 'podcast' : path}`)} />} />
          <Route path="/chat" element={<ChatInterface onTextGenerated={handleTextGenerated} notify={notify} />} />
          <Route path="/podcast" element={<PodcastGenerator notify={notify} />} />
          <Route path="/files" element={<FileManager notify={notify} />} />
          <Route path="/report" element={<SmartReport notify={notify} />} />
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
