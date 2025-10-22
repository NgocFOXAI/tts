import React from 'react';
import styles from '../styles/HomePage.module.css';
import gioiThieuImg from '../assets/gioi-thieu.png';
import aiChatImg from '../assets/ai-chat.png';
import textToSpeechImg from '../assets/text-to-speech.png';
import thuVienAmThanhImg from '../assets/thu-vien-am-thanh.png';

const HomePage = ({ onNavigate }) => {
  const features = [
    {
      id: 'about',
      image: gioiThieuImg,
      title: 'Giới thiệu FoxAI',
      description: 'FoxAI là công ty uy tín tại Việt Nam và Lào, đi đầu trong lĩnh vực chuyển đổi số.',
      onClick: () => window.open('https://fox.ai.vn', '_blank')
    },
    {
      id: 'generator',
      image: aiChatImg,
      title: 'Trí tuệ nhân tạo',
      description: 'Trò chuyện với AI thông minh, tạo nội dung sáng tạo và giải quyết vấn đề nhanh chóng.',
      onClick: () => onNavigate('generator')
    },
    {
      id: 'tts',
      image: textToSpeechImg,
      title: 'Chuyển đổi ngữ âm',
      description: 'Chuyển văn bản thành giọng nói tự nhiên với nhiều giọng đọc chất lượng cao.',
      onClick: () => onNavigate('tts')
    },
    {
      id: 'audio',
      image: thuVienAmThanhImg,
      title: 'Thư viện âm thanh',
      description: 'Quản lý và truy cập nhanh các file âm thanh đã tạo từ hệ thống.',
      onClick: () => onNavigate('audio')
    }
  ];

  return (
    <div className={styles.homeContainer}>
      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.logoWrapper}>
            <img 
              src="/static/logo/foxai-logo-3.png" 
              alt="FoxAI Logo" 
              className={styles.logo}
            />
          </div>
          <h1 className={styles.title}>
            AI TEXT & SPEECH PLATFORM
          </h1>
          <p className={styles.subtitle}>
            Nền tảng tạo văn bản và chuyển đổi âm thanh thông minh
          </p>
          <p className={styles.tagline}>
            Powered by FoxAI Native Assistant
          </p>
        </div>
      </header>

      {/* Features Grid */}
      <section className={styles.features}>
        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className={`${styles.featureCard} ${styles[`animate${index + 1}`]}`}
              onClick={feature.onClick}
            >
              <div className={styles.imageWrapper}>
                <img 
                  src={feature.image} 
                  alt={feature.title}
                  className={styles.featureImage}
                />
              </div>
              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardDescription}>{feature.description}</p>
              </div>
              <div className={styles.cardOverlay}>
                <span className={styles.cardCta}>Tìm hiểu thêm →</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2025 FoxAI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;
