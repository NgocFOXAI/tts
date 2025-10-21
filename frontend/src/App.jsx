import React, { useState } from 'react';

import ChatInterface from './components/ChatInterface';
import TextToSpeech from './components/TextToSpeech';
import AudioManager from './components/AudioManager';
import NotificationManager, { useNotifications } from './components/common/NotificationManager';
import env from './config/environment';
import styles from './styles/App.module.css';
import gioiThieuImg from './assets/gioi-thieu.png';
import aiChatImg from './assets/ai-chat.png';
import textToSpeechImg from './assets/text-to-speech.png';
import thuVienAmThanhImg from './assets/thu-vien-am-thanh.png';

// FOXAI logo from static folder
const foxaiLogo = '/static/logo/foxai-logo-3.png';

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
          <div className={`${styles.logoSection} ${styles.fadeInUp}`}>
            <img 
              src="/static/logo/foxai-logo-3.png" 
              alt="FoxAI Logo" 
              className={styles.homeLogo}
            />
          </div>
          
          {/* Tiêu đề ở giữa */}
          <div className={`${styles.titleSection} ${styles.fadeInDown}`}>
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
            className={`${styles.featureCard} ${styles.clickableCard} ${styles.animateFromLeft}`}
            onClick={() => window.open('https://fox.ai.vn', '_blank')}
          >
            <div className={styles.featureImageBox}>
              <img src={gioiThieuImg} alt="Giới thiệu FoxAI" className={styles.featureImage} />
            </div>
            <h3 className={styles.featureTitle}>Giới thiệu FoxAI</h3>
            <p className={styles.featureDescription}>
              FoxAI là công ty uy tín tại Việt Nam và Lào, đi đầu trong lĩnh vực chuyển đổi số.
            </p>
          </div>

          {/* Khối 2: Trí tuệ nhân tạo - Click để chuyển đến Chat */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard} ${styles.animateFromTop}`}
            onClick={() => setActiveTab('generator')}
          >
            <div className={styles.featureImageBox}>
              <img src={aiChatImg} alt="Trí tuệ nhân tạo" className={styles.featureImage} />
            </div>
            <h3 className={styles.featureTitle}>Trí tuệ nhân tạo</h3>
            <p className={styles.featureDescription}>
              Hệ thống phân tích báo cáo file thông qua ngôn ngữ tự nhiên.
            </p>
          </div>

          {/* Khối 3: Chuyển đổi âm thanh - Click để chuyển đến TTS */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard} ${styles.animateFromBottom}`}
            onClick={() => setActiveTab('tts')}
          >
            <div className={styles.featureImageBox}>
              <img src={textToSpeechImg} alt="Chuyển đổi âm thanh" className={styles.featureImage} />
            </div>
            <h3 className={styles.featureTitle}>Chuyển đổi âm thanh</h3>
            <p className={styles.featureDescription}>
              Chuyển đổi văn bản thành giọng nói tự nhiên và cuộc trò chuyện.
            </p>
          </div>

          {/* Khối 4: Thư viện âm thanh - Click để chuyển đến Audio Manager */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard} ${styles.animateFromRight}`}
            onClick={() => setActiveTab('audio')}
          >
            <div className={styles.featureImageBox}>
              <img src={thuVienAmThanhImg} alt="Thư viện âm thanh" className={styles.featureImage} />
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