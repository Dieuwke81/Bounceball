
import React from 'react';
import FutbolIcon from './icons/FutbolIcon';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="relative w-16 h-16">
        <FutbolIcon className="w-16 h-16 text-cyan-400 bounceball-loader" />
      </div>
      <p className="mt-4 text-lg font-semibold text-white animate-pulse">Teams worden gemaakt...</p>
      <p className="text-sm text-gray-400">De AI zoekt naar de perfecte balans.</p>
    </div>
  );
};

export default LoadingSpinner;