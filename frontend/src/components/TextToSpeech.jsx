import React, { useState, useRef, useEffect } from 'react';

import { useTextToSpeech } from '../hooks/useApi';
import { useTTSModels } from '../hooks/useModels';
import { apiService } from '../services/api';
import env from '../config/environment';
import styles from '../styles/TextToSpeech.module.css';

import Sidebar from './common/Sidebar';
import { SettingsSection } from './common/SettingsSection';
import { Select, Textarea, Slider } from './common/FormControls';
import ProgressBar from './common/ProgressBar';
import NotificationManager, { useNotifications } from './common/NotificationManager';

const TextToSpeech = ({ generatedText }) => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState(env.defaults.tts.voice);
  const [speed, setSpeed] = useState(env.defaults.tts.speed);
  const [provider, setProvider] = useState(env.defaults.tts.provider);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Advanced Audio Generation states
  const [activeTab, setActiveTab] = useState('tts');
  const [isGeneratingNotebook, setIsGeneratingNotebook] = useState(false);
  const [notebookResult, setNotebookResult] = useState(null);
  const [notebookError, setNotebookError] = useState(null);
  const [customText, setCustomText] = useState(''); // Custom text for audio generation
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');

  // Notifications
  const { notifications, removeNotification, notify } = useNotifications();

  // Advanced options
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [instructions, setInstructions] = useState('');
  const [responseFormat, setResponseFormat] = useState('mp3');
  const [languageCode, setLanguageCode] = useState('en-US');

  const audioRef = useRef(null);

  const { result, loading, error, audioUrl, generateSpeech, reset } = useTextToSpeech();
  const { models: apiTtsModels, voices: apiVoices, loading: modelsLoading } = useTTSModels();

  // Ensure apiVoices is always an object
  const safeApiVoices = apiVoices || { openai: [], google: [] };

  // Auto-populate text from generated text
  useEffect(() => {
    if (generatedText && generatedText.trim()) {
      setText(generatedText);
    }
  }, [generatedText]);

  // Filter models by current provider
  const getModelsForProvider = () => {
    if (!apiTtsModels || apiTtsModels.length === 0) return [];
    return apiTtsModels.filter(modelOption => {
      if (provider === 'openai') {
        return modelOption.provider === 'openai_tts';
      } else if (provider === 'google') {
        return modelOption.provider === 'google_tts' || modelOption.provider === 'gemini_tts';
      }
      return false;
    });
  };

  // Get voices for current provider
  const getVoicesForProvider = () => {
    if (provider === 'openai') {
      const openaiVoices = safeApiVoices?.openai || ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
      // Ensure all voices are strings
      return openaiVoices.map(voice => 
        typeof voice === 'string' ? voice : (voice?.id || voice?.value || voice?.name || 'unknown')
      );
    } else if (provider === 'google') {
      // Handle both string array and object array
      const googleVoices = safeApiVoices?.google || [
        'natural_control', 'expressive', 'conversational',
        'en-US-Neural2-A', 'en-US-Neural2-B', 'en-US-Wavenet-A', 'en-US-Standard-A'
      ];
      // If it's array of objects, extract the id/value
      return googleVoices.map(voice => 
        typeof voice === 'string' ? voice : (voice?.id || voice?.value || voice?.name || 'unknown')
      );
    }
    return [];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!text.trim()) {
      alert('Vui lòng nhập một số văn bản');
      return;
    }

    try {
      await generateSpeech({
        text: text.trim(),
        voice,
        speed,
        provider,
        model: model || null,
        system_prompt: systemPrompt,
        instructions: instructions,
        response_format: responseFormat,
        language_code: languageCode,
      });
    } catch (err) {
      console.error('TTS generation failed:', err);
    }
  };

  const handlePlayAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
    }
  };

  const handleDownloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `tts_${Date.now()}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleReset = () => {
    reset();
    setText('');
  };

  // Advanced Audio Generation functions with progress tracking
  const handleGenerateAdvancedAudio = async () => {
    if (!customText.trim()) {
      notify.error('Vui lòng nhập một số văn bản để chuyển đổi thành âm thanh');
      return;
    }

    // Reset states
    setIsGeneratingNotebook(true);
    setNotebookError(null);
    setNotebookResult(null);
    setProgress(10);
    setProgressStatus('preparing');
    setCurrentStep('Preparing content for processing...');
    setEstimatedTime('Please wait, processing may take several minutes...');

    // Show initial notification
    const processingNotificationId = notify.processing('Starting audio generation...', {
      title: 'Audio Generation',
      persistent: true
    });

    try {
      console.log('🚀 Starting advanced audio generation...');
      console.log('📝 Using custom text (length:', customText.trim().length, 'chars)');

      // Update progress to show we're calling the API
      setProgress(20);
      setProgressStatus('processing');
      setCurrentStep('Sending request to server...');

      // Call API and wait for real response (no timeout)
      const response = await apiService.generateAdvancedAudio({
        custom_text: customText.trim()
      });

      console.log('✅ Advanced audio generation completed:', response);

      // Final progress - API completed successfully
      setProgress(100);
      setProgressStatus('completed');
      setCurrentStep('Audio generation completed successfully!');
      setEstimatedTime('');

      setNotebookResult(response);

      // Remove processing notification and show success
      removeNotification(processingNotificationId);
      notify.success('Audio generation completed successfully!', {
        title: 'Success',
        duration: 5000
      });

    } catch (err) {
      console.error('❌ Advanced audio generation failed:', err);

      // Update progress to error state
      setProgress(0);
      setProgressStatus('error');
      setCurrentStep('Generation failed. Please try again.');
      setEstimatedTime('');

      setNotebookError(err.message || 'Không thể tạo âm thanh');

      // Remove processing notification and show error
      removeNotification(processingNotificationId);
      notify.error('Audio generation failed. Please try again.', {
        title: 'Generation Error',
        duration: 8000
      });

    } finally {
      setIsGeneratingNotebook(false);
    }
  };

  const formatProcessingTime = (seconds) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  const sampleTexts = [
    "Xin chào, đây là văn bản mẫu để chuyển đổi văn bản thành giọng nói.",
    "Con cáo nâu nhanh nhẹn nhảy qua con chó lười biếng.",
    "Trí tuệ nhân tạo đang thay đổi cách chúng ta làm việc và sống.",
    "Chào mừng đến với màn trình diễn chuyển văn bản thành giọng nói của chúng tôi.",
    "Công nghệ này giúp chúng ta có thể nghe nội dung thay vì chỉ đọc."
  ];

  return (
    <div className={styles.textToSpeech}>
      {/* Left Sidebar */}
      <Sidebar title="Cài đặt âm thanh">
        {/* Tab Navigation */}
        <SettingsSection title="">
          <div className={styles.tabNavigation}>
            <button
              onClick={() => setActiveTab('tts')}
              className={`${styles.tabButton} ${activeTab === 'tts' ? styles.active : ''}`}
            >
              Tổng Hợp Giọng Nói
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`${styles.tabButton} ${activeTab === 'advanced' ? styles.active : ''}`}
            >
              Podcast Thông Minh
            </button>
          </div>
        </SettingsSection>

          {/* Settings based on active tab */}
          {activeTab === 'tts' && (
            <>
              <SettingsSection title="Cấu Hình Nhà Cung Cấp">
                <div className={styles.settingGroup}>
                  <label htmlFor="provider">Công Nghệ Tổng Hợp</label>
                  <Select
                    value={provider}
                    onChange={(e) => {
                      const newProvider = e.target.value;
                      setProvider(newProvider);
                      let providerVoices = [];
                      if (newProvider === 'openai') {
                        const openaiVoices = safeApiVoices?.openai || ['alloy'];
                        providerVoices = openaiVoices.map(voice =>
                          typeof voice === 'string' ? voice : (voice?.id || voice?.value || voice?.name || 'unknown')
                        );
                      } else if (newProvider === 'google') {
                        const googleVoices = safeApiVoices?.google || ['natural_control'];
                        providerVoices = googleVoices.map(voice =>
                          typeof voice === 'string' ? voice : (voice?.id || voice?.value || voice?.name || 'unknown')
                        );
                      }
                      if (providerVoices.length > 0) {
                        setVoice(providerVoices[0]);
                      }
                    }}
                    options={[
                      { value: "openai", label: "OpenAI TTS" },
                      { value: "google", label: "Google (Gemini + Cloud TTS)" }
                    ]}
                  />
                </div>

                <div className={styles.settingGroup}>
                  <label htmlFor="voice">Mô Hình Giọng Nói</label>
                  <Select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    options={getVoicesForProvider().map((v, index) => {
                      const voiceValue = typeof v === 'string' ? v : (v?.id || v?.value || v?.name || `voice-${index}`);
                      const voiceLabel = typeof v === 'string' ? v.charAt(0).toUpperCase() + v.slice(1) : (v?.label || v?.name || voiceValue);
                      return { value: voiceValue, label: voiceLabel };
                    })}
                  />
                </div>

                <div className={styles.settingGroup}>
                  <label>Tốc Độ Phát Âm ({speed}x)</label>
                  <Slider
                    min={0.25}
                    max={4}
                    step={0.1}
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    valueFormatter={(v) => `${v}x`}
                  />
                </div>
              </SettingsSection>

              <SettingsSection title="">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={styles.advancedToggle}
                >
                  {showAdvanced ? 'Thu Gọn Cài Đặt Chuyên Sâu' : 'Mở Rộng Cài Đặt Chuyên Sâu'}
                </button>

                {showAdvanced && (
                  <SettingsSection title="Cài Đặt Chuyên Sâu">
                    <div className={styles.settingGroup}>
                      <label htmlFor="model">Engine Tổng Hợp</label>
                      <Select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        disabled={modelsLoading}
                        options={[
                          { value: "", label: "Engine Mặc Định" },
                          ...getModelsForProvider().map((modelOption) => ({
                            value: modelOption.value,
                            label: modelOption.label
                          }))
                        ]}
                      />
                    </div>

                    <div className={styles.settingGroup}>
                      <label htmlFor="responseFormat">Chất Lượng Âm Thanh</label>
                      <Select
                        value={responseFormat}
                        onChange={(e) => setResponseFormat(e.target.value)}
                        options={[
                          { value: "mp3", label: "MP3" },
                          { value: "wav", label: "WAV" },
                          { value: "opus", label: "OPUS" },
                          { value: "aac", label: "AAC" }
                        ]}
                      />
                    </div>

                    <div className={styles.settingGroup}>
                      <label htmlFor="languageCode">Miền Ngôn Ngữ</label>
                      <Select
                        value={languageCode}
                        onChange={(e) => setLanguageCode(e.target.value)}
                        options={[
                          { value: "en-US", label: "English (US)" },
                          { value: "en-GB", label: "English (UK)" },
                          { value: "vi-VN", label: "Tiếng Việt" },
                          { value: "ja-JP", label: "Tiếng Nhật" },
                          { value: "ko-KR", label: "Tiếng Hàn" },
                          { value: "zh-CN", label: "Tiếng Trung (Giản thể)" },
                          { value: "fr-FR", label: "Tiếng Pháp" },
                          { value: "de-DE", label: "Tiếng Đức" },
                          { value: "es-ES", label: "Tiếng Tây Ban Nha" }
                        ]}
                      />
                    </div>

                    {/* Provider-specific options */}
                    {provider === 'openai' && (
                      <div className={styles.settingGroup}>
                        <label htmlFor="instructions">Tối Ưu Phong Cách (OpenAI)</label>
                        <Textarea
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          placeholder="Hướng dẫn tùy chỉnh phong cách và ngữ điệu giọng nói..."
                          rows={2}
                        />
                      </div>
                    )}

                    {(provider === 'google') && (
                      <div className={styles.settingGroup}>
                        <label htmlFor="systemPrompt">Điều Khiển Hệ Thống (Google)</label>
                        <Textarea
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          placeholder="Prompt hệ thống để tinh chỉnh chất lượng và phong cách TTS..."
                          rows={2}
                        />
                      </div>
                    )}
                  </SettingsSection>
                )}
              </SettingsSection>

              <SettingsSection title="Thao Tác Quản Lý">
                <button
                  onClick={handleReset}
                  className={styles.clearButton}
                >
                  Khởi Tạo Lại
                </button>
              </SettingsSection>
            </>
          )}

          {/* Advanced Audio Settings */}
          {activeTab === 'advanced' && (
            <SettingsSection title="Cấu Hình Podcast Thông Minh">
              <div className={styles.infoBox} style={{ marginTop: '1rem' }}>
                <div>
                  <strong>FOXAi Advanced Engine:</strong> Chuyển đổi văn bản thành podcast hội thoại tự nhiên với hai diễn giả AI chuyên nghiệp.
                </div>
              </div>
            </SettingsSection>
          )}
      </Sidebar>

      {/* Right Content Area */}
      <div className={styles.contentArea}>
        <div className={styles.contentHeader}>
          <h1 className={styles.contentTitle}>Nền Tảng Tổng Hợp Âm Thanh Thông Minh</h1>
        </div>

        <div className={styles.contentBody}>
          {/* TTS Tab Content */}
          {activeTab === 'tts' && (
            <>
              <form onSubmit={handleSubmit} className={styles.form}>
                {/* Text Input */}
                <div className={styles.formGroup}>
                  <label htmlFor="text" className={styles.label}>
                    Nội Dung Cần Tổng Hợp
                    {generatedText && <span className={styles.labelNote}> (Tự Động Điền)</span>}
                  </label>
                  <textarea
                    id="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Nhập nội dung bạn muốn chuyển đổi thành giọng nói chuyên nghiệp..."
                    rows={8}
                    required
                    className={styles.textarea}
                  />

                  {/* Sample Texts */}
                  <div className={styles.sampleTexts}>
                    <div className={styles.sampleLabel}>Mẫu Tham Khảo:</div>
                    <div className={styles.sampleButtons}>
                      {sampleTexts.map((sample, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setText(sample)}
                          className={styles.sampleButton}
                        >
                          Mẫu Số {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.buttonGroup}>
                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.generateButton}
                  >
                    {loading ? (
                      <>
                        <span className={styles.loadingSpinner}></span>
                        Đang Xử Lý Tổng Hợp...
                      </>
                    ) : (
                      'Khởi Tạo Tổng Hợp Âm Thanh'
                    )}
                  </button>
                </div>
              </form>

              {/* Error Display */}
              {error && (
                <div className={styles.error}>
                  Lỗi: {error}
                </div>
              )}

              {/* Results Display */}
              {result && (
                <div className={styles.resultCard}>
                  <h3 className={styles.resultTitle}>Kết Quả Tổng Hợp Âm Thanh</h3>

                  {result.success ? (
                    <div>
                      {/* Audio Player */}
                      {audioUrl && (
                        <div>
                          <audio
                            ref={audioRef}
                            src={audioUrl}
                            controls
                            className={styles.audioPlayer}
                          />

                          <div className={styles.audioControls}>
                            <button
                              onClick={handlePlayAudio}
                              className={styles.downloadButton}
                            >
                              Phát Âm Thanh
                            </button>

                            <button
                              onClick={handleDownloadAudio}
                              className={styles.downloadButton}
                            >
                              Tải Xuống Chất Lượng Cao
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Audio Info */}
                      <div className={styles.audioInfo}>
                        <div className={styles.infoGrid}>
                          <div className={styles.infoItem}>
                            <strong>Mô Hình Giọng:</strong> {result.voice}
                          </div>
                          <div className={styles.infoItem}>
                            <strong>Engine Xử Lý:</strong> {result.provider}
                          </div>
                          <div className={styles.infoItem}>
                            <strong>Thời Lượng:</strong> {result.duration?.toFixed(1)}s
                          </div>
                          <div className={styles.infoItem}>
                            <strong>Chất Lượng:</strong> {result.audio_format?.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Text Display */}
                      <div className={styles.convertedText}>
                        <h4>Nội Dung Đã Tổng Hợp:</h4>
                        <p>{result.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.errorResult}>
                      Tổng Hợp Thất Bại: {result.error}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Advanced Audio Tab Content */}
          {activeTab === 'advanced' && (
            <form onSubmit={(e) => { e.preventDefault(); handleGenerateAdvancedAudio(); }} className={styles.form}>
              {/* Custom Text Input */}
              <div className={styles.formGroup}>
                <label htmlFor="customText" className={styles.label}>Nội Dung Nguồn Để Tạo Podcast</label>
                <textarea
                  id="customText"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Dán nội dung của bạn vào đây để chuyển đổi thành podcast hội thoại chuyên nghiệp...

Loại nội dung phù hợp:
- Bài viết chuyên môn hoặc blog
- Báo cáo nghiên cứu và phân tích
- Tài liệu hướng dẫn và giáo dục
- Ghi chú cuộc họp quan trọng
- Nội dung marketing và truyền thông

AI Engine sẽ tạo ra cuộc hội thoại tự nhiên giữa hai chuyên gia thảo luận về nội dung của bạn với phong cách podcast chuyên nghiệp."
                  rows={10}
                  className={styles.textarea}
                  disabled={isGeneratingNotebook}
                />
                <div className={styles.textStats}>
                  <small className={styles.textHelp}>
                    Dán bất kỳ nội dung chuyên sâu nào để tạo podcast hội thoại chất lượng cao
                  </small>
                  <small className={`${styles.charCount} ${customText.length > 10000 ? styles.warning : ''}`}>
                    {customText.length} ký tự {customText.length > 10000 && '(⚠️ Nội dung rất dài)'}
                  </small>
                </div>
              </div>

              {/* Generate Button */}
              <div className={styles.buttonGroup}>
                <button
                  type="submit"
                  disabled={isGeneratingNotebook || !customText.trim()}
                  className={styles.notebookButton}
                >
                  {isGeneratingNotebook ? (
                    <>
                      <span className={styles.loadingSpinner}></span>
                      Đang Tạo Podcast... (Dự kiến 5-15 phút)
                    </>
                  ) : (
                    'Khởi Tạo Podcast Thông Minh'
                  )}
                </button>
              </div>

              {/* Info */}
              <div className={styles.infoBox}>
                <div>
                  <strong>Công Nghệ Hoạt Động:</strong> Dán nội dung chuyên sâu vào ô trên và nhấn "Khởi Tạo Podcast Thông Minh". Hệ thống AI sẽ tự động tạo ra podcast chất lượng cao.
                </div>
              </div>
              <div className={styles.alternativeBox}>
                <span>Thời gian xử lý ước tính từ <strong>5-15 phút</strong> tùy thuộc độ dài nội dung</span>
                {/* <div>
                  <strong>Manual Alternative:</strong>:
                  <ol className={styles.manualSteps}>
                    <li>Prepare your text content (minimum 50 characters)</li>
                    <li>Click 'Generate Audio' to create conversation</li>
                    <li>Add your text as "Copied text"</li>
                    <li>Generate an "Audio Overview"</li>
                    <li>Download the generated audio file</li>
                  </ol>
                </div> */}
              </div>
            </form>
          )}
        </div>

        {/* Progress Bar - shown during generation */}
        {(isGeneratingNotebook || progress > 0) && (
          <ProgressBar
            progress={progress}
            status={progressStatus}
            currentStep={currentStep}
            estimatedTime={estimatedTime}
          />
        )}

        {/* Error Display */}
        {notebookError && (
          <div className={styles.error}>
            <strong>Lỗi xảy ra</strong>
            <div className={styles.errorContent}>
              {notebookError.split('\n').map((line, index) => (
                <div key={index} className={styles.errorLine}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success Result */}
        {notebookResult && notebookResult.success && (
          <div className={styles.success}>
            <strong>Tạo Podcast Thành Công!</strong>
            <div className={styles.successDetails}>
              <div>File Âm Thanh Chất Lượng Cao: <code>{notebookResult.audio_url}</code></div>
              <div>Thời Gian Xử Lý: {formatProcessingTime(notebookResult.processing_time)}</div>
              {notebookResult.text_info && (
                <div>Nội Dung Đã Xử Lý: {notebookResult.text_info.content_length} ký tự</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notification Manager */}
      <NotificationManager
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  );
};

export default TextToSpeech;