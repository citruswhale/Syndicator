import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysis } from '@/context/AnalysisContext';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const FileUploader = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef(null);
  const { saveAnalysis } = useAnalysis();
  const navigate = useNavigate();

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && f.name.endsWith('.csv')) {
      setFile(f);
    } else {
      toast.error('Please upload a CSV file');
    }
  }, []);

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress('INITIALIZING GRAPH ENGINE...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      setProgress('PARSING TRANSACTIONS...');
      const res = await axios.post(`${API}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setProgress('ANALYSIS COMPLETE');
      saveAnalysis(res.data);
      toast.success(`Analysis complete: ${res.data.summary?.suspicious_accounts_flagged || 0} suspects identified`);
      navigate('/dashboard');
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Analysis failed';
      toast.error(msg);
      setProgress('');
    }
    setUploading(false);
  };

  const handleGenerateSample = async () => {
    setUploading(true);
    setProgress('GENERATING 10K SYNTHETIC TRANSACTIONS...');

    try {
      setProgress('BUILDING TRANSACTION GRAPH...');
      const res = await axios.post(`${API}/analyze-sample`, {}, { timeout: 120000 });
      setProgress('DETECTION ALGORITHMS RUNNING...');
      saveAnalysis(res.data);
      toast.success(`Sample analysis complete in ${res.data.summary?.processing_time_seconds}s`);
      navigate('/dashboard');
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Sample generation failed';
      toast.error(msg);
      setProgress('');
    }
    setUploading(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Upload Dropzone */}
      <div
        data-testid="csv-upload-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-sm p-12 text-center cursor-pointer transition-all duration-300 corner-accent ${
          isDragging
            ? 'border-blue-500 bg-blue-500/5 upload-active'
            : file
              ? 'border-zinc-600 bg-zinc-900/50'
              : 'border-zinc-800 hover:border-zinc-600 bg-zinc-950/50'
        } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="csv-file-input"
        />

        {uploading ? (
          <div className="space-y-4">
            <Loader2 className="mx-auto text-blue-500 animate-spin" size={40} strokeWidth={1.5} />
            <p className="font-mono text-sm text-blue-400 tracking-wider animate-pulse">{progress}</p>
          </div>
        ) : file ? (
          <div className="space-y-3">
            <FileText className="mx-auto text-blue-400" size={40} strokeWidth={1.5} />
            <p className="font-mono text-base text-zinc-200">{file.name}</p>
            <p className="text-xs text-zinc-500 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="mx-auto text-zinc-600" size={40} strokeWidth={1.5} />
            <p className="font-mono text-sm text-zinc-400 tracking-wider">DROP CSV FILE HERE</p>
            <p className="text-xs text-zinc-600">or click to browse</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          data-testid="upload-analyze-btn"
          onClick={handleUpload}
          disabled={!file || uploading}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs tracking-wider rounded-sm h-10 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:opacity-30 disabled:shadow-none"
        >
          {uploading ? 'PROCESSING...' : 'RUN ANALYSIS'}
        </Button>

        <Button
          data-testid="generate-sample-btn"
          onClick={handleGenerateSample}
          disabled={uploading}
          variant="outline"
          className="flex-1 bg-transparent border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white font-mono text-xs tracking-wider rounded-sm h-10 transition-all"
        >
          GENERATE SAMPLE (10K)
        </Button>
      </div>
    </div>
  );
};
