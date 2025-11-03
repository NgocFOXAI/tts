import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import styles from '../styles/DataAnalysis.module.css';

import ChatInterface from './ChatInterface';
import SmartReport from './SmartReport';

const DataAnalysis = ({ notify }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState('text');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    if (mode === 'text' || mode === 'chart') {
      setActiveMode(mode);
    } else {
      setActiveMode('text');
      navigate('/data-analysis?mode=text', { replace: true });
    }
  }, [location.search, navigate]);

  const handleModeChange = (mode) => {
    setActiveMode(mode);
    navigate(`/data-analysis?mode=${mode}`);
  };

  return (
    <div className={styles.dataAnalysisContainer}>
      <div style={{ display: activeMode === 'text' ? 'block' : 'none', height: '100%' }}>
        <ChatInterface notify={notify} />
      </div>
      <div style={{ display: activeMode === 'chart' ? 'block' : 'none', height: '100%' }}>
        <SmartReport notify={notify} />
      </div>
    </div>
  );
};

export default DataAnalysis;
