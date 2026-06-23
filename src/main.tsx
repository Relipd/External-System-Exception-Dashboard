import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@lark-base-open/js-sdk/dist/style/dashboard.css';
import App from './App';
import { WorkspaceProvider } from './workspace';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </StrictMode>,
);
