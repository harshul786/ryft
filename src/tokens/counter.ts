import { encodingForModel, getEncoding } from "js-tiktoken";
import type { TiktokenModel } from "js-tiktoken";

/**
 * Token counting using js-tiktoken
 * Provides token counts for various content types
 */

/**
 * Get encoding for a model
 */
export function getModelEncoding(model: string) {
  try {
    // Try to use encodingForModel with common model names
    const commonModels: TiktokenModel[] = [
      "gpt-4",
      "gpt-4o",
      "gpt-4-turbo",
      "gpt-3.5-turbo",
      "text-davinci-003",
      "text-davinci-002",
    ];

    if (commonModels.includes(model as TiktokenModel)) {
      return encodingForModel(model as TiktokenModel);
    }

    // For other models, try to match encoding
    if (model.includes("gpt-4")) {
      return encodingForModel("gpt-4");
    }
    if (model.includes("gpt-3.5") || model.includes("turbo")) {
      return encodingForModel("gpt-3.5-turbo");
    }

    // Fallback to cl100k_base (GPT-4/GPT-3.5 encoding)
    return getEncoding("cl100k_base");
  } catch {
    // Fallback to cl100k_base encoding
    return getEncoding("cl100k_base");
  }
}

/**
 * Count tokens in text content
 */
export function countTextTokens(text: string, model: string): number {
  try {
    const enc = getModelEncoding(model);
    return enc.encode(text).length;
  } catch (error) {
    console.warn(`Failed to count tokens: ${error}`);
    return estimateTokensFromText(text);
  }
}

/**
 * Fallback token estimation when encoding fails
 * Rough approximation: ~1 token per 4 characters
 */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens in a JSON object
 */
export function countJsonTokens(obj: unknown, model: string): number {
  try {
    const json = JSON.stringify(obj);
    return countTextTokens(json, model);
  } catch (error) {
    console.warn(`Failed to count JSON tokens: ${error}`);
    return 0;
  }
}

/**
 * Token breakdown for a message
 */
export interface TokenBreakdown {
  role: string;
  content: string;
  tokens: number;
}

/**
 * Count tokens in a message
 */
export function countMessageTokens(
  role: string,
  content: string,
  model: string,
): TokenBreakdown {
  const tokens = countTextTokens(content, model);

  // Add overhead for role tokens (typically 3-4 tokens)
  const totalTokens = tokens + 4;

  return {
    role,
    content,
    tokens: totalTokens,
  };
}

/**
 * Count tokens in a conversation
 */
export function countConversationTokens(
  messages: Array<{ role: string; content: string }>,
  model: string,
): number {
  let total = 0;

  for (const msg of messages) {
    total += countMessageTokens(msg.role, msg.content, model).tokens;
  }

  // Add overhead for conversation metadata (~15 tokens)
  return total + 15;
}

/**
 * Estimate tokens for tool schemas
 */
export function estimateToolSchemaTokens(
  toolName: string,
  description: string,
): number {
  // Name + description approximation
  const baseTokens = Math.ceil((toolName.length + description.length) / 4);

  // Tool use markup overhead (~10 tokens)
  return baseTokens + 10;
}

/**
 * Estimate tokens for all available tools
 */
export function estimateTotalToolsTokens(
  tools: Array<{ name: string; description: string }>,
): number {
  return tools.reduce(
    (sum, tool) => sum + estimateToolSchemaTokens(tool.name, tool.description),
    0,
  );
}

/**
 * Format tokens count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens > 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens > 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return String(tokens);
}

/**
 * Calculate percentage of budget used
 */
export function calculateBudgetPercentage(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((used / total) * 100);
}
