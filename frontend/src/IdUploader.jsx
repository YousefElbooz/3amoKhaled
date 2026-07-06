import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useDropzone } from 'react-dropzone';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Camera, Upload, RefreshCcw, FileText, CheckCircle, Crop, Maximize } from 'lucide-react';

const PerspectiveCropEditor = ({ imageSrc, onCancel, onSubmit }) => {
  const [points, setPoints] = useState([
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 }
  ]);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const svgRef = useRef(null);
  const imgRef = useRef(null);

  const handlePointerDown = (idx) => setDraggingIdx(idx);

  const handlePointerMove = (e) => {
    if (draggingIdx === null || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    const newPoints = [...points];
    newPoints[draggingIdx] = { x, y };
    setPoints(newPoints);
  };

  const handlePointerUp = () => setDraggingIdx(null);

  const handleSubmit = () => {
    if (!imgRef.current) return;
    const { naturalWidth, naturalHeight } = imgRef.current;
    const finalPoints = points.map(p => ({
      x: (p.x / 100) * naturalWidth,
      y: (p.y / 100) * naturalHeight
    }));
    onSubmit(finalPoints);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full select-none"
         onPointerMove={handlePointerMove}
         onPointerUp={handlePointerUp}
         onPointerLeave={handlePointerUp}>
      <div className="bg-slate-100 p-2 sm:p-4 rounded-xl border border-slate-200 inline-block max-w-full w-full sm:w-auto overflow-hidden">
        <div className="relative inline-block max-w-full">
          <img ref={imgRef} src={imageSrc} draggable={false} className="max-h-[60vh] max-w-full w-auto block pointer-events-none" />
          <svg ref={svgRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }}>
            <line x1={`${points[0].x}%`} y1={`${points[0].y}%`} x2={`${points[1].x}%`} y2={`${points[1].y}%`} stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" />
            <line x1={`${points[1].x}%`} y1={`${points[1].y}%`} x2={`${points[2].x}%`} y2={`${points[2].y}%`} stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" />
            <line x1={`${points[2].x}%`} y1={`${points[2].y}%`} x2={`${points[3].x}%`} y2={`${points[3].y}%`} stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" />
            <line x1={`${points[3].x}%`} y1={`${points[3].y}%`} x2={`${points[0].x}%`} y2={`${points[0].y}%`} stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" />
            {points.map((p, idx) => (
              <circle
                key={idx}
                cx={`${p.x}%`}
                cy={`${p.y}%`}
                r="8"
                fill="white"
                stroke="#3b82f6"
                strokeWidth="3"
                className="cursor-move hover:scale-125 transition-transform origin-center"
                onPointerDown={() => handlePointerDown(idx)}
                style={{ transformBox: 'fill-box' }}
              />
            ))}
          </svg>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <button onClick={onCancel} className="w-full sm:w-auto px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-full font-semibold transition">
          Cancel
        </button>
        <button onClick={handleSubmit} className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white shadow-lg rounded-full font-bold transition">
          Apply Perspective
        </button>
      </div>
    </div>
  );
};

const IdUploader = () => {
  const [mode, setMode] = useState('select'); // 'select', 'camera', 'crop-edit', 'processing', 'batch-review'
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const webcamRef = useRef(null);

  const [batchFiles, setBatchFiles] = useState([]);
  const [editingFileId, setEditingFileId] = useState(null);

  // Crop Editor State
  const [cropImageSrc, setCropImageSrc] = useState('');
  const imgRef = useRef(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);

  const processFiles = async (files, pointsStr = null) => {
    setMode('processing');
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    if (pointsStr) {
        formData.append('pointsMap', pointsStr);
    }
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

  const onSelectCropImage = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Reset crop state
      const reader = new FileReader();
      reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
      setMode('crop-edit');
    }
  };

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    const aspect = 1.586;
    const newCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspect,
        width,
        height
      ),
      width,
      height
    );
    setCrop(newCrop);
  };

  const applyCrop = async () => {
    if (!completedCrop || !imgRef.current) return;
    
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    );
    
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Canvas is empty');
        return;
      }
      const file = new File([blob], "cropped-image.jpg", { type: "image/jpeg" });
      if (editingFileId) {
        setBatchFiles(prev => prev.map(bf => bf.id === editingFileId ? {
          ...bf,
          currentFile: file,
          cropType: 'standard',
          previewUrl: URL.createObjectURL(blob)
        } : bf));
        setMode('batch-review');
        setEditingFileId(null);
      } else {
        processFiles([file]);
      }
    }, 'image/jpeg');
  };

  const onSelectPerspectiveCropImage = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
      setMode('perspective-crop-edit');
    }
  };

  const applyPerspectiveCrop = (finalPoints) => {
    if (editingFileId) {
      setBatchFiles(prev => prev.map(bf => bf.id === editingFileId ? {
        ...bf,
        cropType: 'perspective',
        points: finalPoints
      } : bf));
      setMode('batch-review');
      setEditingFileId(null);
    } else {
      fetch(cropImageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "perspective-crop-image.jpg", { type: "image/jpeg" });
          const pointsMap = { 0: JSON.stringify(finalPoints) };
          processFiles([file], JSON.stringify(pointsMap));
        });
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
      if (acceptedFiles.length > 1) {
        const newFiles = Array.from(acceptedFiles).map(f => ({
          id: Math.random().toString(36).substring(7),
          originalFile: f,
          currentFile: f,
          cropType: null,
          points: null,
          previewUrl: URL.createObjectURL(f)
        }));
        setBatchFiles(newFiles);
        setMode('batch-review');
      } else {
        const reader = new FileReader();
        reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || ''));
        reader.readAsDataURL(acceptedFiles[0]);
        setMode('crop-edit');
      }
    }
  }, []);

  const submitBatch = () => {
    const filesToSubmit = batchFiles.map(bf => bf.currentFile);
    const pointsMap = {};
    batchFiles.forEach((bf, index) => {
      if (bf.cropType === 'perspective' && bf.points) {
        pointsMap[index] = JSON.stringify(bf.points);
      }
    });
    processFiles(filesToSubmit, Object.keys(pointsMap).length > 0 ? JSON.stringify(pointsMap) : null);
  };

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

      {mode === 'batch-review' && (
        <div className="flex flex-col gap-6 w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Batch Review ({batchFiles.length} files)</h2>
            <button 
              onClick={submitBatch}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold shadow-md transition"
            >
              Submit Batch
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {batchFiles.map(bf => (
              <div key={bf.id} className="border border-slate-200 bg-slate-50 rounded-xl p-4 flex flex-col gap-4">
                <div className="relative h-48 w-full bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={bf.previewUrl} className="max-h-full max-w-full object-contain" />
                  {bf.cropType && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-md font-bold shadow-sm">
                      {bf.cropType === 'standard' ? 'Standard Cropped' : 'Perspective Cropped'}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingFileId(bf.id);
                      setCropImageSrc(bf.previewUrl);
                      setMode('crop-edit');
                    }}
                    className="flex-1 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg transition"
                  >
                    Standard Crop
                  </button>
                  <button 
                    onClick={() => {
                      setEditingFileId(bf.id);
                      setCropImageSrc(bf.previewUrl);
                      setMode('perspective-crop-edit');
                    }}
                    className="flex-1 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg transition"
                  >
                    Perspective Crop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <button 
            onClick={() => setMode('camera')}
            className="group flex flex-col items-center justify-center p-6 border-2 border-slate-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Camera size={28} />
            </div>
            <h3 className="text-md font-bold text-slate-800">Use Camera</h3>
            <p className="text-xs text-slate-500 text-center mt-2">Take a live photo</p>
          </button>

          <div 
            {...getRootProps()} 
            className={`group flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all
              ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'}`}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Upload size={28} />
            </div>
            <h3 className="text-md font-bold text-slate-800">Upload Photo/PDF</h3>
            <p className="text-xs text-slate-500 text-center mt-2">Auto-extracts the ID</p>
          </div>

          <label className="group flex flex-col items-center justify-center p-6 border-2 border-slate-200 rounded-2xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all">
            <input type="file" accept="image/*" className="hidden" onChange={onSelectCropImage} />
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Crop size={28} />
            </div>
            <h3 className="text-md font-bold text-slate-800">Standard Crop</h3>
            <p className="text-xs text-slate-500 text-center mt-2">Manual rectangular crop</p>
          </label>

          <label className="group flex flex-col items-center justify-center p-6 border-2 border-slate-200 rounded-2xl cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all">
            <input type="file" accept="image/*" className="hidden" onChange={onSelectPerspectiveCropImage} />
            <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Maximize size={28} />
            </div>
            <h3 className="text-md font-bold text-slate-800">Perspective Crop</h3>
            <p className="text-xs text-slate-500 text-center mt-2">Free 4-point corner adjust</p>
          </label>
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

          <div className="absolute bottom-6 left-0 right-0 flex flex-col sm:flex-row justify-center gap-4 px-4 w-full sm:w-auto">
            <button 
              onClick={() => setMode('select')}
              className="w-full sm:w-auto px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full font-semibold transition"
            >
              Cancel
            </button>
            <button 
              onClick={capture}
              className="w-full sm:w-auto justify-center px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white shadow-lg rounded-full font-bold flex items-center gap-2 transition transform hover:scale-105"
            >
              <Camera size={20} />
              Capture Document
            </button>
          </div>
        </div>
      )}

      {mode === 'crop-edit' && cropImageSrc && (
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="bg-slate-100 p-2 sm:p-4 rounded-xl border border-slate-200 w-full max-h-[60vh] overflow-hidden flex justify-center">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1.586}
              className="max-h-[50vh] max-w-full"
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={cropImageSrc}
                onLoad={onImageLoad}
                className="max-h-[50vh] max-w-full w-auto object-contain"
              />
            </ReactCrop>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button 
              onClick={() => {
                if (editingFileId) {
                  setMode('batch-review');
                  setEditingFileId(null);
                } else {
                  setMode('select');
                }
                setCropImageSrc('');
              }}
              className="w-full sm:w-auto px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-full font-semibold transition"
            >
              Cancel
            </button>
            <button 
              onClick={applyCrop}
              className="w-full sm:w-auto justify-center px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg rounded-full font-bold flex items-center gap-2 transition"
            >
              <Crop size={20} />
              Crop & Submit
            </button>
          </div>
        </div>
      )}

      {mode === 'perspective-crop-edit' && cropImageSrc && (
        <PerspectiveCropEditor 
          imageSrc={cropImageSrc}
          onCancel={() => { 
            if (editingFileId) {
              setMode('batch-review');
              setEditingFileId(null);
            } else {
              setMode('select');
            }
            setCropImageSrc(''); 
          }}
          onSubmit={applyPerspectiveCrop}
        />
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
