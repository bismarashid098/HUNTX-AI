import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { uploadCV } from '../../services/cv.service.js';
import clsx from 'clsx';

export default function CVUpload({ onCVReady, onClose }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'paste'
  const [pastedText, setPastedText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    setUploadedFile(file);

    try {
      const { data } = await uploadCV(file);
      toast.success('CV uploaded successfully!');
      onCVReady(data.cvText);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload CV');
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  }, [onCVReady, onClose]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handlePasteSubmit = () => {
    if (pastedText.trim().length < 50) {
      toast.error('Please paste your full CV text (minimum 50 characters)');
      return;
    }
    onCVReady(pastedText.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-lg border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h3 className="text-white font-semibold">Upload Your CV</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setMode('upload')}
            className={clsx(
              'flex-1 py-3 text-sm font-medium transition-colors',
              mode === 'upload' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            Upload File (PDF/TXT)
          </button>
          <button
            onClick={() => setMode('paste')}
            className={clsx(
              'flex-1 py-3 text-sm font-medium transition-colors',
              mode === 'paste' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            Paste Text
          </button>
        </div>

        <div className="p-5">
          {mode === 'upload' ? (
            <div
              {...getRootProps()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-600 hover:border-gray-500'
              )}
            >
              <input {...getInputProps()} />
              {isUploading ? (
                <div className="text-gray-400 animate-pulse">
                  <FileText className="mx-auto mb-3 text-emerald-400" size={32} />
                  <p className="text-sm">Processing your CV...</p>
                </div>
              ) : uploadedFile ? (
                <div className="text-gray-400">
                  <FileText className="mx-auto mb-3 text-emerald-400" size={32} />
                  <p className="text-sm text-white">{uploadedFile.name}</p>
                </div>
              ) : (
                <div className="text-gray-400">
                  <Upload className="mx-auto mb-3 text-gray-500" size={32} />
                  <p className="text-sm text-gray-300">
                    {isDragActive ? 'Drop your CV here' : 'Drag & drop your CV here'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">PDF or TXT • Max 5MB</p>
                  <button className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors">
                    Browse Files
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your full CV text here..."
                rows={10}
                className="w-full bg-gray-700 text-gray-100 rounded-xl p-4 border border-gray-600 focus:border-emerald-500 focus:outline-none text-sm resize-none leading-relaxed"
              />
              <button
                onClick={handlePasteSubmit}
                disabled={pastedText.trim().length < 50}
                className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Use This CV
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
