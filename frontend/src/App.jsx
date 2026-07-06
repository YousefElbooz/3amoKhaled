import React from 'react';
import IdUploader from './IdUploader';

function App() {
  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Professional ID Scanner
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Automatically align, crop, and embed your ID into the official PDF template.
          </p>
        </div>
        
        <IdUploader />
        
      </div>
    </div>
  );
}

export default App;
