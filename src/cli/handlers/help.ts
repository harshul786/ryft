import type { Command, CommandContext } from "../../commands.ts";
import { getAvailableCommands } from "../../commands.ts";

export const help: Command = {
  name: "help",
  aliases: ["h", "?"],
  description: "Show help for all commands",

  execute(args: string[], context: CommandContext) {
    const commandName = args[0];
    const commands = getAvailableCommands().filter((cmd) => {
      if (!cmd.isEnabled) return true;
      // Framework's isEnabled expects CommandContext, but for compatibility check with session
      return cmd.isEnabled(context);
    });

    if (commandName) {
      // Show help for specific command
      const cmd = commands.find(
        (c) =>
          c.name === commandName.toLowerCase() ||
          c.aliases.includes(commandName.toLowerCase()),
      );
      if (cmd) {
        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `/${cmd.name} - ${cmd.description}\nAliases: ${cmd.aliases.length ? cmd.aliases.map((a: string) => `/${a}`).join(", ") : "none"}`,
            },
          ],
        }));
      } else {
        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `Command not found: ${commandName}`,
            },
          ],
        }));
      }
    } else {
      // Show all commands
      const formatted = commands
        .map((cmd) => `/${cmd.name.padEnd(12)} - ${cmd.description}`)
        .join("\n");
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: `Available commands:\n${formatted}`,
          },
        ],
      }));
    }
  },
};
