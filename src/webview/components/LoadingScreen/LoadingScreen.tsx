import React, { useEffect, useState } from 'react';
import './LoadingScreen.css';


export const LoadingScreen: React.FC = () => {
  const [dots, setDots] = useState<string>('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="loading-message">
          Waiting for data{dots}
        </p>
      </div>
    </div>
  );
};
