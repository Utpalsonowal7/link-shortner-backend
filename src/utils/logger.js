import { createLogger, format, transports } from "winston";

const { combine, timestamp, json, colorize } = format;

const consoleLogger = format.combine(
     format.colorize(),
     format.printf(({ level, message, timestamp }) => {
          return `${timestamp} [${level}]: ${message}`;
     })
);

const logger = createLogger({
     level: "info",
     format: combine(
          colorize(),
          timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          json()
     ),
     transports: [
          new transports.Console({ format: consoleLogger }),
          new transports.File({ filename: "logs/application.log" }),
     ],
});

export default logger;