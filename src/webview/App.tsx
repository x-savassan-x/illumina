import React, { useEffect, useState } from 'react';
import { Message, FolderMetricNode } from '@shared/index';
import LoadingScreen from './components/LoadingScreen';
import CityMetaphor from './components/CityMetaphor';
import './styles/App.css';


declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: Message) => void;
    };
  }
}


const vscode = window.acquireVsCodeApi();


const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<FolderMetricNode | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as Message;
      switch (message.command) {
        case 'update':
          setData(message.data as FolderMetricNode);
          setIsLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    vscode.postMessage({ command: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="app-container">
      {isLoading ? (
        <LoadingScreen />
      ) : (
        <CityMetaphor data={data} />
      )}
    </div>
  );
};

export default App;