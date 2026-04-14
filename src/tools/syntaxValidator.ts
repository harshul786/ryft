/**
 * Syntax Validation Hook
 *
 * Validates file syntax before writes using language-specific validators.
 * Supports: TypeScript, JavaScript, JSON, YAML, Python, and basic validation.
 */

import { extname } from "node:path";

export interface Diagnostic {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
  code?: string;
}

export interface ValidationResult {
  isValid: boolean;
  language: string;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  message?: string;
}

/**
 * Detect language from file extension
 */
function detectLanguage(
  filePath: string,
): "typescript" | "javascript" | "json" | "yaml" | "python" | "text" {
  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case ".ts":
      return "typescript";
    case ".tsx":
      return "typescript";
    case ".js":
      return "javascript";
    case ".jsx":
      return "javascript";
    case ".json":
      return "json";
    case ".yaml":
    case ".yml":
      return "yaml";
    case ".py":
      return "python";
    default:
      return "text";
  }
}

/**
 * Validate TypeScript/JavaScript syntax
 */
function validateTypeScript(content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  try {
    // Try to detect syntax errors with basic parsing
    // We use a simple approach: check for common syntax issues
    const lines = content.split("\n");

    let braceCount = 0;
    let bracketCount = 0;
    let parenCount = 0;
    let inString = false;
    let stringChar = "";
    let inComment = false;
    let inMultilineComment = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j - 1] : "";
        const nextChar = j < line.length - 1 ? line[j + 1] : "";

        // Handle multiline comments
        if (char === "/" && nextChar === "*" && !inString) {
          inMultilineComment = true;
          j++;
          continue;
        }
        if (char === "*" && nextChar === "/" && inMultilineComment) {
          inMultilineComment = false;
          j++;
          continue;
        }

        if (inMultilineComment) continue;

        // Handle single-line comments
        if (char === "/" && nextChar === "/" && !inString) {
          break; // Rest of line is comment
        }

        // Handle strings
        if ((char === '"' || char === "'" || char === "`") && prevChar !== "\\") {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }

        if (inString) continue;

        // Count brackets
        if (char === "{") braceCount++;
        if (char === "}") braceCount--;
        if (char === "[") bracketCount++;
        if (char === "]") bracketCount--;
        if (char === "(") parenCount++;
        if (char === ")") parenCount--;
      }

      // Report unmatched delimiters
      if (i === lines.length - 1) {
        if (braceCount !== 0) {
          diagnostics.push({
            line: i + 1,
            column: line.length,
            message: `Unmatched braces: ${braceCount > 0 ? "too many {" : "too many }"}`,
            severity: "error",
          });
        }
        if (bracketCount !== 0) {
          diagnostics.push({
            line: i + 1,
            column: line.length,
            message: `Unmatched brackets: ${bracketCount > 0 ? "too many [" : "too many ]"}`,
            severity: "error",
          });
        }
        if (parenCount !== 0) {
          diagnostics.push({
            line: i + 1,
            column: line.length,
            message: `Unmatched parentheses: ${parenCount > 0 ? "too many (" : "too many )"}`,
            severity: "error",
          });
        }
      }
    }

    // Check for unclosed strings
    if (inString) {
      diagnostics.push({
        line: lines.length,
        column: lines[lines.length - 1].length,
        message: `Unterminated string starting with ${stringChar}`,
        severity: "error",
      });
    }
  } catch (error) {
    // Silent catch - we did our best with basic validation
  }

  return diagnostics;
}

/**
 * Validate JSON syntax
 */
function validateJSON(content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  try {
    JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    // Parse the line number from the error if available
    const lineMatch = message.match(/line (\d+)/i);
    const line = lineMatch ? parseInt(lineMatch[1]) : 1;

    diagnostics.push({
      line,
      column: 1,
      message: `JSON parse error: ${message}`,
      severity: "error",
    });
  }

  return diagnostics;
}

/**
 * Validate YAML syntax (basic check)
 */
function validateYAML(content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = content.split("\n");

  // Basic YAML validation: check indentation consistency
  let expectedIndent = 0;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Count leading spaces
    const indent = line.length - line.trimStart().length;

    // YAML indentation must be multiples of 2 (convention)
    if (indent % 2 !== 0 && indent > 0) {
      diagnostics.push({
        line: i + 1,
        column: 1,
        message: `YAML indentation should be a multiple of 2 (found ${indent})`,
        severity: "warning",
      });
    }

    // Check for invalid YAML markers
    if (trimmed.includes(": ") && !trimmed.includes(": \"") && !trimmed.includes(": '")) {
      // This might be a key-value pair, which is valid
    }
  }

  return diagnostics;
}

/**
 * Validate Python syntax (basic check)
 */
function validatePython(content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = content.split("\n");

  // Check for common Python syntax issues
  let inMultilineString = false;
  let multilineQuote = "";
  let indentStack: number[] = [0];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip multiline strings
    if (inMultilineString) {
      if (trimmed.includes(multilineQuote)) {
        inMultilineString = false;
      }
      continue;
    }

    // Detect multiline strings
    if (trimmed.includes('"""') || trimmed.includes("'''")) {
      const quote = trimmed.includes('"""') ? '"""' : "'''";
      if ((trimmed.match(new RegExp(quote, "g")) || []).length === 1) {
        inMultilineString = true;
        multilineQuote = quote;
      }
    }

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Check indentation
    const indent = line.length - line.trimStart().length;

    // Check for mixed tabs and spaces
    if (line.includes("\t") && line.includes("  ")) {
      diagnostics.push({
        line: i + 1,
        column: 1,
        message: "Mixed tabs and spaces in indentation",
        severity: "error",
      });
    }

    // Check for colons at end of certain lines
    if (
      (trimmed.startsWith("if ") ||
        trimmed.startsWith("else:") ||
        trimmed.startsWith("for ") ||
        trimmed.startsWith("while ") ||
        trimmed.startsWith("def ") ||
        trimmed.startsWith("class ")) &&
      !trimmed.endsWith(":")
    ) {
      diagnostics.push({
        line: i + 1,
        column: line.length,
        message: "Expected ':' at end of statement",
        severity: "warning",
      });
    }
  }

  return diagnostics;
}

/**
 * Validate file syntax based on language
 */
export async function validateFile(filePath: string, content: string): Promise<ValidationResult> {
  const language = detectLanguage(filePath);
  let diagnostics: Diagnostic[] = [];

  try {
    switch (language) {
      case "typescript":
      case "javascript":
        diagnostics = validateTypeScript(content);
        break;
      case "json":
        diagnostics = validateJSON(content);
        break;
      case "yaml":
        diagnostics = validateYAML(content);
        break;
      case "python":
        diagnostics = validatePython(content);
        break;
      default:
        // No validation for unknown types
        break;
    }
  } catch (error) {
    // If validation itself fails, just warn
    diagnostics.push({
      line: 1,
      column: 1,
      message: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      severity: "warning",
    });
  }

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  return {
    isValid: errors.length === 0,
    language,
    errors,
    warnings,
    message:
      errors.length > 0
        ? `${errors.length} syntax error(s) found`
        : warnings.length > 0
          ? `${warnings.length} warning(s) found`
          : "Syntax valid",
  };
}
