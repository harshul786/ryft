/**
 * Standardized output formatting
 * Provides consistent output across all Ryft CLI commands
 */

import chalk from "chalk";
import figures from "figures";

export type OutputFormat = "text" | "json" | "markdown" | "table";

export interface FormatOptions {
  format?: OutputFormat;
  color?: boolean;
  verbose?: boolean;
}

export interface ResultOutput {
  status: "success" | "error" | "warning" | "info";
  message: string;
  data?: any;
  metadata?: {
    duration?: number;
    itemCount?: number;
  };
}

/**
 * Render a result in the specified format
 */
export function formatOutput(
  result: ResultOutput,
  options: FormatOptions = {},
): string {
  const format = options.format || "text";
  const color = options.color !== false;

  switch (format) {
    case "json":
      return formatJson(result);
    case "markdown":
      return formatMarkdown(result, color);
    case "table":
      return formatTable(result, color);
    case "text":
    default:
      return formatText(result, color);
  }
}

/**
 * Format as plain text with optional colors
 */
function formatText(result: ResultOutput, color: boolean): string {
  let output = "";

  // Add status indicator
  const icon =
    result.status === "success"
      ? figures.tick
      : result.status === "error"
        ? figures.cross
        : result.status === "warning"
          ? figures.warning
          : figures.info;

  const prefix = color ? getColoredPrefix(result.status, icon) : `${icon} `;

  output += `${prefix}${result.message}\n`;

  // Add data if present
  if (result.data) {
    if (typeof result.data === "string") {
      output += `${result.data}\n`;
    } else if (Array.isArray(result.data)) {
      output += result.data.map((item) => `  • ${item}`).join("\n") + "\n";
    } else if (typeof result.data === "object") {
      output += formatObjectAsText(result.data, 1) + "\n";
    }
  }

  // Add metadata
  if (result.metadata) {
    if (result.metadata.duration) {
      output += color
        ? chalk.dim(`(${result.metadata.duration}ms)\n`)
        : `(${result.metadata.duration}ms)\n`;
    }
    if (result.metadata.itemCount) {
      output += color
        ? chalk.dim(`[${result.metadata.itemCount} items]\n`)
        : `[${result.metadata.itemCount} items]\n`;
    }
  }

  return output.trimEnd();
}

/**
 * Format as JSON
 */
function formatJson(result: ResultOutput): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format as Markdown
 */
function formatMarkdown(result: ResultOutput, color: boolean): string {
  let output = `## ${result.message}\n\n`;
  output += `**Status:** ${result.status}\n\n`;

  if (result.data) {
    output += "### Data\n\n";
    if (typeof result.data === "string") {
      output += `\`\`\`\n${result.data}\n\`\`\`\n`;
    } else if (Array.isArray(result.data)) {
      output += result.data.map((item) => `- ${item}`).join("\n") + "\n";
    } else if (typeof result.data === "object") {
      output += `\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`\n`;
    }
  }

  if (result.metadata) {
    output += "### Metadata\n\n";
    if (result.metadata.duration) {
      output += `- **Duration:** ${result.metadata.duration}ms\n`;
    }
    if (result.metadata.itemCount) {
      output += `- **Items:** ${result.metadata.itemCount}\n`;
    }
  }

  return output;
}

/**
 * Format as table (for array data)
 */
function formatTable(result: ResultOutput, color: boolean): string {
  if (!Array.isArray(result.data)) {
    return formatText(result, color);
  }

  const rows = result.data;
  if (rows.length === 0) {
    return formatText(result, color);
  }

  // Determine columns from first item
  const firstItem = rows[0];
  const columns =
    typeof firstItem === "object" ? Object.keys(firstItem) : ["value"];

  // Calculate column widths
  const widths = new Map<string, number>();
  for (const col of columns) {
    let max = col.length;
    for (const row of rows) {
      const value = typeof row === "object" ? row[col] : row.toString();
      max = Math.max(max, String(value).length);
    }
    widths.set(col, max);
  }

  // Build table
  let output = "";

  // Header
  const headerCells = columns.map((col) => col.padEnd(widths.get(col)!));
  output += "| " + headerCells.join(" | ") + " |\n";
  output +=
    "| " +
    columns.map((col) => "-".repeat(widths.get(col)!)).join(" | ") +
    " |\n";

  // Rows
  for (const row of rows) {
    const cells = columns.map((col) => {
      const value = typeof row === "object" ? row[col] : row;
      return String(value).padEnd(widths.get(col)!);
    });
    output += "| " + cells.join(" | ") + " |\n";
  }

  return output;
}

/**
 * Helper to format object as text
 */
function formatObjectAsText(obj: any, indent: number = 0): string {
  const spaces = " ".repeat(indent * 2);
  let output = "";

  if (typeof obj !== "object" || obj === null) {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      output += `${spaces}• ${item}\n`;
    }
  } else {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        output += `${spaces}${key}:\n`;
        output += formatObjectAsText(value, indent + 1);
      } else {
        output += `${spaces}${key}: ${value}\n`;
      }
    }
  }

  return output;
}

/**
 * Get colored prefix based on status
 */
function getColoredPrefix(
  status: ResultOutput["status"],
  icon: string,
): string {
  switch (status) {
    case "success":
      return chalk.green(`${icon} `);
    case "error":
      return chalk.red(`${icon} `);
    case "warning":
      return chalk.yellow(`${icon} `);
    case "info":
      return chalk.blue(`${icon} `);
    default:
      return `${icon} `;
  }
}

/**
 * Helper to create success result
 */
export function success(
  message: string,
  data?: any,
  metadata?: ResultOutput["metadata"],
): ResultOutput {
  return { status: "success", message, data, metadata };
}

/**
 * Helper to create error result
 */
export function error(
  message: string,
  data?: any,
  metadata?: ResultOutput["metadata"],
): ResultOutput {
  return { status: "error", message, data, metadata };
}

/**
 * Helper to create warning result
 */
export function warning(
  message: string,
  data?: any,
  metadata?: ResultOutput["metadata"],
): ResultOutput {
  return { status: "warning", message, data, metadata };
}

/**
 * Helper to create info result
 */
export function info(
  message: string,
  data?: any,
  metadata?: ResultOutput["metadata"],
): ResultOutput {
  return { status: "info", message, data, metadata };
}
