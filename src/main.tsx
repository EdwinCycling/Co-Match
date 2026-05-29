console.log("=== [DEBUG] main.tsx start loading ===");

import {StrictMode, Component, ReactNode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SettingsProvider } from './contexts/SettingsContext';
import './index.css';

console.log("=== [DEBUG] main.tsx imports completed ===");

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    console.error("=== [DEBUG] ErrorBoundary caught error ===", error);
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error("=== [DEBUG] ErrorBoundary componentDidCatch ===", error, errorInfo);
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

console.log("=== [DEBUG] Attempting to createRoot and render ===");
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("=== [DEBUG] Element with id 'root' NOT found in document! ===");
} else {
  console.log("=== [DEBUG] Found rootElement, rendering React tree ===");
}

createRoot(rootElement!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 20, background: '#f5f5f5', color: '#333' }}>Loading app...</div>}>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);

console.log("=== [DEBUG] main.tsx createRoot.render executed ===");
