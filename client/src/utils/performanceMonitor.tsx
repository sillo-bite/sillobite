import React from 'react';

// Performance monitoring utilities for React DevTools
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private measurements: Map<string, number> = new Map();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Measure component render time
  measureRender(componentName: string, startTime: number): void {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.measurements.set(`${componentName}_render`, duration);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ ${componentName} render time: ${duration.toFixed(2)}ms`);
    }
  }

  // Measure API call duration
  measureApiCall(endpoint: string, startTime: number): void {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.measurements.set(`${endpoint}_api`, duration);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🌐 ${endpoint} API call: ${duration.toFixed(2)}ms`);
    }
  }

  // Get performance metrics
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.measurements);
  }

  // Clear all measurements
  clearMetrics(): void {
    this.measurements.clear();
  }

  // Monitor Web Vitals
  monitorWebVitals(): void {
    if (typeof window === 'undefined') return;

    // First Contentful Paint
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          console.log('🎨 First Contentful Paint:', entry.startTime.toFixed(2) + 'ms');
        }
      }
    });
    
    observer.observe({ entryTypes: ['paint'] });
    this.observers.push(observer);

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('🖼️ Largest Contentful Paint:', lastEntry.startTime.toFixed(2) + 'ms');
    });
    
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.push(lcpObserver);
  }

  // Cleanup observers
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// React hook for measuring component performance
export function usePerformanceMonitor(componentName: string) {
  const startTime = React.useRef(performance.now());
  
  React.useEffect(() => {
    const monitor = PerformanceMonitor.getInstance();
    monitor.measureRender(componentName, startTime.current);
  });
}

// Higher-order component for performance monitoring
export function withPerformanceMonitor<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return React.memo((props: P) => {
    const startTime = React.useRef(performance.now());
    
    React.useEffect(() => {
      const monitor = PerformanceMonitor.getInstance();
      monitor.measureRender(componentName, startTime.current);
    });
    
    return <Component {...props} />;
  });
}

// Initialize performance monitoring
export function initializePerformanceMonitoring(): void {
  if (process.env.NODE_ENV === 'development') {
    const monitor = PerformanceMonitor.getInstance();
    monitor.monitorWebVitals();
    
    // Log performance metrics on page unload
    window.addEventListener('beforeunload', () => {
      const metrics = monitor.getMetrics();
      console.log('📊 Performance Metrics:', metrics);
    });
  }
}
