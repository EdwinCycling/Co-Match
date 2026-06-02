import {StrictMode, Component, ReactNode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import { SettingsProvider } from './contexts/SettingsContext';
import { MessageProvider } from './services/messageContext';
import './index.css';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#fee', color: 'red', zIndex: 9999 }}>
          <h1>App crashed</h1>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("=== [DEBUG] Element with id 'root' NOT found in document! ===");
}

createRoot(rootElement!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 20, background: '#f5f5f5', color: '#333' }}>Loading app...</div>}>
        <SettingsProvider>
          <MessageProvider>
            <App />
          </MessageProvider>
        </SettingsProvider>
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);
