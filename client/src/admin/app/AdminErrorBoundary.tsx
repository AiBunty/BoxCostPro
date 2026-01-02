/**
 * AdminErrorBoundary
 * Catches ALL render errors and displays visible error UI
 * NEVER allows silent crashes - always shows something
 */

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AdminErrorBoundary] Render error caught:', error);
    console.error('[AdminErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo: errorInfo.componentStack || '' });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
  };

  render() {
    if (this.state.hasError) {
      // ALWAYS render visible error UI - never blank
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
          <div className="max-w-xl w-full">
            {/* Error header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-red-900 mb-2">Admin Panel Error</h1>
              <p className="text-red-700">Something went wrong while rendering the admin panel.</p>
            </div>

            {/* Error details */}
            <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden mb-6">
              <div className="px-4 py-3 bg-red-100 border-b border-red-200">
                <p className="text-sm font-medium text-red-800">Error Details</p>
              </div>
              <div className="p-4">
                <pre className="text-sm text-red-800 font-mono whitespace-pre-wrap break-words max-h-48 overflow-auto">
                  {this.state.error?.message || 'Unknown error occurred'}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="px-6 py-2.5 bg-white text-red-700 font-medium rounded-lg border border-red-300 hover:bg-red-50 transition-colors"
              >
                Try Again
              </button>
              <a
                href="/admin/login"
                className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Back to Login
              </a>
            </div>

            {/* Timestamp */}
            <p className="text-center text-xs text-red-400 mt-6">
              Error occurred at {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;
