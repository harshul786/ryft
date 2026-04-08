import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatMessage } from "../types.ts";
import { getMessageText } from "../types.ts";
import { summarizeMemory } from "../memory/compose.ts";
import { streamChatCompletion } from "../runtime/llmClient.ts";
import type { Session } from "../runtime/session.ts";
import { COMPACT_PROMPT } from "./compact/prompts.ts";

export interface CompactOptions {
  keepRecentTurns?: number;
  summarizer?: (input: CompactSummaryInput) => Promise<string>;
}

export interface CompactSummaryInput {
  session: Session;
  olderMessages: ChatMessage[];
  recentMessages: ChatMessage[];
}

function serializeMessages(messages: ChatMessage[]): string {
  return messages
    .map((message, index) => {
      const content = getMessageText(message).replace(/\s+/g, " ").trim();
      return `${index + 1}. ${message.role}: ${content}`;
    })
    .join("\n");
}

function getProjectRoot(): string {
  return fileURLToPath(new URL("../..", import.meta.url));
}

async function loadCompactPrompt(cwd?: string): Promise<string> {
  const candidates = [
    cwd ? path.join(cwd, "COMPACT.md") : null,
    path.join(getProjectRoot(), "COMPACT.md"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      const text = await readFile(candidate, "utf8");
      if (text.trim()) {
        return text.trim();
      }
    } catch {
      // try the next location
    }
  }

  return COMPACT_PROMPT.trim();
}

async function buildCompactionSystemPrompt(session: Session): Promise<string> {
  const compactPrompt = await loadCompactPrompt(session.config.cwd);
  const modeList = session.modes.map((mode) => mode.name).join(", ");
  return [
    compactPrompt,
    "",
    `Active modes: ${modeList}`,
    `Memory mode: ${summarizeMemory(session.memoryMode)}`,
    "Output only the summary.",
  ].join("\n");
}

async function summarizeWithModel(input: CompactSummaryInput): Promise<string> {
  const systemPrompt = await buildCompactionSystemPrompt(input.session);
  const userPrompt = [
    "Summarize the following older conversation messages for future continuation.",
    "",
    serializeMessages(input.olderMessages),
  ].join("\n");

  const chunks: string[] = [];
  await streamChatCompletion({
    baseUrl: input.session.config.baseUrl,
    apiKey: input.session.config.apiKey,
    anthropicApiKey: input.session.config.anthropicApiKey,
    geminiApiKey: input.session.config.geminiApiKey,
    ollamaBaseUrl: input.session.config.ollamaBaseUrl,
    providerType: input.session.config.model.providerType,
    model: input.session.config.model.id,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    signal: input.session.abortController.signal,
    temperature: 0,
    onDelta: (chunk) => chunks.push(chunk),
  });

  const text = chunks.join("").trim();
  return text || "No summary was produced.";
}

export async function compactSession(
  session: Session,
  options: CompactOptions = {},
): Promise<string> {
  const keepRecentTurns = options.keepRecentTurns ?? 6;
  const olderMessages = session.history.slice(
    0,
    Math.max(0, session.history.length - keepRecentTurns),
  );
  const recentMessages = session.history.slice(-keepRecentTurns);

  const summary = options.summarizer
    ? await options.summarizer({ session, olderMessages, recentMessages })
    : await summarizeWithModel({ session, olderMessages, recentMessages });

  session.history.length = 0;
  session.history.push({ role: "system", content: summary });
  session.history.push(...recentMessages);

  if (session.memoryMode.name === "session") {
    const prior = session.memoryState.snapshot.trim();
    session.setMemoryState([prior, summary].filter(Boolean).join("\n\n"));
  }

  return summary;
}

export async function summarizeHistory(session: Session): Promise<void> {
  await compactSession(session);
}
