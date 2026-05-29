import winston from 'winston';
import fs from 'node:fs';
import path from 'node:path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  const base = `${ts} [${level}]: ${message}`;
  return stack ? `${base}\n${stack}` : base;
});

export function createLogger(level: string, logFile: string): winston.Logger {
  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return winston.createLogger({
    level,
    format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    transports: [
      new winston.transports.Console({
        format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
      }),
      new winston.transports.File({
        filename: logFile,
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
    ],
  });
}

let defaultLogger: winston.Logger | null = null;

export function getLogger(): winston.Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger('info', 'logs/bot.log');
  }
  return defaultLogger;
}

export function setLogger(logger: winston.Logger): void {
  defaultLogger = logger;
}

export type Logger = winston.Logger;
