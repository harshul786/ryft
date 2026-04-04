import type { ChatMessage, Usage } from '../types.ts';

export interface StreamChatCompletionInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
  temperature?: number;
}

export interface StreamChatCompletionResult {
  usage: Usage | null;
  text: string;
}

export async function streamChatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  signal,
  onDelta,
  temperature = 0.2,
}: StreamChatCompletionInput): Promise<StreamChatCompletionResult> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return { usage: null, text: '' };
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let usage: Usage | null = null;
  let assistantText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      const event = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
        usage?: Usage;
      };
      const delta = event.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        assistantText += delta;
        onDelta(delta);
      }
      if (event.usage) usage = event.usage;
    }
  }

  return { usage, text: assistantText };
}
