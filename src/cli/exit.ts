/**
 * Centralized exit and error handling
 * Provides consistent error output and exit codes
 */

import chalk from "chalk";
import figures from "figures";

/**
 * Exit codes
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  COMMAND_NOT_FOUND: 2,
  PERMISSION_DENIED: 3,
  INVALID_CONFIG: 4,
  API_ERROR: 5,
  NETWORK_ERROR: 6,
  TIMEOUT: 7,
  USER_CANCELLED: 130, // Standard signal SIGINT
} as const;

/**
 * Print error message and exit
 */
export function cliError(
  message: string,
  code: number = EXIT_CODES.GENERAL_ERROR,
  details?: string,
): never {
  if (process.env.DEBUG) {
    console.error(chalk.red(`${figures.cross} Error: ${message}`));
    if (details) {
      console.error(chalk.dim(details));
    }
  } else {
    console.error(chalk.red(`${figures.cross} ${message}`));
  }

  process.exit(code);
}

/**
 * Print success message and exit
 */
export function cliOk(
  message?: string,
  code: number = EXIT_CODES.SUCCESS,
): never {
  if (message) {
    console.log(chalk.green(`${figures.tick} ${message}`));
  }
  process.exit(code);
}

/**
 * Print warning message
 */
export function cliWarn(message: string, details?: string): void {
  console.warn(chalk.yellow(`${figures.warning} ${message}`));
  if (details && process.env.DEBUG) {
    console.warn(chalk.dim(details));
  }
}

/**
 * Print info message
 */
export function cliInfo(message: string, details?: string): void {
  console.log(chalk.blue(`${figures.info} ${message}`));
  if (details && process.env.DEBUG) {
    console.log(chalk.dim(details));
  }
}

/**
 * Print debug message
 */
export function cliDebug(message: string, data?: any): void {
  if (!process.env.DEBUG) return;

  console.debug(chalk.gray(`[DEBUG] ${message}`));
  if (data) {
    console.debug(chalk.gray(JSON.stringify(data, null, 2)));
  }
}

/**
 * Handle uncaught errors
 */
export function setupErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    cliError(
      "An unexpected error occurred",
      EXIT_CODES.GENERAL_ERROR,
      error instanceof Error ? error.stack : String(error),
    );
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason) => {
    cliError(
      "An unhandled promise rejection occurred",
      EXIT_CODES.GENERAL_ERROR,
      reason instanceof Error ? reason.stack : String(reason),
    );
  });

  // Handle user interruption (Ctrl+C)
  process.on("SIGINT", () => {
    console.log(); // New line after ^C
    cliWarn("Operation cancelled by user");
    process.exit(EXIT_CODES.USER_CANCELLED);
  });

  // Handle SIGTERM
  process.on("SIGTERM", () => {
    cliWarn("Process terminated");
    process.exit(1);
  });
}

/**
 * Wrapper for command execution with error handling
 */
export async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string = "Operation failed",
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    cliWarn(errorMessage, details);
    return null;
  }
}
