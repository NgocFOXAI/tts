import React, { useState, useEffect } from 'react';

import { apiService } from '../services/api';
import styles from '../styles/AboutUs.module.css';

const AboutUs = () => {
  const [foxaiInfo, setFoxaiInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFoxAIInfo = async () => {
      try {
        setLoading(true);
        const data = await apiService.getFoxAIInfo();
        setFoxaiInfo(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch FoxAI info:', err);
        setError(err.message || 'Không thể tải thông tin FoxAI');
      } finally {
        setLoading(false);
      }
    };

    fetchFoxAIInfo();
  }, []);

  if (loading) {
    return (
      <div className={styles.aboutUs}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.aboutUs}>
        <div className={styles.error}>
          <h3>⚠️ Lỗi tải thông tin</h3>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className={styles.retryButton}
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!foxaiInfo) {
    return (
      <div className={styles.aboutUs}>
        <div className={styles.noData}>
          <p>Không có thông tin để hiển thị</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.aboutUs}>
      <div className={styles.header}>
        <h1>{foxaiInfo.name}</h1>
        <p className={styles.slogan}>{foxaiInfo.slogan}</p>
        <a
          href={foxaiInfo.website}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.websiteLink}
        >
          🌐 {foxaiInfo.website}
        </a>
      </div>

      <div className={styles.content}>
        <div className={styles.grid}>
          {/* Contact Information */}
          <div className={styles.card}>
            <h3>📞 Thông tin liên hệ</h3>
            <div className={styles.contactInfo}>
              <p><strong>Email:</strong> <a href={`mailto:${foxaiInfo.contact.email}`}>{foxaiInfo.contact.email}</a></p>
              <p><strong>Điện thoại:</strong> <a href={`tel:${foxaiInfo.contact.phone}`}>{foxaiInfo.contact.phone}</a></p>
            </div>
          </div>

          {/* Headquarters */}
          <div className={styles.card}>
            <h3>🏢 Trụ sở chính</h3>
            <div className={styles.addressInfo}>
              <p><strong>{foxaiInfo.headquarters.country}</strong></p>
              <p>{foxaiInfo.headquarters.address}</p>
            </div>
          </div>

          {/* Other Office */}
          <div className={styles.card}>
            <h3>🏛️ Văn phòng khác</h3>
            <div className={styles.addressInfo}>
              <p><strong>{foxaiInfo.other_office.country}</strong></p>
              <p>{foxaiInfo.other_office.address}</p>
            </div>
          </div>

          {/* Vision & Mission */}
          <div className={styles.card}>
            <h3> Tầm nhìn & Sứ mệnh</h3>
            <p className={styles.visionMission}>{foxaiInfo.vision_mission}</p>
          </div>
        </div>

        {/* Core Capabilities */}
        <div className={styles.section}>
          <h3>🚀 Năng lực cốt lõi</h3>
          <div className={styles.capabilitiesList}>
            {foxaiInfo.core_capabilities.map((capability, index) => (
              <div key={index} className={styles.capabilityItem}>
                <span className={styles.capabilityIcon}>✓</span>
                {capability}
              </div>
            ))}
          </div>
        </div>

        {/* Target Industries */}
        <div className={styles.section}>
          <h3> Lĩnh vực mục tiêu</h3>
          <div className={styles.industriesList}>
            {foxaiInfo.target_industries.map((industry, index) => (
              <div key={index} className={styles.industryItem}>
                {industry}
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className={styles.section}>
          <h3>🏆 Thành tích đạt được</h3>
          <div className={styles.achievementsGrid}>
            <div className={styles.achievementItem}>
              <div className={styles.achievementNumber}>{foxaiInfo.achievements_metrics.experts_certified}</div>
              <div className={styles.achievementLabel}>Chuyên gia được chứng nhận</div>
            </div>
            <div className={styles.achievementItem}>
              <div className={styles.achievementNumber}>{foxaiInfo.achievements_metrics.successful_projects}</div>
              <div className={styles.achievementLabel}>Dự án thành công</div>
            </div>
            <div className={styles.achievementItem}>
              <div className={styles.achievementNumber}>{foxaiInfo.achievements_metrics.countries_with_offices}</div>
              <div className={styles.achievementLabel}>Quốc gia có văn phòng</div>
            </div>
            <div className={styles.achievementItem}>
              <div className={styles.achievementNumber}>{foxaiInfo.achievements_metrics.awards}</div>
              <div className={styles.achievementLabel}>Giải thưởng</div>
            </div>
          </div>
        </div>

        {/* Partners & Clients */}
        <div className={styles.section}>
          <h3>🤝 Đối tác & Khách hàng</h3>
          <div className={styles.partnersList}>
            {foxaiInfo.partners_clients.map((partner, index) => (
              <div key={index} className={styles.partnerItem}>
                {partner}
              </div>
            ))}
          </div>
        </div>

        {/* News Focus */}
        <div className={styles.section}>
          <h3>📰 Tin tức nổi bật</h3>
          <div className={styles.newsList}>
            {foxaiInfo.news_focus.map((news, index) => (
              <div key={index} className={styles.newsItem}>
                <span className={styles.newsIcon}>📌</span>
                {news}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <p>© {foxaiInfo.copyright.year} {foxaiInfo.copyright.holder}. All rights reserved.</p>
      </div>
    </div>
  );
};

export default AboutUs;