import React, { useState } from 'react';

import ChatInterface from './components/ChatInterface';
import TextToSpeech from './components/TextToSpeech';
import AudioManager from './components/AudioManager';
import NotificationManager, { useNotifications } from './components/common/NotificationManager';
import env from './config/environment';
import styles from './styles/App.module.css';

// FOXAI logo and background from static folder
const foxaiLogo = '/static/logo/foxai-logo-3.png';
const foxaiNativeBg = require('./assets/foxai-native-bg.png');

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [generatedText, setGeneratedText] = useState('');
  
  // Notification system
  const { notifications, notify, removeNotification } = useNotifications();
  
  // Health check and API info hooks (available for future use)
  // const { status: healthStatus } = useHealthCheck();
  // const { info: apiInfo } = useApiInfo();

  // Simple tabs without complex configuration
  const tabs = [
    { id: 'home', label: 'Trang Chủ', component: null },
    { id: 'generator', label: 'Trí Tuệ Nhân Tạo', component: ChatInterface },
    { id: 'tts', label: 'Chuyển Đổi Ngữ Âm', component: TextToSpeech },
    { id: 'audio', label: 'Thư Viện Âm Thanh', component: AudioManager },
  ];

  const handleTextGenerated = (text) => {
    setGeneratedText(text);
    // Note: Auto-switch to TTS disabled for better chat experience
    // setActiveTab('tts'); // Auto-switch to TTS tab
  };

  const renderActiveComponent = () => {
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    if (!activeTabData) return null;

    const Component = activeTabData.component;

    // Pass different props based on the component
    if (activeTabData.id === 'generator') {
      return <Component onTextGenerated={handleTextGenerated} notify={notify} />;
    } else if (activeTabData.id === 'tts') {
      return <Component generatedText={generatedText} notify={notify} />;
    }

    return <Component notify={notify} />;
  };

  const renderHomePage = () => (
    <div className={styles.homeContainer}>
      {/* Header đơn giản với Logo và Tiêu đề */}
      <header className={styles.homeHeader}>
        <div className={styles.headerWrapper}>
          {/* Logo bên trái */}
          <div className={styles.logoSection}>
            <img 
              src="/static/logo/foxai-logo-3.png" 
              alt="FoxAI Logo" 
              className={styles.homeLogo}
            />
          </div>
          
          {/* Tiêu đề ở giữa */}
          <div className={styles.titleSection}>
            <h1 className={styles.mainTitle}>AI TEXT & SPEECH PLATFORM</h1>
            <p className={styles.subtitle}>Nền tảng tạo văn bản và chuyển đổi âm thanh FoxAI Native Assistant</p>
          </div>
          
          {/* Khoảng trống bên phải để cân bằng */}
          <div style={{ width: '60px' }}></div>
        </div>
      </header>

      {/* Content Section với 4 khối tính năng có thể click */}
      <section className={styles.contentSection}>
        <div className={styles.featureGrid}>
          {/* Khối 1: Giới thiệu FoxAI - Click để chuyển đến fox.ai.vn */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard}`}
            onClick={() => window.open('https://fox.ai.vn', '_blank')}
          >
            <div className={styles.featureIconBox}>
              <svg className={styles.featureIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 7.5V9M15 11V17L22 18V19H14V18L15 17V13L11 11.5V15H9L7.91 12.09C7.66 11.34 6.66 11 5.91 11.25C5.16 11.5 4.82 12.5 5.07 13.25L6.5 17H10V19H2V18L9 15V12L6.5 10.5V9L15 11Z"/>
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Giới thiệu FoxAI</h3>
            <p className={styles.featureDescription}>
              FoxAI là công ty uy tín tại Việt Nam và Lào, đi đầu trong lĩnh vực chuyển đổi số.
            </p>
          </div>

          {/* Khối 2: Trí tuệ nhân tạo - Click để chuyển đến Chat */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard}`}
            onClick={() => setActiveTab('generator')}
          >
            <div className={styles.featureIconBox}>
              <svg className={styles.featureIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A0.5,0.5 0 0,0 7,13.5A0.5,0.5 0 0,0 7.5,14A0.5,0.5 0 0,0 8,13.5A0.5,0.5 0 0,0 7.5,13M16.5,13A0.5,0.5 0 0,0 16,13.5A0.5,0.5 0 0,0 16.5,14A0.5,0.5 0 0,0 17,13.5A0.5,0.5 0 0,0 16.5,13Z"/>
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Trí tuệ nhân tạo</h3>
            <p className={styles.featureDescription}>
              Hệ thống phân tích báo cáo file thông qua ngôn ngữ tự nhiên.
            </p>
          </div>

          {/* Khối 3: Chuyển đổi âm thanh - Click để chuyển đến TTS */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard}`}
            onClick={() => setActiveTab('tts')}
          >
            <div className={styles.featureIconBox}>
              <svg className={styles.featureIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,14C10.89,14 10,13.1 10,12V8A2,2 0 0,1 12,6A2,2 0 0,1 14,8V12C14,13.1 13.1,14 12,14M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Chuyển đổi âm thanh</h3>
            <p className={styles.featureDescription}>
              Chuyển đổi văn bản thành giọng nói tự nhiên và cuộc trò chuyện.
            </p>
          </div>

          {/* Khối 4: Thư viện âm thanh - Click để chuyển đến Audio Manager */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard}`}
            onClick={() => setActiveTab('audio')}
          >
            <div className={styles.featureIconBox}>
              <svg className={styles.featureIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,11A1,1 0 0,0 13,10A1,1 0 0,0 12,9A1,1 0 0,0 11,10A1,1 0 0,0 12,11M12.5,2C17,2 18.5,3.5 18.5,8V15.5A3.5,3.5 0 0,1 15,19H5.5A3.5,3.5 0 0,1 2,15.5V8C2,3.5 3.5,2 8,2H12.5M12,6.5C10.62,6.5 9.5,7.62 9.5,9S10.62,11.5 12,11.5S14.5,10.38 14.5,9S13.38,6.5 12,6.5Z"/>
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Thư viện âm thanh</h3>
            <p className={styles.featureDescription}>
              Quản lý, tải xuống và xem các tệp âm thanh đã tạo của bạn.
            </p>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className={styles.app}>
      {/* Notification Manager */}
      <NotificationManager 
        notifications={notifications} 
        onRemove={removeNotification} 
      />

      {/* Tab switcher - chỉ hiển thị khi không phải trang chủ */}
      {activeTab !== 'home' && (
        <div className={styles.chatTabSwitcher} data-active={activeTab}>
          {/* FOXAI Logo */}
          <div className={styles.headerLogo}>
            <img src={foxaiLogo} alt="FOXAI Logo" className={styles.logoImage} />
          </div>

          {/* Navigation Tabs */}
          <div className={styles.tabContainer}>
            <button
              onClick={() => setActiveTab('home')}
              className={`${styles.chatTab} ${activeTab === 'home' ? styles.active : ''}`}
            >
              Trang Chủ
            </button>
            <button
              onClick={() => window.open('https://fox.ai.vn', '_blank')}
              className={styles.chatTab}
            >
              Giới Thiệu
            </button>
            <button
              onClick={() => setActiveTab('generator')}
              className={`${styles.chatTab} ${activeTab === 'generator' ? styles.active : ''}`}
            >
              Trí Tuệ Nhân Tạo
            </button>
            <button
              onClick={() => setActiveTab('tts')}
              className={`${styles.chatTab} ${activeTab === 'tts' ? styles.active : ''}`}
            >
              Chuyển Đổi Ngữ Âm
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`${styles.chatTab} ${activeTab === 'audio' ? styles.active : ''}`}
            >
              Thư Viện Âm Thanh
            </button>
          </div>

          {/* Right side placeholder for future features */}
          <div style={{ width: '120px' }}></div>
        </div>
      )}

      {/* Main Content */}
      <main className={`${styles.main} ${activeTab !== 'home' ? styles.withTabSwitcher : ''}`}>
        {activeTab === 'home' ? (
          renderHomePage()
        ) : activeTab === 'generator' ? (
          // Fullscreen for chat interface
          renderActiveComponent()
        ) : activeTab === 'tts' ? (
          // Fullscreen for TTS interface
          renderActiveComponent()
        ) : activeTab === 'audio' ? (
          // Fullscreen for Audio Manager
          renderActiveComponent()
        ) : (
          // Container for other components
          <div className="container">
            {renderActiveComponent()}
          </div>
        )}
      </main>


    </div>
  );
}

export default App;