import type { Command, CommandContext } from "../../commands.ts";
import { resolveModes } from "../../modes/catalog.ts";
import { renderStatusLine } from "../../ui/chalkDraw.ts";

export const mode: Command = {
  name: "mode",
  aliases: ["m"],
  description: "Select or show current modes",

  execute(args: string[], context: CommandContext) {
    if (args.length === 0) {
      // Show current modes
      const currentModes = context.session.config.modes
        .map((m) => m.name)
        .join(", ");
      context.setAppState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: `Current modes: ${currentModes}`,
          },
        ],
      }));
    } else {
      // Set modes to the provided arguments
      const modeNames = args;
      const resolvedModes = resolveModes(modeNames);

      if (resolvedModes.length === 0) {
        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `Invalid modes: ${modeNames.join(", ")}. Available: coder, browser-surff, debugger`,
            },
          ],
        }));
      } else {
        context.session.setModes(resolvedModes);
        const statusLine = renderStatusLine(context.session);
        context.setAppState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: `Modes updated:\n${statusLine}`,
            },
          ],
        }));
      }
    }
  },
};
