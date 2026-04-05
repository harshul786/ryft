import type { Command, CommandContext } from "../../commands.ts";

export const memory: Command = {
  name: "memory",
  aliases: [],
  description: "Show memory/context usage",

  execute(_args: string[], context: CommandContext) {
    const messageCount = context.appState.messages.length;
    const totalChars = context.appState.messages.reduce(
      (sum, msg) => sum + msg.content.length, // AppState.Message.content is always string
      0,
    );

    context.setAppState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          role: "assistant",
          content: `Memory Usage:\n  Messages: ${messageCount}\n  Total Characters: ${totalChars}\n  Approximate Tokens: ${Math.ceil(totalChars / 4)}`,
        },
      ],
    }));
  },
};
