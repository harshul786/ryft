/**
 * Command argument validation
 * Schema-based validation for command arguments
 */

export type ValidatorType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "url"
  | "email"
  | "path"
  | "regex";

export interface ValidatorRule {
  type: ValidatorType;
  required?: boolean;
  description?: string;
  min?: number;
  max?: number;
  pattern?: RegExp;
  values?: string[]; // For enum type
  errorMessage?: string;
}

export interface ArgumentSchema {
  [argName: string]: ValidatorRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: Map<string, string>;
}

/**
 * Validate arguments against schema
 */
export function validateArguments(
  args: string[],
  schema: ArgumentSchema,
): ValidationResult {
  const errors = new Map<string, string>();
  const argsByIndex = new Map<number, string>();

  // Parse args (simple implementation - doesn't handle named args yet)
  args.forEach((arg, index) => {
    argsByIndex.set(index, arg);
  });

  let argIndex = 0;
  for (const [argName, rule] of Object.entries(schema)) {
    const value = argsByIndex.get(argIndex);

    if (!value && rule.required) {
      errors.set(argName, rule.errorMessage || `${argName} is required`);
      argIndex++;
      continue;
    }

    if (!value) {
      argIndex++;
      continue;
    }

    // Validate the value
    const validationError = validateValue(value, rule, argName);
    if (validationError) {
      errors.set(argName, validationError);
    }

    argIndex++;
  }

  return {
    valid: errors.size === 0,
    errors,
  };
}

/**
 * Validate a single value against a rule
 */
function validateValue(
  value: string,
  rule: ValidatorRule,
  fieldName: string,
): string | null {
  switch (rule.type) {
    case "string":
      return validateString(value, rule, fieldName);
    case "number":
      return validateNumber(value, rule, fieldName);
    case "boolean":
      return validateBoolean(value, fieldName);
    case "enum":
      return validateEnum(value, rule, fieldName);
    case "url":
      return validateUrl(value, fieldName);
    case "email":
      return validateEmail(value, fieldName);
    case "path":
      return validatePath(value, fieldName);
    case "regex":
      return validateRegex(value, rule, fieldName);
    default:
      return null;
  }
}

function validateString(
  value: string,
  rule: ValidatorRule,
  fieldName: string,
): string | null {
  if (rule.min && value.length < rule.min) {
    return `${fieldName} must be at least ${rule.min} characters`;
  }
  if (rule.max && value.length > rule.max) {
    return `${fieldName} must be at most ${rule.max} characters`;
  }
  return null;
}

function validateNumber(
  value: string,
  rule: ValidatorRule,
  fieldName: string,
): string | null {
  const num = Number(value);
  if (isNaN(num)) {
    return `${fieldName} must be a number`;
  }
  if (rule.min && num < rule.min) {
    return `${fieldName} must be at least ${rule.min}`;
  }
  if (rule.max && num > rule.max) {
    return `${fieldName} must be at most ${rule.max}`;
  }
  return null;
}

function validateBoolean(value: string, fieldName: string): string | null {
  if (!["true", "false", "yes", "no", "1", "0"].includes(value.toLowerCase())) {
    return `${fieldName} must be a boolean (true/false or yes/no)`;
  }
  return null;
}

function validateEnum(
  value: string,
  rule: ValidatorRule,
  fieldName: string,
): string | null {
  if (!rule.values?.includes(value)) {
    return `${fieldName} must be one of: ${rule.values?.join(", ")}`;
  }
  return null;
}

function validateUrl(value: string, fieldName: string): string | null {
  try {
    new URL(value);
    return null;
  } catch {
    return `${fieldName} must be a valid URL`;
  }
}

function validateEmail(value: string, fieldName: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return `${fieldName} must be a valid email address`;
  }
  return null;
}

function validatePath(value: string, fieldName: string): string | null {
  // Very basic path validation - just ensure it's not empty and looks reasonable
  if (!value || value.trim().length === 0) {
    return `${fieldName} must be a valid path`;
  }
  return null;
}

function validateRegex(
  value: string,
  rule: ValidatorRule,
  fieldName: string,
): string | null {
  if (!rule.pattern?.test(value)) {
    return `${fieldName} format is invalid`;
  }
  return null;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: Map<string, string>): string {
  const lines = ["Argument validation failed:"];
  for (const [field, error] of errors.entries()) {
    lines.push(`  • ${field}: ${error}`);
  }
  return lines.join("\n");
}

/**
 * Helper to create schema validators for common scenarios
 */
export const commonValidators = {
  required: (description?: string): ValidatorRule => ({
    type: "string",
    required: true,
    description,
  }),

  optional: (description?: string): ValidatorRule => ({
    type: "string",
    required: false,
    description,
  }),

  number: (min?: number, max?: number): ValidatorRule => ({
    type: "number",
    min,
    max,
  }),

  enumOf: (...values: string[]): ValidatorRule => ({
    type: "enum",
    values,
  }),

  url: (): ValidatorRule => ({ type: "url" }),

  email: (): ValidatorRule => ({ type: "email" }),

  filepath: (): ValidatorRule => ({ type: "path" }),
};
