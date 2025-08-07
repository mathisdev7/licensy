export const ErrorConfig = {
  detailedLogging: process.env.environment === "debug",

  autoCleanup: true,

  retries: {
    maxRetries: 3,
    retryDelay: 1000,
  },

  discordErrorCodes: {
    UNKNOWN_MEMBER: 10007,
    UNKNOWN_GUILD: 10004,
    UNKNOWN_ROLE: 10011,
    MISSING_PERMISSIONS: 50013,
    CANNOT_SEND_DM: 50007,
    MISSING_ACCESS: 50001,
  },

  logging: {
    logLevel: process.env.environment === "debug" ? "debug" : "warn",
    logToFile: false,
    logPath: "./logs/",
  },
};

export function logError(
  message: string,
  error?: Error & { code?: number },
  level: "info" | "warn" | "error" = "error"
) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  switch (level) {
    case "info":
      console.info(`${prefix} ${message}`, error ? error : "");
      break;
    case "warn":
      console.warn(`${prefix} ${message}`, error ? error : "");
      break;
    case "error":
    default:
      console.error(`${prefix} ${message}`, error ? error : "");
      break;
  }
}
