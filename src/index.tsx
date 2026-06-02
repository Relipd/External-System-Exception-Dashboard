import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initI18n } from './locales/i18n';
import { WorkspaceProvider } from './workspace';
import { bitable } from '@lark-base-open/js-sdk';
import { Spin } from '@douyinfe/semi-ui';
import 'reset-css';

function LoadApp() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    bitable.bridge.getLanguage().then((lang) => {
      initI18n(lang as 'zh' | 'en' | 'ja');
      setLoaded(true);
    }).catch(() => {
      initI18n('zh');
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <Spin />;
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<LoadApp />);
