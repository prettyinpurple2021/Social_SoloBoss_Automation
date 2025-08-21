import winston from 'winston';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(logColors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: logFormat,
  }),
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  transports,
});

export interface LogContext {
  userId?: string;
  postId?: string;
  platform?: string;
  requestId?: string;
  operation?: string;
  [key: string]: any;
}

export class LoggerService {
  private static instance: LoggerService;
  private logger: winston.Logger;

  private constructor() {
    this.logger = logger;
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const logData = {
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      context,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(JSON.stringify(logData));
  }

  warn(message: string, context?: LogContext): void {
    const logData = {
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(JSON.stringify(logData));
  }

  info(message: string, context?: LogContext): void {
    const logData = {
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    this.logger.info(JSON.stringify(logData));
  }

  debug(message: string, context?: LogContext): void {
    const logData = {
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(JSON.stringify(logData));
  }

  http(message: string, context?: LogContext): void {
    const logData = {
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    this.logger.http(JSON.stringify(logData));
  }
}

// Export singleton instance
export const loggerService = LoggerService.getInstance();