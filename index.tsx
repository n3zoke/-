import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '100vh', 
            padding: '20px', 
            textAlign: 'center', 
            fontFamily: 'Tajawal, sans-serif',
            backgroundColor: '#f9fafb',
            color: '#1f2937'
        }}>
          <h1 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '10px'}}>عذراً، حدث خطأ غير متوقع</h1>
          <p style={{marginBottom: '20px', color: '#4b5563'}}>يرجى تحديث الصفحة أو المحاولة لاحقاً.</p>
          
          <div style={{
              textAlign: 'left', 
              background: '#e5e7eb', 
              padding: '15px', 
              borderRadius: '8px', 
              maxWidth: '600px', 
              width: '100%',
              overflow: 'auto',
              marginBottom: '20px',
              fontSize: '12px',
              fontFamily: 'monospace',
              direction: 'ltr'
          }}>
            {this.state.error?.toString()}
          </div>

          <button 
            onClick={() => window.location.reload()} 
            style={{
                padding: '12px 24px', 
                backgroundColor: '#5D4037', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: '16px', 
                cursor: 'pointer',
                fontWeight: 'bold'
            }}
          >
            تحديث الصفحة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
  </React.StrictMode>
);