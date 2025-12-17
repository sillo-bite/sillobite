import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  onRetry: () => void;
}

function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const { resolvedTheme } = useTheme();

  const getCardClassName = () => {
    const baseClasses = "border-0 shadow-lg";
    const themeClasses = resolvedTheme === 'dark' 
      ? 'bg-black border-gray-800' 
      : 'bg-white border-gray-200';
    
    return `${baseClasses} ${themeClasses}`;
  };

  const getTitleClassName = () => {
    const baseClasses = "text-lg font-semibold mb-2";
    const themeClasses = resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800';
    return `${baseClasses} ${themeClasses}`;
  };

  const getTextClassName = () => {
    const baseClasses = "mb-4";
    const themeClasses = resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600';
    return `${baseClasses} ${themeClasses}`;
  };

  const getIconClassName = () => {
    const baseClasses = "w-8 h-8 mx-auto mb-4";
    const themeClasses = resolvedTheme === 'dark' ? 'text-red-400' : 'text-red-500';
    return `${baseClasses} ${themeClasses}`;
  };

  return (
    <Card className={getCardClassName()}>
      <CardContent className="p-6 text-center">
        <AlertTriangle className={getIconClassName()} />
        <h3 className={getTitleClassName()}>Something went wrong</h3>
        <p className={getTextClassName()}>
          We encountered an unexpected error. Please try refreshing the page.
        </p>
        {error && process.env.NODE_ENV === 'development' && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm font-medium mb-2">
              Error Details (Development)
            </summary>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <Button 
          onClick={onRetry}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}

export default ErrorBoundary;
