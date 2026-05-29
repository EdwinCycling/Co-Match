import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold">Er is een fout opgetreden in dit onderdeel.</h2>
          <button onClick={() => window.location.reload()} className="bg-primary text-white px-4 py-2 mt-4 rounded">
            Pagina vernieuwen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
