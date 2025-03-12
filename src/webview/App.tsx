import React, { useEffect, useState } from 'react';
import { getVSCodeAPI } from './vscode-api';
import { Message, FolderMetricNode, LogLevel } from '@shared/index';
import { LoadingScreen, VizScreen } from './components';
import './App.css';


const App: React.FC = () => {
  const [data, setData] = useState<FolderMetricNode | undefined>(undefined);

  useEffect(() => {
    const vscode = getVSCodeAPI();
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as Message;
      switch (message.command) {
        case 'update': setData(message.data as FolderMetricNode); break;
        default: vscode.postMessage({
          command: 'log',
          data: {
            level: LogLevel.Error,
            content: `Unknown message command: ${message.command}`
          }
        })
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
      {data ? <VizScreen data={data} /> : <LoadingScreen />}
    </div>
  );
};

export default App;
