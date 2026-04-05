import type { Command, CommandContext } from "../../commands.ts";

export const mcp: Command = {
  name: "mcp",
  aliases: [],
  description: "Manage MCP (Model Context Protocol) servers",

  execute(args: string[], context: CommandContext) {
    const action = args[0]?.toLowerCase();

    if (action === "list" || !action) {
      // Show connected MCP servers - placeholder
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content:
              "Connected MCP servers:\n  (MCP system not yet implemented)",
          },
        ],
      }));
    } else if (action === "connect" && args[1]) {
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: `Connecting to MCP server: ${args[1]}...`,
          },
        ],
      }));
    } else if (action === "disconnect" && args[1]) {
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: `Disconnected from MCP server: ${args[1]}`,
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
            content: "Usage: /mcp [list|connect|disconnect] [name]",
          },
        ],
      }));
    }
  },
};
