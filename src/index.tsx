import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initI18n } from './locales/i18n';
import { WorkspaceProvider } from './workspace';
import { Spin } from '@douyinfe/semi-ui';
import 'reset-css';

// 从浏览器环境检测语言，不依赖 SDK
function detectLanguage(): 'zh' | 'en' | 'ja' {
  try {
    const lang = navigator.language || (navigator as any).userLanguage || '';
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('ja')) return 'ja';
    return 'en';
  } catch {
    return 'zh';
  }
}

function LoadApp() {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    // 不依赖 SDK bridge，直接使用浏览器语言检测
    initI18n(detectLanguage());
    setLoaded(true);
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
