import type { ChatMessage, Usage, ToolUseContentPart } from "../types.ts";
import {
  getFeatureLogger,
  logLLMRequest,
  logLLMResponse,
} from "../logging/index.ts";

// ─── Internal streaming types ─────────────────────────────────────────────────

/** Partial tool call accumulated while streaming `delta.tool_calls` fragments */
interface PartialToolCall {
  id: string;
  name: string;
  /** Raw JSON string — fragments are concatenated, parsed at stream end */
  argumentsStr: string;
}

/** Shape of each SSE delta that may carry text and/or tool-call fragments */
interface StreamDelta {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

/** Full SSE event shape */
interface StreamEvent {
  choices?: Array<{
    delta?: StreamDelta;
    finish_reason?: string | null;
  }>;
  usage?: Usage;
}

// ─── OpenAI wire-format message shapes ───────────────────────────────────────

/** The exact JSON shape the OpenAI (and LiteLLM) API expects for each message */
type WireMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; content: string; tool_call_id: string };

/**
 * Convert our internal `ChatMessage[]` to the OpenAI wire format.
 *
 * The key difference: internally we store assistant tool-call turns as
 * `content: ToolUseContentPart[]` (Anthropic-style).  The OpenAI wire format
 * requires those same tool calls on a top-level `tool_calls` array, with
 * `content` set to the text portion (or null).
 */
function toWireMessages(messages: ChatMessage[]): WireMessage[] {
  const wire: WireMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "tool") {
      // Tool-result turn — content is always a plain string here
      wire.push({
        role: "tool",
        content: typeof msg.content === "string" ? msg.content : "",
        tool_call_id: msg.tool_call_id ?? "",
      });
      continue;
    }

    if (typeof msg.content === "string") {
      // Plain string content — no transformation needed
      wire.push({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      });
      continue;
    }

    // Structured content array (only occurs on assistant messages with tool calls)
    const textParts = msg.content
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");

    const toolUses = msg.content.filter(
      (p): p is ToolUseContentPart => p.type === "tool_use",
    );

    if (toolUses.length === 0) {
      // No tool calls — treat as plain text assistant message
      wire.push({ role: "assistant", content: textParts || "" });
      continue;
    }

    wire.push({
      role: "assistant",
      content: textParts || null,
      tool_calls: toolUses.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.input),
        },
      })),
    });
  }

  return wire;
}

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
}

export interface StreamChatCompletionResult {
  usage: Usage | null;
  text: string;
  /**
   * Structured tool calls returned by the model via the OpenAI function-calling
   * protocol (`delta.tool_calls`). Empty array when the model returned plain text.
   */
  toolCalls: ToolUseContentPart[];
}

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
}: StreamChatCompletionInput): Promise<StreamChatCompletionResult> {
  const log = getFeatureLogger("OpenAIClient");

  // Log the complete LLM request
  logLLMRequest({
    baseUrl,
    model,
    providerType: "openai-compatible",
    messages,
    temperature,
    maxTokens,
    tools,
  });

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const requestBody: Record<string, unknown> = {
    model,
    messages: toWireMessages(messages),
    stream: true,
    temperature,
    max_tokens: maxTokens,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    // Explicitly tell the model it may call functions (some providers default to off)
    requestBody.tool_choice = "auto";
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `OpenAI request failed: ${response.status} ${response.statusText}`,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return { usage: null, text: "", toolCalls: [] };
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let usage: Usage | null = null;
  let assistantText = "";

  // Keyed by `index` — each slot accumulates one complete tool call across deltas
  const partialToolCalls = new Map<number, PartialToolCall>();

  /** Process one fully-decoded SSE event, mutating accumulated state. */
  function processEvent(event: StreamEvent): void {
    const choice = event.choices?.[0];
    if (!choice) return;

    const delta = choice.delta;
    if (!delta) return;

    // ── Text content ──────────────────────────────────────────────────────
    if (delta.content) {
      assistantText += delta.content;
      onDelta(delta.content);
    }

    // ── Tool-call fragments ───────────────────────────────────────────────
    if (delta.tool_calls) {
      for (const fragment of delta.tool_calls) {
        const idx = fragment.index;
        if (!partialToolCalls.has(idx)) {
          // First fragment for this index — initialise the slot
          partialToolCalls.set(idx, {
            id: fragment.id ?? `call_${idx}`,
            name: fragment.function?.name ?? "",
            argumentsStr: "",
          });
        }
        const partial = partialToolCalls.get(idx)!;
        // Later fragments may refine id / name (some providers send them incrementally)
        if (fragment.id) partial.id = fragment.id;
        if (fragment.function?.name) partial.name = fragment.function.name;
        if (fragment.function?.arguments) {
          partial.argumentsStr += fragment.function.arguments;
        }
      }
    }

    if (event.usage) usage = event.usage;
  }

  // ── Main stream loop ──────────────────────────────────────────────────────
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        processEvent(JSON.parse(payload) as StreamEvent);
      } catch {
        // Malformed SSE frame — skip silently
      }
    }
  }

  // ── Flush any remaining buffer content ───────────────────────────────────
  buffer += decoder.decode();
  const remainingParts = buffer.split("\n\n");
  for (const part of remainingParts) {
    const line = part.trim();
    if (!line || !line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") continue;
    try {
      processEvent(JSON.parse(payload) as StreamEvent);
    } catch {
      // Malformed final frame — skip silently
    }
  }

  // ── Assemble tool calls from accumulated partial state ────────────────────
  const toolCalls: ToolUseContentPart[] = [];
  for (const [, partial] of partialToolCalls) {
    let input: Record<string, unknown> = {};
    if (partial.argumentsStr) {
      try {
        input = JSON.parse(partial.argumentsStr);
      } catch {
        log.warn("Failed to parse tool call arguments JSON", {
          toolName: partial.name,
          raw: partial.argumentsStr.slice(0, 200),
        });
      }
    }
    toolCalls.push({
      type: "tool_use",
      id: partial.id,
      name: partial.name,
      input,
    });
  }

  if (toolCalls.length > 0) {
    log.info(`Received ${toolCalls.length} tool call(s) from model`, {
      tools: toolCalls.map((t) => t.name).join(", "),
    });
  }

  // Log the complete LLM response
  logLLMResponse({
    model,
    usage: usage || undefined,
    responseText: assistantText,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  });

  return { usage, text: assistantText, toolCalls };
}
