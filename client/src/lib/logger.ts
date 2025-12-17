/**
 * Centralized logging service
 * Industry Standard: Structured logging with levels and context
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, event: string, context?: LogContext, error?: Error): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      event,
      ...(context && { context }),
      ...(error && {
        error: {
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
          name: error.name,
        },
      }),
    };

    // In production, send to logging service (e.g., Sentry, LogRocket, etc.)
    // For now, use console with structured format
    const logMethod = level === LogLevel.ERROR ? console.error : 
                     level === LogLevel.WARN ? console.warn :
                     level === LogLevel.INFO ? console.info : 
                     console.debug;

    if (this.isDevelopment || level === LogLevel.ERROR || level === LogLevel.WARN) {
      logMethod(`[${level.toUpperCase()}] ${event}`, logEntry);
    }

    // TODO: In production, send to logging service
    // Example: sendToLoggingService(logEntry);
  }

  debug(event: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log(LogLevel.DEBUG, event, context);
    }
  }

  info(event: string, context?: LogContext): void {
    this.log(LogLevel.INFO, event, context);
  }

  warn(event: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, event, context, error);
  }

  error(event: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, event, context, error);
  }
}

export const logger = new Logger();

