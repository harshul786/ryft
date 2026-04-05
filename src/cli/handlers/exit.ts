import type { Command, CommandContext } from "../../commands.ts";

export const exit: Command = {
  name: "exit",
  aliases: ["quit", "q"],
  description: "Exit the REPL",

  execute(_args: string[], _context: CommandContext) {
    // Exit immediately
    process.exit(0);
  },
};
