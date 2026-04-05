import type { Command, CommandContext } from "../../commands.ts";

export const clear: Command = {
  name: "clear",
  aliases: ["c", "cls"],
  description: "Clear message history",

  execute(_args: string[], context: CommandContext) {
    context.setAppState((prev) => ({
      ...prev,
      messages: [],
    }));
  },
};
