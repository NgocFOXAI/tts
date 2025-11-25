import React from 'react';
import { useSearchParams } from 'react-router-dom';

import SmartReport from './SmartReport';

const DataAnalysis = ({ notify }) => {
  return <SmartReport notify={notify} />;
};

export default DataAnalysis;
