import React from 'react';

import { SettingsSection } from './SettingsSection';

/**
 * Component Settings dùng chung cho các feature khác nhau
 * @param {Object} config - Cấu hình của feature
 * @param {Function} onClearHistory - Callback khi xóa lịch sử
 * @param {Object} customInputs - Custom inputs cho feature
 */
const FeatureSettings = ({ config, onClearHistory, customInputs }) => {
  const {
    title,
    engineName,
    engineDescription,
    expertInfo,
    showClearButton = true,
    clearButtonText = 'Xóa Lịch Sử'
  } = config;

  return (
    <>
      {/* Engine Info Section */}
      {engineName && (
        <SettingsSection title={title || "Cấu Hình"}>
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
            borderRadius: '8px',
            color: 'white',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            letterSpacing: '0.3px',
            wordBreak: 'break-word'
          }}>
            {engineName}
          </div>
          {engineDescription && (
            <div style={{ 
              marginTop: '12px',
              padding: '12px', 
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              border: '2px solid #3b82f6', 
              borderRadius: '8px',
              fontSize: '12px',
              lineHeight: '1.5',
              color: '#1e40af',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)',
              wordBreak: 'break-word'
            }}>
              {engineDescription}
            </div>
          )}
        </SettingsSection>
      )}

      {/* Expert Info Section */}
      {expertInfo && (
        <SettingsSection title={expertInfo.title || "Chuyên Gia"}>
          <div style={{ 
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
            borderRadius: '8px',
            color: 'white',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            letterSpacing: '0.3px',
            wordBreak: 'break-word'
          }}>
            {expertInfo.name}
          </div>
          {expertInfo.description && (
            <div style={{ 
              marginTop: '12px',
              padding: '12px', 
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              border: '2px solid #3b82f6', 
              borderRadius: '8px',
              fontSize: '12px',
              lineHeight: '1.5',
              color: '#1e40af',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)',
              wordBreak: 'break-word'
            }}>
              {expertInfo.description.split('\n').map((line, idx) => (
                <div key={idx} style={{ marginBottom: line ? '3px' : '0' }}>
                  {line || <br />}
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      )}

      {/* Custom Inputs Section */}
      {customInputs && customInputs.length > 0 && (
        <SettingsSection title={customInputs[0].sectionTitle || "Tùy Chỉnh"}>
          {customInputs.map((input, index) => (
            <div key={index} style={{ marginTop: index > 0 ? '16px' : '0' }}>
              {input.label && (
                <div style={{ 
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                  borderRadius: '8px',
                  color: 'white',
                  textAlign: 'center',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  letterSpacing: '0.3px',
                  wordBreak: 'break-word',
                  marginBottom: '12px'
                }}>
                  {input.label}
                </div>
              )}
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
              }}>
                {input.render()}
              </div>
              {input.helpText && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#1e40af', 
                  marginTop: '12px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderRadius: '8px',
                  border: '2px solid #3b82f6',
                  lineHeight: '1.5',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)',
                  wordBreak: 'break-word'
                }}>
                  {input.helpText}
                </div>
              )}
            </div>
          ))}
        </SettingsSection>
      )}

      {/* Clear History Button */}
      {showClearButton && onClearHistory && (
        <SettingsSection title="Thao Tác">
          <button
            type="button"
            onClick={onClearHistory}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              letterSpacing: '0.3px',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            }}
          >
            {clearButtonText}
          </button>
        </SettingsSection>
      )}
    </>
  );
};

export default FeatureSettings;
