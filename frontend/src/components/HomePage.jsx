import React from 'react';

import styles from '../styles/HomePage.module.css';
import gioiThieuImg from '../assets/gioi-thieu.png';
import aiChatImg from '../assets/ai-chat.png';
import textToSpeechImg from '../assets/text-to-speech.png';
import thuVienAmThanhImg from '../assets/thu-vien-am-thanh.png';

const foxaiLogo = '/static/logo/foxai-logo-3.png';

function HomePage({ onNavigate }) {
  return (
    <div className={styles.homeContainer}>
      {/* Header */}
      <header className={styles.homeHeader}>
        <div className={styles.headerWrapper}>
          <div className={`${styles.logoSection} ${styles.fadeInUp}`}>
            <img 
              src={foxaiLogo} 
              alt="FoxAI Logo" 
              className={styles.homeLogo}
            />
          </div>
          
          <div className={`${styles.titleSection} ${styles.fadeInDown}`}>
            <h1 className={styles.mainTitle}>AI TEXT & SPEECH PLATFORM</h1>
            <p className={styles.subtitle}>Nền tảng tạo văn bản và chuyển đổi âm thanh FoxAI Native Assistant</p>
          </div>
          
          <div style={{ width: '60px' }}></div>
        </div>
      </header>

      {/* Feature Grid */}
      <section className={styles.contentSection}>
        <div className={styles.featureGrid}>
          {/* Giới thiệu FoxAI */}
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

          {/* Trí tuệ nhân tạo */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard} ${styles.animateFromRight}`}
            onClick={() => onNavigate('generator')}
          >
            <div className={styles.featureImageBox}>
              <img src={aiChatImg} alt="Trí tuệ nhân tạo" className={styles.featureImage} />
            </div>
            <h3 className={styles.featureTitle}>Trí tuệ nhân tạo</h3>
            <p className={styles.featureDescription}>
              Công cụ AI thông minh giúp tạo văn bản tự động và trò chuyện thông minh.
            </p>
          </div>

          {/* Chuyển đổi ngữ âm */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard} ${styles.animateFromLeft}`}
            onClick={() => onNavigate('tts')}
          >
            <div className={styles.featureImageBox}>
              <img src={textToSpeechImg} alt="Chuyển đổi ngữ âm" className={styles.featureImage} />
            </div>
            <h3 className={styles.featureTitle}>Chuyển đổi ngữ âm</h3>
            <p className={styles.featureDescription}>
              Chuyển văn bản thành giọng nói tự nhiên với nhiều giọng đọc đa dạng.
            </p>
          </div>

          {/* Quản lý file */}
          <div 
            className={`${styles.featureCard} ${styles.clickableCard} ${styles.animateFromRight}`}
            onClick={() => onNavigate('files')}
          >
            <div className={styles.featureImageBox}>
              <img src={thuVienAmThanhImg} alt="Quản lý file" className={styles.featureImage} />
            </div>
            <h3 className={styles.featureTitle}>Quản lý file</h3>
            <p className={styles.featureDescription}>
              Quản lý tài liệu, tạo cuộc trò chuyện và lưu trữ file âm thanh.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
