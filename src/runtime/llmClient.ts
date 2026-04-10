/**
 * LLM Client — LangChain-backed multi-provider adapter.
 *
 * Drop-in replacement for openaiClient.ts:
 *   - Identical public interface (`streamChatCompletion` + same I/O types)
 *   - Routes to the correct LangChain provider based on `providerType`
 *   - Falls back to provider detection via baseUrl / model-id prefix
 *
 * Supported providers: OpenAI, Anthropic, Google Gemini, Ollama, any OpenAI-compatible endpoint
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type {
  ChatMessage,
  ToolUseContentPart,
  Usage,
  ProviderType,
} from "../types.ts";
import { getFeatureLogger } from "../logging/index.ts";

// ─── Provider type detection ──────────────────────────────────────────────────

/**
 * Infer a ProviderType from the model id and base URL when it isn't set explicitly.
 * Order matters: model-id prefix wins over URL heuristics.
 */
function detectProviderType(modelId: string, baseUrl: string): ProviderType {
  const id = modelId.toLowerCase();
  const url = (baseUrl ?? "").toLowerCase();

  if (id.startsWith("claude-")) return "anthropic";
  if (id.startsWith("gemini-")) return "google";
  // Native Ollama endpoint — port 11434 without the /v1 OpenAI compat suffix
  if (url.includes(":11434") && !url.includes("/v1")) return "ollama";
  if (url.includes("api.openai.com")) return "openai";
  return "openai-compatible";
}

// ─── Model factory ────────────────────────────────────────────────────────────

// Using `any` for the return type because `.bindTools()` changes the concrete
// type to `Runnable<…>`, but both `BaseChatModel` and `Runnable` expose
// `.stream()` with the same calling convention.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildChatModel(params: {
  modelId: string;
  baseUrl: string;
  apiKey: string;
  provider: ProviderType;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  ollamaBaseUrl?: string;
  temperature: number;
  maxTokens: number;
}): any {
  const {
    modelId,
    baseUrl,
    apiKey,
    provider,
    anthropicApiKey,
    geminiApiKey,
    ollamaBaseUrl,
    temperature,
    maxTokens,
  } = params;

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({
        model: modelId,
        anthropicApiKey: anthropicApiKey || apiKey || undefined,
        temperature,
        maxTokens,
      });

    case "google":
      return new ChatGoogleGenerativeAI({
        model: modelId,
        apiKey: geminiApiKey || apiKey || undefined,
        temperature,
        maxOutputTokens: maxTokens,
      });

    case "ollama": {
      // Strip trailing /v1 if present — Ollama's native endpoint doesn't use it.
      // Use || (not ??) for the final fallback so an empty string also triggers it.
      const ollamaUrl =
        (ollamaBaseUrl ?? baseUrl).replace(/\/v1\/?$/, "").replace(/\/$/, "") ||
        "http://localhost:11434";
      return new ChatOllama({
        model: modelId,
        baseUrl: ollamaUrl,
        temperature,
        numPredict: maxTokens,
      });
    }

    case "openai":
    case "openai-compatible":
    default:
      return new ChatOpenAI({
        model: modelId,
        // "no-key" prevents the OpenAI SDK from throwing when OPENAI_API_KEY is unset.
        // LiteLLM and other OpenAI-compatible proxies accept any Bearer token value.
        openAIApiKey: apiKey || "no-key",
        temperature,
        maxTokens,
        configuration: { baseURL: baseUrl },
      });
  }
}

// ─── Internal message conversion ──────────────────────────────────────────────

/**
 * Convert Ryft's internal `ChatMessage[]` format to LangChain message objects.
 *
 * Ryft stores assistant tool-call turns as `content: ToolUseContentPart[]`
 * (Anthropic-style).  LangChain uses `AIMessage.tool_calls`.
 */
function toLC(messages: ChatMessage[]): BaseMessage[] {
  const result: BaseMessage[] = [];

  for (const msg of messages) {
    // ── Tool result ───────────────────────────────────────────────────────
    if (msg.role === "tool") {
      result.push(
        new ToolMessage({
          content: typeof msg.content === "string" ? msg.content : "",
          tool_call_id: msg.tool_call_id ?? "",
        }),
      );
      continue;
    }

    // ── Plain string content ──────────────────────────────────────────────
    if (typeof msg.content === "string") {
      switch (msg.role) {
        case "system":
          result.push(new SystemMessage(msg.content));
          break;
        case "user":
          result.push(new HumanMessage(msg.content));
          break;
        case "assistant":
          result.push(new AIMessage(msg.content));
          break;
      }
      continue;
    }

    // ── Structured user content (e.g., vision message with image data) ────
    if (msg.role === "user") {
      result.push(
        new HumanMessage({ content: msg.content as unknown as string }),
      );
      continue;
    }

    // ── Structured content array (assistant with tool calls) ──────────────
    const textParts = msg.content
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");

    const toolUses = msg.content.filter(
      (p): p is ToolUseContentPart => p.type === "tool_use",
    );

    result.push(
      new AIMessage({
        content: textParts || "",
        tool_calls: toolUses.map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.input,
          type: "tool_call" as const,
        })),
      }),
    );
  }

  return result;
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface StreamChatCompletionInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  // ── Multi-provider routing (all optional — detected from model/baseUrl when absent) ──
  providerType?: ProviderType;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  ollamaBaseUrl?: string;
}

export interface StreamChatCompletionResult {
  usage: Usage | null;
  text: string;
  /**
   * Structured tool calls returned by the model.
   * Empty array when the model returned plain text.
   */
  toolCalls: ToolUseContentPart[];
}

// ─── Retry helpers ───────────────────────────────────────────────────────────

/**
 * Extract retry delay in milliseconds from error message.
 * Looks for patterns like "Please retry in X.XXXs" or "Please retry in Xs"
 */
function extractRetryDelayMs(errorText: string): number | null {
  const match = errorText.match(/Please retry in ([\d.]+)s/i);
  if (match && match[1]) {
    const seconds = parseFloat(match[1]);
    if (!isNaN(seconds)) {
      // Return delay in ms, add 5 seconds buffer as requested
      return Math.ceil((seconds + 5) * 1000);
    }
  }
  return null;
}

/**
 * Check if error is a quota/rate-limit error (429)
 */
function isQuotaError(err: unknown): boolean {
  const errStr = String(err ?? "").toLowerCase();
  return (
    errStr.includes("429") ||
    errStr.includes("too many requests") ||
    errStr.includes("quota exceeded") ||
    errStr.includes("rate limit")
  );
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Stream ──────────────────────────────────────────────────────────────────

/**
 * Stream a chat completion through the appropriate LangChain provider.
 *
 * This function is a drop-in replacement for the previous `openaiClient.ts`
 * implementation and is called identically from all existing call sites.
 *
 * Automatically retries on Gemini quota/rate-limit errors (429) by extracting
 * the retry delay from the error message and waiting (+ 5s buffer) before retrying.
 */
export async function streamChatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  signal,
  onDelta,
  temperature = 0.2,
  maxTokens = 2048,
  tools,
  providerType,
  anthropicApiKey,
  geminiApiKey,
  ollamaBaseUrl,
}: StreamChatCompletionInput): Promise<
  StreamChatCompletionResult & { toolsProvided: boolean }
> {
  const log = getFeatureLogger("LLMClient");

  // Resolve which provider to use
  const resolvedProvider =
    providerType ?? detectProviderType(model, baseUrl ?? "");

  log.info("Starting stream", { model, provider: resolvedProvider });

  // Build the provider-specific model instance
  let chatModel = buildChatModel({
    modelId: model,
    baseUrl: baseUrl ?? "",
    apiKey,
    provider: resolvedProvider,
    anthropicApiKey,
    geminiApiKey,
    ollamaBaseUrl,
    temperature,
    maxTokens,
  });

  // Bind tools when provided — LangChain normalises the format per provider
  if (tools && tools.length > 0) {
    chatModel = chatModel.bindTools(tools);
  }

  // Convert messages to LangChain format
  const lcMessages = toLC(messages);

  // ── Stream with retry for quota errors ────────────────────────────────────
  let assistantText = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalChunk: any = undefined;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (retryCount <= MAX_RETRIES) {
    try {
      const stream = await chatModel.stream(lcMessages, { signal });

      for await (const chunk of stream) {
        // Extract text delta — content can be a string or content-block array
        const textDelta: string =
          typeof chunk.content === "string"
            ? chunk.content
            : Array.isArray(chunk.content)
              ? chunk.content
                  .filter(
                    (c: unknown) =>
                      (c as { type?: string }).type === "text" ||
                      typeof c === "string",
                  )
                  .map((c: unknown) =>
                    typeof c === "string"
                      ? c
                      : ((c as { text?: string }).text ?? ""),
                  )
                  .join("")
              : "";

        if (textDelta) {
          assistantText += textDelta;
          onDelta(textDelta);
        }

        // Accumulate chunks — LangChain's concat() merges tool_call_chunks correctly
        finalChunk = finalChunk ? finalChunk.concat(chunk) : chunk;
      }

      // Success — break out of retry loop
      break;
    } catch (err) {
      if (
        (err as { name?: string })?.name === "AbortError" ||
        signal?.aborted
      ) {
        log.info("Stream aborted by user");
        return {
          usage: null,
          text: assistantText,
          toolCalls: [],
          toolsProvided: !!(tools && tools.length > 0),
        };
      }

      // Check for quota/rate-limit error
      if (isQuotaError(err) && retryCount < MAX_RETRIES) {
        const delayMs = extractRetryDelayMs(String(err));
        const waitMs = delayMs ?? 60000; // Default to 60s if delay not found
        const waitSecs = Math.round(waitMs / 1000);

        retryCount++;
        log.warn(
          `Quota/rate limit error, retrying in ${waitSecs}s (attempt ${retryCount}/${MAX_RETRIES})`,
          {
            error: String(err).slice(0, 200),
            waitMs,
          },
        );

        // Wait before retrying
        await sleep(waitMs);
        continue; // Retry loop will continue
      }

      // Not a quota error, or max retries exceeded
      log.error("Stream failed", new Error(String(err)));
      throw err;
    }
  }

  if (retryCount > 0) {
    log.info(`Stream succeeded after ${retryCount} retry attempt(s)`);
  }

  // ── Extract tool calls from the fully accumulated chunk ───────────────────
  const toolCalls: ToolUseContentPart[] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((finalChunk?.tool_calls ?? []) as any[]).map((tc) => ({
      type: "tool_use" as const,
      id: tc.id ?? crypto.randomUUID(),
      name: tc.name as string,
      input: (tc.args ?? {}) as Record<string, unknown>,
    }));

  if (toolCalls.length > 0) {
    log.info(`Received ${toolCalls.length} tool call(s) from model`, {
      tools: toolCalls.map((t) => t.name).join(", "),
    });
  } else if (tools && tools.length > 0) {
    log.warn(
      `Model returned no tool calls despite ${tools.length} tool(s) being provided`,
      { model, provider: resolvedProvider },
    );
  }

  log.info("Model response", {
    model,
    provider: resolvedProvider,
    text: assistantText,
    toolCalls: toolCalls.map((tc) => ({ name: tc.name, input: tc.input })),
  });

  // ── Extract usage metadata (not all providers expose this) ───────────────
  let usage: Usage | null = null;
  if (finalChunk?.usage_metadata) {
    const meta = finalChunk.usage_metadata;
    usage = {
      input_tokens: meta.input_tokens ?? 0,
      output_tokens: meta.output_tokens ?? 0,
    };
  }

  return {
    usage,
    text: assistantText,
    toolCalls,
    toolsProvided: !!(tools && tools.length > 0),
  };
}
