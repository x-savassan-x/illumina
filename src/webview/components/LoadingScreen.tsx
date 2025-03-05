import React, { useEffect, useState } from 'react';
import '../styles/LoadingScreen.css';

const LoadingScreen: React.FC = () => {
  const [dots, setDots] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>('Initializing visualization');

  // Simulate loading progress
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + Math.random() * 5;
        return newProgress > 100 ? 100 : newProgress;
      });
    }, 200);

    return () => clearInterval(timer);
  }, []);

  // Animate loading dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Update loading message based on progress
  useEffect(() => {
    if (progress < 30) {
      setMessage('Initializing visualization');
    } else if (progress < 60) {
      setMessage('Processing metrics');
    } else if (progress < 90) {
      setMessage('Building 3D model');
    } else {
      setMessage('Finalizing');
    }
  }, [progress]);

  return (
    <div className="loading-screen">
      <div className="loading-container">
        <h1 className="loading-title">Illumina</h1>
        <h2 className="loading-subtitle">Code Visualization Tool</h2>
        
        <div className="loading-progress-container">
          <div 
            className="loading-progress-bar" 
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="loading-message">
          {message}{dots}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
