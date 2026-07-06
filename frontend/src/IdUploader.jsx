import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useDropzone } from 'react-dropzone';
import { Camera, Upload, RefreshCcw, FileText, CheckCircle } from 'lucide-react';

const IdUploader = () => {
  const [mode, setMode] = useState('select'); // 'select', 'camera', 'upload', 'processing'
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const webcamRef = useRef(null);

  const processFiles = async (files) => {
    setMode('processing');
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    files.forEach(file => {
        formData.append('idImages', file);
    });

    try {
      const response = await fetch('http://localhost:3000/api/generate-id-form', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process document');
      }

      const contentType = response.headers.get('Content-Type');
      const isZip = contentType && contentType.includes('zip');
      const ext = isZip ? '.zip' : '.pdf';
      const defaultName = isZip ? 'ID_Forms.zip' : 'Official_ID_Form.pdf';

      // Extract filename from Content-Disposition if available
      const disposition = response.headers.get('Content-Disposition');
      let filename = defaultName;
      if (disposition && disposition.includes('filename*=')) {
          filename = decodeURIComponent(disposition.split("filename*=UTF-8''")[1]);
      } else if (disposition && disposition.includes('filename=')) {
          filename = disposition.split('filename="')[1].split('"')[0];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccess(true);
      setMode('select');
    } catch (err) {
      setError(err.message);
      setMode('select');
    }
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      // Convert base64 to file
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
          processFiles([file]);
        });
    }
  }, [webcamRef]);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      processFiles(acceptedFiles);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
        'image/*': ['.jpeg', '.jpg', '.png'],
        'application/pdf': ['.pdf']
    },
    multiple: true
  });

  return (
    <div className="bg-white/70 backdrop-blur-md border border-white/50 shadow-xl rounded-2xl overflow-hidden p-6 md:p-8">
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <RefreshCcw className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Successfully generated and downloaded PDF!</p>
        </div>
      )}

      {mode === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button 
            onClick={() => setMode('camera')}
            className="group flex flex-col items-center justify-center p-8 border-2 border-slate-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Camera size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Use Camera</h3>
            <p className="text-sm text-slate-500 text-center mt-2">Take a live photo with alignment guides</p>
          </button>

          <div 
            {...getRootProps()} 
            className={`group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all
              ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'}`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Upload size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Upload Photo/PDF</h3>
            <p className="text-sm text-slate-500 text-center mt-2">Drag & drop multiple files, or click to browse</p>
          </div>
        </div>
      )}

      {mode === 'camera' && (
        <div className="relative rounded-2xl overflow-hidden bg-black">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            className="w-full h-auto max-h-[60vh] object-cover"
          />
          
          {/* Overlay Guideline */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
             <div className="w-[85%] max-w-[400px] aspect-[1.586/1] border-4 border-white/70 border-dashed rounded-lg shadow-[0_0_0_4000px_rgba(0,0,0,0.5)] flex items-center justify-center relative">
               <span className="text-white/80 font-semibold bg-black/40 px-3 py-1 rounded-md text-sm">Align ID inside box</span>
             </div>
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 px-4">
            <button 
              onClick={() => setMode('select')}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full font-semibold transition"
            >
              Cancel
            </button>
            <button 
              onClick={capture}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white shadow-lg rounded-full font-bold flex items-center gap-2 transition transform hover:scale-105"
            >
              <Camera size={20} />
              Capture Document
            </button>
          </div>
        </div>
      )}

      {mode === 'processing' && (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className="text-blue-500 w-8 h-8" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Processing Document</h3>
          <p className="text-slate-500 max-w-sm">
            Processing files, rendering PDFs, and packaging your documents...
          </p>
        </div>
      )}
    </div>
  );
};

export default IdUploader;
