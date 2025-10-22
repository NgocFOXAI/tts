import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

import HomePage from './components/HomePage';
import ChatInterface from './components/ChatInterface';
import TextToSpeech from './components/TextToSpeech';
import AudioManager from './components/AudioManager';
import NotificationManager, { useNotifications } from './components/common/NotificationManager';
import styles from './styles/App.module.css';

const foxaiLogo = '/static/logo/foxai-logo-3.png';

function AppContent() {
  const [generatedText, setGeneratedText] = useState('');
  const { notifications, notify, removeNotification } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: '/', label: 'Trang Chủ', path: '/' },
    { id: 'chat', label: 'Trí Tuệ Nhân Tạo', path: '/chat' },
    { id: 'tts', label: 'Chuyển Đổi Ngữ Âm', path: '/tts' },
    { id: 'audio', label: 'Thư Viện Âm Thanh', path: '/audio' },
  ];

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
        <div className={styles.chatTabSwitcher}>
          <div className={styles.headerLogo}>
            <img src={foxaiLogo} alt="FOXAI Logo" className={styles.logoImage} />
          </div>

          <div className={styles.tabs}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`${styles.tabButton} ${location.pathname === tab.path ? styles.active : ''}`}
                onClick={() => navigate(tab.path)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.content}>
        <Routes>
          <Route path="/" element={<HomePage onNavigate={(path) => navigate(`/${path === 'generator' ? 'chat' : path}`)} />} />
          <Route path="/chat" element={<ChatInterface onTextGenerated={handleTextGenerated} notify={notify} />} />
          <Route path="/tts" element={<TextToSpeech generatedText={generatedText} notify={notify} />} />
          <Route path="/audio" element={<AudioManager notify={notify} />} />
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
