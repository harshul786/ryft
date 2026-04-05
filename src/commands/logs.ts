/**
 * Logs management command
 * Provides utilities for viewing, clearing, and managing logs
 */

import chalk from "chalk";
import { logger, getLogFilePaths, getLogsSummary, readLogFile, clearLogFile, type LogStats } from "../logging/index.ts";

// Utility to format log stats nicely
function formatLogStats(stats: LogStats): string {
  if (stats.totalEntries === 0) {
    return chalk.gray("  (no entries)");
  }

  const lines = [
    `  Total entries: ${stats.totalEntries}`,
    `  By level: ${Object.entries(stats.byLevel)
      .map(([level, count]) => {
        const color =
          level === "error" ? chalk.red : level === "warn" ? chalk.yellow : chalk.gray;
        return color(`${level}: ${count}`);
      })
      .join(", ")}`,
  ];

  if (stats.timeRange) {
    lines.push(
      `  Time range: ${new Date(stats.timeRange.earliest).toLocaleString()} → ${new Date(stats.timeRange.latest).toLocaleString()}`,
    );
  }

  if (stats.errorCount > 0) {
    lines.push(chalk.red(`  ⚠️  ${stats.errorCount} error(s)`));
  }

  return lines.join("\n");
}

// Utility to get all features in use
function getFeaturesFromLog(filePath: string): Set<string> {
  const entries = readLogFile(filePath);
  const features = new Set<string>();
  entries.forEach((entry: Record<string, unknown>) => {
    if (entry.feature && typeof entry.feature === "string") {
      features.add(entry.feature);
    }
  });
  return features;
}

export async function handleLogsCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "status":
      await handleLogsStatus();
      break;

    case "view":
      await handleLogsView(args.slice(1));
      break;

    case "clear":
      await handleLogsClear(args.slice(1));
      break;

    case "enable":
      await handleLogsEnable();
      break;

    case "disable":
      await handleLogsDisable();
      break;

    case "level":
      await handleLogsLevel(args.slice(1));
      break;

    case "help":
    case "--help":
      showLogsHelp();
      break;

    default:
      console.log(chalk.yellow("Unknown logs subcommand. Use 'ryft logs help' for usage."));
  }
}

async function handleLogsStatus(): Promise<void> {
  console.log(chalk.bold("\n📋 Ryft Logs Status\n"));

  const summary = getLogsSummary();
  const logsPaths = getLogFilePaths();

  console.log(chalk.cyan("General Log:"));
  console.log(formatLogStats(summary.general));
  const generalFeatures = getFeaturesFromLog(logsPaths.general);
  if (generalFeatures.size > 0) {
    console.log(`  Features: ${chalk.blue(Array.from(generalFeatures).join(", "))}`);
  }

  console.log(chalk.cyan("\nDebug Log:"));
  console.log(formatLogStats(summary.debug));
  const debugFeatures = getFeaturesFromLog(logsPaths.debug);
  if (debugFeatures.size > 0) {
    console.log(`  Features: ${chalk.blue(Array.from(debugFeatures).join(", "))}`);
  }

  console.log(chalk.cyan("\nError Log:"));
  console.log(formatLogStats(summary.error));
  const errorFeatures = getFeaturesFromLog(logsPaths.error);
  if (errorFeatures.size > 0) {
    console.log(`  Features: ${chalk.blue(Array.from(errorFeatures).join(", "))}`);
  }

  console.log(chalk.cyan("\nLogger Configuration:"));
  const config = logger.getConfig();
  console.log(`  Enabled: ${config.enabled ? chalk.green("✓") : chalk.red("✗")}`);
  console.log(`  Level: ${chalk.blue(config.level)}`);
  console.log(`  Max file size: ${(config.maxFileSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Max files: ${config.maxFiles}`);
  console.log(`  Location: ${chalk.gray(config.logsDir)}`);

  console.log(chalk.cyan("\nEnvironment Variables:"));
  console.log(`  RYFT_LOGS_ENABLED: ${chalk.gray(process.env.RYFT_LOGS_ENABLED || "not set")}`);
  console.log(`  RYFT_LOG_LEVEL: ${chalk.gray(process.env.RYFT_LOG_LEVEL || "not set")}`);

  console.log("");
}

async function handleLogsView(args: string[]): Promise<void> {
  const logType = args[0] || "general";
  const filterFeature = args[1]; // Optional: filter by feature
  const limit = parseInt(args[2] || "20", 10);

  const logsPaths = getLogFilePaths();
  const filePath = logsPaths[logType as keyof typeof logsPaths];

  if (!filePath) {
    console.log(chalk.red(`Unknown log type: ${logType}`));
    console.log(chalk.gray("Available types: general, debug, error"));
    return;
  }

  let entries = readLogFile(filePath);

  // Filter by feature if specified
  if (filterFeature) {
    entries = entries.filter(
      (entry: Record<string, unknown>) => entry.feature === filterFeature,
    );
  }

  const recentEntries = entries.slice(-limit);

  if (recentEntries.length === 0) {
    const msg = filterFeature
      ? `No entries in ${logType} log for feature "${filterFeature}"`
      : `No entries in ${logType} log`;
    console.log(chalk.yellow(`\n${msg}\n`));
    return;
  }

  console.log(
    chalk.bold(
      `\n📝 Last ${recentEntries.length} entries from ${logType} log${filterFeature ? ` [${filterFeature}]` : ""}:\n`,
    ),
  );

  recentEntries.forEach((entry: Record<string, unknown>, index: number) => {
    const ts = entry.isoTime
      ? new Date(entry.isoTime as string).toLocaleTimeString()
      : "?";
    const level = (entry.level as string)?.toUpperCase() || "?";
    const feature = entry.feature ? chalk.cyan(`[${entry.feature}]`) : "";
    const levelColor =
      level === "ERROR"
        ? chalk.red
        : level === "WARN"
          ? chalk.yellow
          : level === "DEBUG"
            ? chalk.gray
            : chalk.blue;
    const message = entry.message || "";

    console.log(
      `${chalk.gray(String(index + 1).padStart(3))} [${ts}] ${levelColor(level.padEnd(5))} ${feature} ${message}`,
    );

    if (entry.context) {
      console.log(
        chalk.gray(`     Context: ${JSON.stringify(entry.context)}`),
      );
    }

    if (entry.error) {
      console.log(chalk.red(`     Error: ${entry.error}`));
    }
  });

  console.log("");
}

async function handleLogsClear(args: string[]): Promise<void> {
  const logType = args[0] || "all";
  const logsPaths = getLogFilePaths();

  if (logType === "all") {
    Object.values(logsPaths).forEach((filePath: string) => {
      if (clearLogFile(filePath)) {
        console.log(chalk.green(`✓ Cleared ${filePath}`));
      }
    });
    console.log(chalk.green("\n✓ All logs cleared\n"));
  } else {
    const filePath = logsPaths[logType as keyof typeof logsPaths];
    if (!filePath) {
      console.log(chalk.red(`Unknown log type: ${logType}`));
      console.log(chalk.gray("Available types: general, debug, error, all"));
      return;
    }

    if (clearLogFile(filePath)) {
      console.log(chalk.green(`\n✓ Cleared ${logType} log\n`));
    } else {
      console.log(chalk.red(`\n✗ Failed to clear ${logType} log\n`));
    }
  }
}

async function handleLogsEnable(): Promise<void> {
  logger.enable();
  console.log(chalk.green("\n✓ Logging enabled\n"));
}

async function handleLogsDisable(): Promise<void> {
  logger.disable();
  console.log(chalk.green("\n✓ Logging disabled\n"));
}

async function handleLogsLevel(args: string[]): Promise<void> {
  const newLevel = args[0];

  if (!newLevel) {
    console.log(`Current log level: ${chalk.blue(logger.getLevel())}`);
    return;
  }

  const validLevels = ["debug", "info", "warn", "error"];
  if (!validLevels.includes(newLevel)) {
    console.log(chalk.red(`Invalid log level: ${newLevel}`));
    console.log(chalk.gray(`Valid levels: ${validLevels.join(", ")}`));
    return;
  }

  logger.setLevel(newLevel as "debug" | "info" | "warn" | "error");
  console.log(chalk.green(`\n✓ Log level set to ${chalk.blue(newLevel)}\n`));
}

function showLogsHelp(): void {
  console.log(chalk.bold("\n📋 Ryft Logs Command\n"));
  console.log("Usage: ryft logs <subcommand> [options]\n");

  console.log(chalk.cyan("Subcommands:"));
  console.log("  status                  Show logs status and statistics");
  console.log("  view [type] [feature]   View log entries (default type: general)");
  console.log("    types: general, debug, error");
  console.log("    feature: optional feature filter (e.g., MCP, Browser, Skills)");
  console.log("  clear [type]            Clear log file (default: all)");
  console.log("    types: general, debug, error, all");
  console.log("  enable                  Enable logging");
  console.log("  disable                 Disable logging");
  console.log("  level [level]           Get/set log level (debug, info, warn, error)");
  console.log("  help                    Show this help message\n");

  console.log(chalk.cyan("Environment Variables:"));
  console.log("  RYFT_LOGS_ENABLED=1       Enable logging globally");
  console.log("  RYFT_LOGS_ENABLED=0       Disable logging globally");
  console.log("  RYFT_LOG_LEVEL=debug      Set log level (debug, info, warn, error)\n");

  console.log(chalk.cyan("Examples:"));
  console.log("  ryft logs status");
  console.log("  ryft logs view general MCP");
  console.log("  ryft logs view error Browser 50");
  console.log("  ryft logs clear all");
  console.log("  ryft logs level debug");
  console.log("  RYFT_LOGS_ENABLED=1 ryft <command>\n");

  console.log(chalk.cyan("Feature Usage Examples:"));
  console.log("  // In MCP module:");
  console.log("  import { getFeatureLogger } from '../logging'");
  console.log("  const log = getFeatureLogger('MCP')");
  console.log("  log.info('MCP server initialized')\n");

  console.log(chalk.cyan("Output:"));
  console.log("  Logs are stored locally in ~/.ryft/logs/");
  console.log("  - general.log: All log entries");
  console.log("  - debug.log: Debug-level entries");
  console.log("  - error.log: Error-level entries\n");
}
