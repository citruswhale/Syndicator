import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AnalysisContext = createContext(null);

export const AnalysisProvider = ({ children }) => {
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalysis = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/analysis/${id}`);
      setAnalysisData(res.data);
    } catch (e) {
      console.error('Failed to fetch analysis:', e);
      localStorage.removeItem('rift_analysis_id');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const savedId = localStorage.getItem('rift_analysis_id');
    if (savedId && !analysisData) {
      fetchAnalysis(savedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAnalysis]);

  const saveAnalysis = (data) => {
    setAnalysisData(data);
    if (data?.id) {
      localStorage.setItem('rift_analysis_id', data.id);
    }
  };

  const clearAnalysis = () => {
    setAnalysisData(null);
    localStorage.removeItem('rift_analysis_id');
  };

  return (
    <AnalysisContext.Provider value={{
      analysisData,
      saveAnalysis,
      clearAnalysis,
      isLoading,
      setIsLoading,
      error,
      setError,
      fetchAnalysis
    }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be inside AnalysisProvider');
  return ctx;
};
